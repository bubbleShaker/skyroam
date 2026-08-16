import type { System } from "../core/System";

/** 表示更新の間隔 (ms)。毎フレーム DOM を触ると無駄が大きい */
const REFRESH_INTERVAL_MS = 250;

/**
 * 画面左上のテキスト HUD。
 *
 * 行の内容は `set(key, value)` で外から差し込む。HUD 自身は何を表示するか知らないので、
 * 後続の高度・座標・国名 (M7) などをこのクラスを変更せずに追加できる。
 */
export class Hud implements System {
  readonly name = "hud";

  private readonly lines = new Map<string, string>();
  private frames = 0;
  private lastSampleAt = 0;

  constructor(private readonly element: HTMLElement) {}

  set(key: string, value: string): void {
    this.lines.set(key, value);
  }

  init(): void {
    this.lastSampleAt = performance.now();
  }

  /**
   * fps は FrameContext の dt ではなく performance.now() の実経過で測る。
   * dt は MAX_DELTA で丸められているため、実測 5fps でも 15fps と表示されてしまい、
   * 性能が落ちた時にこそ嘘をつく指標になる。
   */
  update(): void {
    this.frames += 1;
    const now = performance.now();
    const windowMs = now - this.lastSampleAt;
    if (windowMs < REFRESH_INTERVAL_MS) return;

    this.set("fps", ((this.frames * 1000) / windowMs).toFixed(0));
    this.frames = 0;
    this.lastSampleAt = now;

    this.element.textContent = [...this.lines]
      .map(([key, value]) => `${key.padEnd(8)} ${value}`)
      .join("\n");
  }

  dispose(): void {
    this.lines.clear();
    this.element.textContent = "";
  }
}
