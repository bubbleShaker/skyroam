import {
  Color,
  GridHelper,
  Group,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  type Scene,
} from "three";
import type { FrameContext, System } from "../core/System";

const GRID_SIZE = 4_000;
const GRID_DIVISIONS = 80;
/** グリッド 1 マスの一辺 (m)。カメラ追従の折り返し単位に使う */
const CELL = GRID_SIZE / GRID_DIVISIONS;

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
      new PlaneGeometry(GRID_SIZE, GRID_SIZE),
      new MeshLambertMaterial({ color: new Color("#2f4a34") }),
    );
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.receiveShadow = true;

    this.grid = new GridHelper(
      GRID_SIZE,
      GRID_DIVISIONS,
      new Color("#5d7a63"),
      new Color("#3d5744"),
    );
    // グリッドが地面と同一平面だと z-fighting するのでわずかに浮かせる
    this.grid.position.y = 0.05;

    this.group.add(this.plane, this.grid);
  }

  init(ctx: { scene: Scene }): void {
    ctx.scene.add(this.group);
  }

  update(ctx: FrameContext): void {
    const { x, z } = ctx.camera.position;
    this.group.position.set(
      Math.round(x / CELL) * CELL,
      0,
      Math.round(z / CELL) * CELL,
    );
  }

  dispose(): void {
    this.plane.geometry.dispose();
    this.plane.material.dispose();
    this.grid.dispose();
    this.group.removeFromParent();
  }
}
