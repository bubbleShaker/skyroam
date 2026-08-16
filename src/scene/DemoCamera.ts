import type { FrameContext, System } from "../core/System";

/**
 * M0 だけの暫定カメラ。原点上空をゆっくり周回して、描画が生きていることを示す。
 * M1 で鳥の追従カメラに置き換わる。
 */
export class DemoCamera implements System {
  readonly name = "demo-camera";

  constructor(
    private readonly radius = 420,
    private readonly height = 160,
    /** 1 周にかける秒数 */
    private readonly period = 48,
  ) {}

  update(ctx: FrameContext): void {
    const angle = (ctx.elapsed / this.period) * Math.PI * 2;
    ctx.camera.position.set(
      Math.cos(angle) * this.radius,
      this.height,
      Math.sin(angle) * this.radius,
    );
    ctx.camera.lookAt(0, 40, 0);
  }
}
