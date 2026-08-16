import {
  Clock,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type WebGLRendererParameters,
} from "three";
import type { FrameContext, System } from "./System";
import { detectQuality, resolvePixelRatio, type QualityPreset } from "./device";

/** dt の上限 (秒)。タブ復帰時に巨大な dt が入り、物理が破綻するのを防ぐ */
const MAX_DELTA = 1 / 15;

/**
 * レンダラ・シーン・カメラの生成とメインループだけを持つ。
 * ゲーム内容は System として外から差し込む。
 */
export class Game {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly quality: QualityPreset;

  private readonly clock = new Clock();
  private readonly systems: System[] = [];
  private frameId = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.quality = detectQuality();

    const params: WebGLRendererParameters = {
      canvas,
      antialias: this.quality.antialias,
      powerPreference: "high-performance",
    };
    this.renderer = new WebGLRenderer(params);
    this.renderer.setPixelRatio(resolvePixelRatio(this.quality));
    this.renderer.shadowMap.enabled = this.quality.shadows;

    this.camera = new PerspectiveCamera(
      70,
      1,
      0.1,
      this.quality.drawDistance,
    );
    this.camera.position.set(0, 120, 0);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  add(system: System): this {
    system.init?.({ scene: this.scene, camera: this.camera });
    this.systems.push(system);
    return this;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    for (const system of this.systems) system.dispose?.();
    this.systems.length = 0;
    this.renderer.dispose();
  }

  private loop = (): void => {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), MAX_DELTA);
    const ctx: FrameContext = {
      dt,
      elapsed: this.clock.elapsedTime,
      scene: this.scene,
      camera: this.camera,
    };
    for (const system of this.systems) system.update?.(ctx);

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // 第 3 引数 false: canvas の CSS サイズは style.css 側の 100% に任せる
    this.renderer.setSize(width, height, false);
    for (const system of this.systems) system.resize?.(width, height);
  };

  /**
   * 非表示のタブでループを回し続けるとバッテリーを浪費するため止める。
   * 復帰時は Clock を作り直して巨大な dt が入らないようにする。
   */
  private handleVisibility = (): void => {
    if (document.hidden) {
      this.stop();
    } else {
      this.clock.getDelta();
      this.start();
    }
  };
}
