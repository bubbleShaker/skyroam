import {
  BufferGeometry,
  Color,
  GridHelper,
  Group,
  type Material,
  Mesh,
  MeshLambertMaterial,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";
import type { FrameContext, InitContext, System } from "../core/System";
import { ringToWorld } from "../world/geo";
import type { PolygonRings, Ring } from "../world/landmass";
import { fogRange, terrainReach } from "./visibility";

/**
 * 地形の描画。海面・陸地・グリッドの 3 層でできている。
 *
 * | 層 | 位置 | 生成 |
 * | --- | --- | --- |
 * | 海面 | カメラ追従 | 平面 1 枚 |
 * | 陸地 | 絶対位置（動かない） | 海岸線ポリゴンを三角形分割して 1 度だけ |
 * | グリッド | カメラ追従 | GridHelper |
 *
 * 海面とグリッドは有限の板をカメラの真下へスナップさせ続けることで無限に見せる。
 * 陸地だけは実在の地理そのものなので追従させない（追従させたら大陸に着けない）。
 */

/**
 * グリッド 1 マスの一辺 (m)。
 *
 * 大洋の上には手がかりが何も無く、これが無いと速度感が完全に消える。
 * 巡航 100m/s でちょうど毎秒 1 マス通過する大きさにしてある。
 * M0 では 50m だったが、視程を 4km から 19km へ広げたことでマス数が 4 倍以上になり、
 * 遠方で線が潰れてモアレになるため倍にした。
 */
export const GRID_CELL = 100;

/** 海面の色。空の地平線側 (#bcd8f0) に対して十分暗く、陸地とも区別が付く */
const SEA_COLOR = "#1e5180";
const LAND_COLOR = "#33513a";

/**
 * 深度をどれだけ奥へ押すか。数が大きいほど奥に描かれる。
 *
 * 海面・陸地・グリッドはすべて y = 0 に重なるので、そのままだと z-fighting する。
 * 高さでずらす手は使えない（far 24km に対し深度分解能は遠方でメートル級になり、
 * 数十 cm のずれは埋もれる）。`polygonOffset` は深度値そのものをずらすので
 * 距離に依らず効く。
 *
 * **グリッドが 0 なのは意図的**。`GridHelper` は `LineSegments` で、
 * WebGL には `POLYGON_OFFSET_FILL` しか無く、GL 仕様上これは三角形の
 * ラスタライズにしか適用されない。線分にオフセットを設定しても**完全な no-op** で、
 * 「設定したのに効かない」という嘘の安心が残るだけになる。
 * 代わりに陸地と海面の側を奥へ押し、線をオフセット 0 の最前面に残す。
 */
const DEPTH_ORDER = { sea: 2, land: 1, grid: 0 } as const;

export interface TerrainLayout {
  /** 海面の一辺 (m)。必ず GRID_CELL の整数倍 */
  readonly seaSize: number;
  /** グリッドの一辺 (m)。必ず GRID_CELL の整数倍 */
  readonly gridSize: number;
  /** GridHelper の分割数 */
  readonly gridDivisions: number;
}

/**
 * 海面とグリッドの寸法を求める。
 *
 * 一辺を先に決めて割るのではなく**マス数を先に決めて掛ける**。
 * こうしないと 1 マスがちょうど GRID_CELL にならず、
 * snapToCell の丸め単位とずれてグリッドの目が動いて見える。
 *
 * 海面とグリッドで広さを分けているのは、必要な距離が違うため。
 * 海面は far 面の外まで要る（visibility.ts 参照）が、グリッドは霧が
 * 効き切る所までで十分で、同じ広さにすると完全に霧へ溶けた線を
 * デスクトップで 2 倍近く無駄に描くことになる。
 */
export function terrainLayout(
  drawDistance: number,
  cell: number = GRID_CELL,
): TerrainLayout {
  const seaDivisions = cellCount(terrainReach(drawDistance) * 2, cell);
  // +2 マス分の余白。丸めで最大半マス縮みうるうえ、カメラ追従の
  // スナップでさらに半マス動くので、余白が無いと霧の外に端が出うる
  const gridDivisions = cellCount(fogRange(drawDistance).far * 2, cell) + 2;
  return {
    seaSize: seaDivisions * cell,
    gridSize: gridDivisions * cell,
    gridDivisions,
  };
}

/** 不正な入力で NaN の板を作らない。無音で「何も描かれない世界」になるのを防ぐ */
function cellCount(size: number, cell: number): number {
  if (!Number.isFinite(size) || !Number.isFinite(cell) || cell <= 0) return 2;
  return Math.max(2, Math.round(size / cell));
}

/**
 * 値を cell の整数倍に丸める。
 * 海面とグリッドをカメラ直下へスナップさせ、有限の板を無限に見せるために使う。
 */
export function snapToCell(value: number, cell: number = GRID_CELL): number {
  if (!Number.isFinite(value) || cell <= 0) return 0;
  return Math.round(value / cell) * cell;
}

/**
 * 地形メッシュの生成に必要な最小限。
 *
 * 具象 `Landmass` ではなくこの細い契約を受けるのは `TerrainQuery` と同じ理由で、
 * ここが要るのはリングの座標だけ。bbox も陸/海判定も見ない。
 */
export interface LandShapeSource {
  readonly polygons: readonly { readonly rings: PolygonRings }[];
}

/**
 * リングをワールド座標へ投影し、`Shape` の 2D 座標へ写す。
 *
 * **`Shape` は 2D (x, y) で、水平にするには X 軸まわりに -90° 回す**。
 * その回転は `(sx, sy, 0)` を `(sx, 0, -sy)` に写す。つまり shape の +y は
 * ワールドの **-z**（＝北）に落ちる。ワールドの z をそのまま入れると南北が反転するので、
 * ここで符号を反転させておく必要がある。
 *
 * 南北が反転しても画面上は「それらしい陸地」に見えてしまい目視では気づけないので、
 * Terrain.test.ts が実データの陸/海判定と突き合わせて固定している。
 */
function ringToShapePoints(ring: Ring): Vector2[] {
  return ringToWorld(ring).map(({ x, z }) => new Vector2(x, -z));
}

/**
 * 海岸線ポリゴン群を、水平な 1 個の `BufferGeometry` に変換する。
 *
 * 216 個の Mesh を並べるとドローコールが 216 回になるが、`ShapeGeometry` は
 * `Shape[]` を渡すと 1 個のジオメトリにまとめてくれるので 1 回で済む。
 * 三角形数は約 6,600 で、これは毎フレーム描いても無視できる量。
 *
 * 巻き方向は three 側が正規化する（入力が CW でも CCW でも
 * 三角形は同じ向きに揃えられる）ので、データの巻き方向は気にしなくてよい。
 * ただし**それを当てにしている**ことをテストで固定してある。
 */
export function buildLandGeometry(source: LandShapeSource): BufferGeometry {
  const shapes: Shape[] = [];
  for (const polygon of source.polygons) {
    const [outer, ...holes] = polygon.rings;
    if (!outer) continue;
    const shape = new Shape(ringToShapePoints(outer));
    // 穴（湖）は Shape.holes に入れる。現在のデータに穴は無いが、
    // lakes レイヤを合成した時にここがそのまま効く
    for (const hole of holes) {
      shape.holes.push(new Path(ringToShapePoints(hole)));
    }
    shapes.push(shape);
  }
  const geometry = new ShapeGeometry(shapes);
  // ShapeGeometry は shape ごとにマテリアルグループを作る。単一マテリアルでは
  // 無視されるが、将来マテリアルを配列にした時に 216 個前提の描画経路へ落ちる
  geometry.clearGroups();
  // Shape の 2D 平面 (xy) を水平面 (xz) へ倒す
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export interface TerrainOptions {
  /** カメラの描画距離 (m)。海面とグリッドの広さをここから決める */
  readonly drawDistance: number;
  readonly land: LandShapeSource;
}

export class Terrain implements System {
  readonly name = "terrain";

  /** カメラ追従する層（海面・グリッド） */
  private readonly followGroup = new Group();
  private readonly sea: Mesh<PlaneGeometry, MeshLambertMaterial>;
  private readonly grid: GridHelper;
  /** 実在の地理そのものなので追従しない */
  private readonly land: Mesh<BufferGeometry, MeshLambertMaterial>;

  constructor(options: TerrainOptions) {
    const layout = terrainLayout(options.drawDistance);

    this.sea = new Mesh(
      new PlaneGeometry(layout.seaSize, layout.seaSize),
      new MeshLambertMaterial({ color: new Color(SEA_COLOR) }),
    );
    this.sea.rotation.x = -Math.PI / 2;
    // シーングラフ上での識別名。three のインスペクタとテストが読む
    this.sea.name = "sea";
    pushDepth(this.sea.material, DEPTH_ORDER.sea);
    // 影を受けるのは陸地だけでよい。海面は M5 以降に水面表現へ置き換える
    this.sea.receiveShadow = false;

    this.land = new Mesh(
      buildLandGeometry(options.land),
      new MeshLambertMaterial({ color: new Color(LAND_COLOR) }),
    );
    this.land.name = "land";
    pushDepth(this.land.material, DEPTH_ORDER.land);
    this.land.receiveShadow = true;

    this.grid = new GridHelper(
      layout.gridSize,
      layout.gridDivisions,
      new Color("#8aa0a8"),
      new Color("#5b7079"),
    );
    this.grid.name = "grid";
    for (const material of materialsOf(this.grid)) {
      pushDepth(material, DEPTH_ORDER.grid);
      material.depthWrite = false;
    }

    this.followGroup.add(this.sea, this.grid);
  }

  init(ctx: InitContext): void {
    ctx.scene.add(this.followGroup, this.land);
  }

  lateUpdate(ctx: FrameContext): void {
    const { x, z } = ctx.camera.position;
    this.followGroup.position.set(snapToCell(x), 0, snapToCell(z));
  }

  dispose(): void {
    this.sea.geometry.dispose();
    this.sea.material.dispose();
    this.land.geometry.dispose();
    this.land.material.dispose();
    this.grid.dispose();
    this.followGroup.removeFromParent();
    this.land.removeFromParent();
  }
}

/** GridHelper のマテリアルは実装によって単体にも配列にもなりうる */
function materialsOf(object: { material: Material | Material[] }): Material[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

/** amount が大きいほど深度を奥へ押す。0 なら何もしない */
function pushDepth(material: Material, amount: number): void {
  if (amount === 0) return;
  material.polygonOffset = true;
  material.polygonOffsetFactor = amount;
  material.polygonOffsetUnits = amount;
}
