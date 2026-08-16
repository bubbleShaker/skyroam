import type { FrameContext, System } from "../core/System";

/** 表示更新の間隔 (秒)。毎フレーム DOM を触ると無駄が大きい */
const REFRESH_INTERVAL = 0.25;

/**
 * 画面左上のテキスト HUD。
 *
 * 行の内容は `set(key, value)` で外から差し込む。HUD 自身は何を表示するか知らないので、
 * 後続の高度・座標・国名 (M7) などをこのクラスを変更せずに追加できる。
 */
export class Hud implements System {
  readonly name = "hud";

  private readonly lines = new Map<string, string>();
  private sinceRefresh = 0;
  private frames = 0;
  private fpsWindow = 0;

  constructor(private readonly element: HTMLElement) {}

  set(key: string, value: string): void {
    this.lines.set(key, value);
  }

  update(ctx: FrameContext): void {
    this.frames += 1;
    this.fpsWindow += ctx.dt;
    this.sinceRefresh += ctx.dt;
    if (this.sinceRefresh < REFRESH_INTERVAL) return;

    const fps = this.fpsWindow > 0 ? this.frames / this.fpsWindow : 0;
    this.set("fps", fps.toFixed(0));
    this.frames = 0;
    this.fpsWindow = 0;
    this.sinceRefresh = 0;

    this.element.textContent = [...this.lines]
      .map(([key, value]) => `${key.padEnd(8)} ${value}`)
      .join("\n");
  }

  dispose(): void {
    this.lines.clear();
    this.element.textContent = "";
  }
}
