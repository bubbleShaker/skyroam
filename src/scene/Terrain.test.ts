import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene, Vector3 } from "three";
import {
  buildLandGeometry,
  terrainLayout,
  snapToCell,
  Terrain,
  GRID_CELL,
  type LandShapeSource,
} from "./Terrain";
import { fogRange, skyRadius, terrainReach } from "./visibility";
import { EAST_ASIA_LAND } from "../world/eastAsia";
import { lonLatToWorld, type LonLat } from "../world/geo";
import { QUALITY_PRESETS } from "../core/device";
import { DEFAULT_TUNING } from "../flight/tuning";

describe("snapToCell", () => {
  it("最も近いマスの境界に丸める", () => {
    expect(snapToCell(0, 50)).toBe(0);
    expect(snapToCell(24, 50)).toBe(0);
    expect(snapToCell(26, 50)).toBe(50);
    expect(snapToCell(-26, 50)).toBe(-50);
  });

  it("丸めた結果は常にマスの整数倍になる（グリッドの目が動いて見えないため）", () => {
    for (const value of [0, 1, 123.4, -987.6, 1e6]) {
      expect(snapToCell(value) % GRID_CELL).toBeCloseTo(0);
    }
  });

  it("元の値との差は半マス以内に収まる（地形の端が視界に入らないため）", () => {
    for (const value of [0, 37, -412.5, 99999]) {
      expect(Math.abs(snapToCell(value) - value)).toBeLessThanOrEqual(
        GRID_CELL / 2,
      );
    }
  });

  it("不正な値では原点に落とす", () => {
    expect(snapToCell(Number.NaN)).toBe(0);
    expect(snapToCell(Number.POSITIVE_INFINITY)).toBe(0);
    expect(snapToCell(100, 0)).toBe(0);
  });
});

