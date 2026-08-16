import type { Scene, PerspectiveCamera } from "three";

/** 毎フレーム各システムに渡される情報 */
export interface FrameContext {
  /** 前フレームからの経過秒。異常値を避けるため上限で丸めてある */
  readonly dt: number;
  /** ゲーム開始からの経過秒 */
  readonly elapsed: number;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
}

/**
 * ゲームループから毎フレーム呼ばれる部品の共通インターフェース。
 *
 * Game はこの型しか知らないので、空・地形・鳥・UI を後から足しても
 * Game 側を書き換えずに済む（開放閉鎖原則）。
 */
export interface System {
  readonly name: string;
  /** シーンへの登録など、初期化。ループ開始前に 1 度だけ呼ばれる */
  init?(ctx: Omit<FrameContext, "dt" | "elapsed">): void;
  update?(ctx: FrameContext): void;
  /** 画面サイズ変更時 */
  resize?(width: number, height: number): void;
  /** 破棄。GPU リソースの解放に使う */
  dispose?(): void;
}
