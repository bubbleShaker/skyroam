import {
  PerspectiveCamera,
  Scene,
  Timer,
  WebGLRenderer,
  type WebGLRendererParameters,
} from "three";
import type { FrameContext, System } from "./System";
import { clampDelta } from "./time";
import { detectQuality, resolvePixelRatio, type QualityPreset } from "./device";

/**
 * レンダラ・シーン・カメラの生成とメインループだけを持つ。
 * ゲーム内容は System として外から差し込む。
 */
export class Game {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly quality: QualityPreset;

  /**
   * three の Clock は r183 で非推奨。Timer は document に connect すると
   * Page Visibility API を使い、タブ復帰時に内部時刻を reset して
   * 巨大な delta が出ないようにしてくれる。
   */
  private readonly timer = new Timer();
  /** 丸めた dt の累積。Timer.getElapsed() は未加工の累積なので使わない */
  private elapsed = 0;

  private readonly systems: System[] = [];
  private width = 0;
  private height = 0;
  private frameId = 0;
  private running = false;
  /** stop() が明示的に呼ばれたか。タブ復帰時に勝手に再開しないための区別 */
  private pausedByUser = false;

  constructor(canvas: HTMLCanvasElement) {
    this.quality = detectQuality();

    const params: WebGLRendererParameters = {
      canvas,
      antialias: this.quality.antialias,
      powerPreference: this.quality.powerPreference,
    };
    this.renderer = new WebGLRenderer(params);
    this.renderer.shadowMap.enabled = this.quality.shadows;

    this.camera = new PerspectiveCamera(
      70,
      1,
      // near を 1 にする: near/far の比が大きすぎると遠景の深度分解能が
      // メートル級になり、地面とグリッド線が z-fighting する
      1,
      this.quality.drawDistance,
    );
    this.camera.position.set(0, 120, 0);

    this.timer.connect(document);
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  add(system: System): this {
    system.init?.({ scene: this.scene, camera: this.camera });
    // コンストラクタ時点の handleResize では systems が空なので、
    // 追加した System にはここで現在のサイズを届ける
    system.resize?.(this.width, this.height);
    this.systems.push(system);
    return this;
  }

  start(): void {
    this.pausedByUser = false;
    this.resume();
  }

  stop(): void {
    this.pausedByUser = true;
    this.suspend();
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.timer.dispose();
    for (const system of this.systems) system.dispose?.();
    this.systems.length = 0;
    this.renderer.dispose();
  }

  private resume(): void {
    if (this.running) return;
    this.running = true;
    this.timer.reset();
    this.loop();
  }

  private suspend(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(this.loop);

    this.timer.update();
    const dt = clampDelta(this.timer.getDelta());
    this.elapsed += dt;

    const ctx: FrameContext = {
      dt,
      elapsed: this.elapsed,
      scene: this.scene,
      camera: this.camera,
    };
    for (const system of this.systems) system.update?.(ctx);
    for (const system of this.systems) system.lateUpdate?.(ctx);

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    // 外部モニタへの移動やブラウザズームで DPR は変わりうるので毎回評価する
    this.renderer.setPixelRatio(resolvePixelRatio(this.quality));
    // 第 3 引数 false: canvas の CSS サイズは style.css 側の 100% に任せる
    this.renderer.setSize(this.width, this.height, false);
    for (const system of this.systems) system.resize?.(this.width, this.height);
  };

  /**
   * 非表示のタブでループを回し続けるとバッテリーを浪費するため止める。
   * ただし stop() で明示的に止めていた場合は、復帰しても再開しない。
   */
  private handleVisibility = (): void => {
    if (document.hidden) {
      this.suspend();
    } else if (!this.pausedByUser) {
      this.resume();
    }
  };
}
