import {
  Color,
  GridHelper,
  Group,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
} from "three";
import type { FrameContext, InitContext, System } from "../core/System";

/** 暫定地面の一辺 (m)。fog の距離を決める側もこの値を参照する */
export const GROUND_SIZE = 8_000;
const GRID_DIVISIONS = 160;
/** グリッド 1 マスの一辺 (m)。カメラ追従の折り返し単位に使う */
export const GROUND_CELL = GROUND_SIZE / GRID_DIVISIONS;

/**
 * 値を cell の整数倍に丸める。
 * グリッドをカメラ直下へスナップさせ、有限のグリッドを無限に見せるために使う。
 */
export function snapToCell(value: number, cell: number = GROUND_CELL): number {
  if (!Number.isFinite(value) || cell <= 0) return 0;
  return Math.round(value / cell) * cell;
}

/**
 * M0 の暫定地面。M2 で実際の地形に置き換わる。
 *
 * グリッドをカメラの真下へ 1 マス単位でスナップさせ続けることで、
 * 有限のグリッドを無限に続いているように見せる（見えている端がいつも同じ位置）。
 */
export class Ground implements System {
  readonly name = "ground";

  private readonly group = new Group();
  private readonly plane: Mesh<PlaneGeometry, MeshLambertMaterial>;
  private readonly grid: GridHelper;

  constructor() {
    this.plane = new Mesh(
      new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new MeshLambertMaterial({ color: new Color("#2f4a34") }),
    );
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.receiveShadow = true;

    this.grid = new GridHelper(
      GROUND_SIZE,
      GRID_DIVISIONS,
      new Color("#5d7a63"),
      new Color("#3d5744"),
    );
    // 高さでずらすと遠方では深度分解能に埋もれて z-fighting する。
    // polygonOffset は深度値そのものをずらすので距離に依らず効く。
    const gridMaterials = Array.isArray(this.grid.material)
      ? this.grid.material
      : [this.grid.material];
    for (const material of gridMaterials) {
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -1;
      material.depthWrite = false;
    }

    this.group.add(this.plane, this.grid);
  }

  init(ctx: InitContext): void {
    ctx.scene.add(this.group);
  }

  lateUpdate(ctx: FrameContext): void {
    const { x, z } = ctx.camera.position;
    this.group.position.set(snapToCell(x), 0, snapToCell(z));
  }

  dispose(): void {
    this.plane.geometry.dispose();
    this.plane.material.dispose();
    this.grid.dispose();
    this.group.removeFromParent();
  }
}