describe("terrainLayout", () => {
  it("一辺はマスの整数倍になる（snapToCell の丸め単位と一致させるため）", () => {
    for (const drawDistance of [12_000, 24_000, 7_777]) {
      const { seaSize, gridSize, gridDivisions } = terrainLayout(drawDistance);
      expect(seaSize % GRID_CELL).toBeCloseTo(0);
      expect(gridSize).toBe(gridDivisions * GRID_CELL);
      expect(Number.isInteger(gridDivisions)).toBe(true);
    }
  });

  it("極端に短い描画距離でも分割数が 0 にならない", () => {
    expect(terrainLayout(1).gridDivisions).toBeGreaterThanOrEqual(2);
  });

  it("不正な描画距離でも NaN の板を作らない（無音で何も描かれない世界にしない）", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      const { seaSize, gridSize, gridDivisions } = terrainLayout(bad);
      expect(Number.isFinite(seaSize)).toBe(true);
      expect(Number.isFinite(gridSize)).toBe(true);
      expect(gridDivisions).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("視程と地形の広さの関係", () => {
  it.each(Object.values(QUALITY_PRESETS))(
    "$tier: visibility.ts の大小関係が成り立つ",
    (preset) => {
      const d = preset.drawDistance;
      const { near, far } = fogRange(d);
      const seaHalf = terrainLayout(d).seaSize / 2;

      expect(near).toBeGreaterThan(0);
      // fogFar < skyRadius: 遠景が空の球より手前で霧に溶けきる
      expect(near).toBeLessThan(far);
      expect(far).toBeLessThan(skyRadius(d));
      // skyRadius < far 面: 空の球がカメラに切られない
      expect(skyRadius(d)).toBeLessThan(d);
      // far 面 < 地形: 地平線が far 面（＝直線）で決まる。逆転すると
      // 正方形の板の角が地平線に切り欠きとして現れる
      expect(d).toBeLessThan(terrainReach(d));
      expect(seaHalf).toBeGreaterThanOrEqual(terrainReach(d) - GRID_CELL);
      expect(seaHalf).toBeGreaterThan(d);
    },
  );

  it.each(Object.values(QUALITY_PRESETS))(
    "$tier: グリッドの端は、カメラ追従のスナップを含めても霧の中に隠れる",
    (preset) => {
      const { far } = fogRange(preset.drawDistance);
      const gridHalf = terrainLayout(preset.drawDistance).gridSize / 2;
      // スナップは最大で半マス分グループを動かすので、その分の余裕が要る
      expect(gridHalf - GRID_CELL / 2).toBeGreaterThan(far);
    },
  );

  /**
   * 上限高度は視程と対で決まる。tuning.ts は静的な定数、視程は drawDistance
   * 由来の実行時の値で、両者を結ぶものがコメントしか無いと静かにずれる。
   */
  it("上限高度でも真下の地面が霧に溶けきらない（狭い方＝モバイル基準）", () => {
    const { near, far } = fogRange(QUALITY_PRESETS.mobile.drawDistance);
    const mix = (DEFAULT_TUNING.maxAltitude - near) / (far - near);
    // M1 が出荷していた組み合わせ (alt 3,000 / near 800 / far 4,000) が 0.688。
    // それより溶けなければ、体感は少なくとも M1 から悪化していない
    expect(mix).toBeLessThan(0.688);
    // 逆に霧がまったく効かない高度だと、上限を設ける意味自体が薄れる
    expect(mix).toBeGreaterThan(0.2);
  });
});

/**
 * 陸地メッシュの向きのテスト。
 *
 * `Shape` は 2D なので水平にするには X 軸まわりに -90° 回す必要があり、そこで
 * 南北の反転と巻き方向の反転という 2 つの事故が起きうる。どちらも画面を見ても
 * 「それらしい陸地」に見えてしまい、目視では絶対に気づけない。
 * orientation.test.ts と同じ理由でここに固定する。
 */
describe("陸地メッシュ", () => {
  const geometry = buildLandGeometry(EAST_ASIA_LAND);

  /** インデックス順の 3 頂点から面の法線を求める（頂点法線属性は当てにしない） */
  function faceNormal(triangle: number): Vector3 {
    const index = geometry.getIndex()!;
    const position = geometry.getAttribute("position");
    const a = new Vector3().fromBufferAttribute(
      position,
      index.getX(triangle * 3),
    );
    const b = new Vector3().fromBufferAttribute(
      position,
      index.getX(triangle * 3 + 1),
    );
    const c = new Vector3().fromBufferAttribute(
      position,
      index.getX(triangle * 3 + 2),
    );
    return new Vector3()
      .subVectors(b, a)
      .cross(new Vector3().subVectors(c, a))
      .normalize();
  }

  it("三角形の数が実データ通り（再生成でデータが激変したら落ちる）", () => {
    // eastAsia.test.ts が入力を 216 ポリゴン / 7,008 点で固定しているので、
    // 三角形分割の結果も決定論的に決まる。「> 3000」のような緩い下限だと
    // データが半分になっても通ってしまう
    expect(geometry.getIndex()!.count).toBe(19_719);
    expect(geometry.getAttribute("position").count).toBe(7_008);
  });

  it("全ての面が真上を向く（巻き方向が反転していない = 下から見た裏面にならない）", () => {
    const total = geometry.getIndex()!.count / 3;
    let upward = 0;
    for (let i = 0; i < total; i += 1) {
      if (faceNormal(i).y > 0.99) upward += 1;
    }
    // 「下を向いた面が 0 個」だと、法線が全て NaN でもジオメトリが空でも通る。
    // 「上を向いた面が全部」で数えることで空振りしない
    expect(upward).toBe(total);
    expect(total).toBeGreaterThan(0);
  });

  it("全ての頂点が y = 0 の水平面に乗る", () => {
    const position = geometry.getAttribute("position");
    let maxY = 0;
    for (let i = 0; i < position.count; i += 1) {
      maxY = Math.max(maxY, Math.abs(position.getY(i)));
    }
    expect(maxY).toBeLessThan(1e-6);
  });

  /**
   * メッシュの覆う範囲を、既にテスト済みの `isLand()` と突き合わせる。
   *
   * 原点（東京駅）だけでは南北反転を捕まえられない（反転しても原点は動かない）ので、
   * 原点から南北・東西に離れた点を含める。ソウルを南へ鏡映すると済州島の南の海に、
   * 太平洋上の点を北へ鏡映すると本州にかかる。
   */
  it.each([
    { name: "東京駅", lon: 139.7671, lat: 35.6812, land: true },
    { name: "ソウル", lon: 126.98, lat: 37.57, land: true },
    { name: "北京", lon: 116.4, lat: 39.9, land: true },
    { name: "札幌", lon: 141.35, lat: 43.06, land: true },
    { name: "ウラジオストク", lon: 131.89, lat: 43.12, land: true },
    { name: "太平洋（房総沖）", lon: 143.0, lat: 33.0, land: false },
    { name: "日本海", lon: 135.0, lat: 39.5, land: false },
    { name: "東シナ海", lon: 125.0, lat: 29.0, land: false },
  ])("$name のメッシュ被覆が陸/海判定と一致する", (point) => {
    // 判定側の前提が崩れていたら、メッシュではなくこちらが原因だと分かるようにする
    expect(EAST_ASIA_LAND.isLand(point)).toBe(point.land);
    expect(coveredByMesh(geometry, point)).toBe(point.land);
  });
});

/**
 * 穴（湖）の経路。**実データにはまだ穴が 1 つも無い**ので、合成データで守る。
 *
 * 積み残しの筆頭が「lakes レイヤを穴として合成する」で、次に触るのがまさにここ。
 * 穴側だけ `(x, -z)` の符号を落としても外周は正しく描けるため、
 * 湖だけが鏡像位置に開くという静かな壊れ方をする。
 */
describe("穴（湖）の三角形分割", () => {
  /** 原点の東に置いたドーナツ。外周は 2 度四方、穴はその中心の 0.4 度四方 */
  const donut: LandShapeSource = {
    polygons: [
      {
        rings: [
          [141, 35, 143, 35, 143, 37, 141, 37],
          [141.8, 35.8, 142.2, 35.8, 142.2, 36.2, 141.8, 36.2],
        ],
      },
    ],
  };
  const geometry = buildLandGeometry(donut);

  it("外周の内側（穴の外）は覆われる", () => {
    expect(coveredByMesh(geometry, { lon: 141.2, lat: 35.2 })).toBe(true);
    expect(coveredByMesh(geometry, { lon: 142.8, lat: 36.8 })).toBe(true);
  });

  it("穴の中心は覆われない", () => {
    expect(coveredByMesh(geometry, { lon: 142.0, lat: 36.0 })).toBe(false);
  });

  it("外周の外は覆われない", () => {
    expect(coveredByMesh(geometry, { lon: 140.5, lat: 36.0 })).toBe(false);
  });
});

describe("Terrain の深度の前後関係", () => {
  /**
   * 海面・陸地・グリッドはすべて y = 0 に重なるので、描き順ではなく
   * polygonOffset で前後を固定している。ここが崩れると z-fighting で
   * 地形がちらつくが、値を見ないと原因に辿り着けない。
   */
  interface Layer {
    readonly offset: boolean;
    readonly factor: number;
  }

  /** 実際にシーンへ入った Object3D からマテリアル設定を読む */
  function layersInScene(): { layers: Map<string, Layer>; terrain: Terrain } {
    const scene = new Scene();
    const terrain = new Terrain({ drawDistance: 24_000, land: EAST_ASIA_LAND });
    terrain.init({ scene, camera: new PerspectiveCamera() });

    const layers = new Map<string, Layer>();
    scene.traverse((object) => {
      const material = (object as { material?: unknown }).material;
      if (!material || !object.name) return;
      const first = (Array.isArray(material) ? material[0] : material) as {
        polygonOffset: boolean;
        polygonOffsetFactor: number;
      };
      layers.set(object.name, {
        offset: first.polygonOffset,
        factor: first.polygonOffsetFactor,
      });
    });
    return { layers, terrain };
  }

  it("海面は陸地より奥へ押されている（海岸線が海に食われない）", () => {
    const { layers, terrain } = layersInScene();
    const sea = layers.get("sea");
    const land = layers.get("land");

    expect(sea?.offset).toBe(true);
    expect(land?.offset).toBe(true);
    // 正の値ほど奥。海面が陸地より大きい = 海面の方が奥
    expect(sea!.factor).toBeGreaterThan(land!.factor);
    expect(land!.factor).toBeGreaterThan(0);
    terrain.dispose();
  });

  it("グリッドにはオフセットを設定しない（線分には GL 仕様上効かないため）", () => {
    const { layers, terrain } = layersInScene();
    // WebGL には POLYGON_OFFSET_FILL しか無く、GL 仕様上これは三角形の
    // ラスタライズにしか適用されない。LineSegments に設定しても完全な no-op で、
    // 「設定したのだから効いている」という誤解だけが残る。
    // 前後関係は陸地・海面の側を奥へ押し、線を 0 の最前面に残すことで作る
    expect(layers.get("grid")?.offset).toBe(false);
    expect(layers.get("grid")?.factor).toBe(0);
    terrain.dispose();
  });
});

/** ワールドの水平面で、点がいずれかの三角形に覆われているか */
function coveredByMesh(
  geometry: ReturnType<typeof buildLandGeometry>,
  position: LonLat,
): boolean {
  const { x, z } = lonLatToWorld(position);
  const index = geometry.getIndex()!;
  const attr = geometry.getAttribute("position");
  for (let i = 0; i < index.count; i += 3) {
    const ax = attr.getX(index.getX(i));
    const az = attr.getZ(index.getX(i));
    const bx = attr.getX(index.getX(i + 1));
    const bz = attr.getZ(index.getX(i + 1));
    const cx = attr.getX(index.getX(i + 2));
    const cz = attr.getZ(index.getX(i + 2));
    const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz);
    const d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz);
    const d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    // 3 つとも 0 は面積を持たない三角形。ここを「覆う」に倒すと、
    // 縮退が 1 個混ざっただけで全ての点が陸判定になりテストが無意味になる
    if (!hasNeg && !hasPos) continue;
    // 符号が揃っていれば内側（辺の上の 0 は内側に含める）
    if (!(hasNeg && hasPos)) return true;
  }
  return false;
}
