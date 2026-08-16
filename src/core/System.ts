import type { Scene, PerspectiveCamera } from "three";

/** 毎フレーム各システムに渡される情報 */
export interface FrameContext {
  /** 前フレームからの経過秒。異常値を避けるため上限で丸めてある */
  readonly dt: number;
  /** ゲーム開始からの経過秒。丸めた dt の累積なので、常に Σdt と一致する */
  readonly elapsed: number;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
}

/** 初期化時に渡される情報（時間はまだ流れていない） */
export type InitContext = Pick<FrameContext, "scene" | "camera">;

/**
 * ゲームループから毎フレーム呼ばれる部品の共通インターフェース。
 *
 * Game はこの型しか知らないので、空・地形・鳥・UI を後から足しても
 * Game 側を書き換えずに済む（開放閉鎖原則）。
 */
export interface System {
  readonly name: string;
  /** シーンへの登録など、初期化。ループ開始前に 1 度だけ呼ばれる */
  init?(ctx: InitContext): void;
  /** 通常の更新。カメラを動かす側はこちらを使う */
  update?(ctx: FrameContext): void;
  /**
   * 全システムの update 後に呼ばれる。
   * カメラに追従する System（空・地面）はこちらで位置を合わせる。
   * update でやると 1 フレーム前のカメラ位置を見てしまい、高速移動時にズレる。
   */
  lateUpdate?(ctx: FrameContext): void;
  /** 画面サイズ変更時。add() 直後にも現在のサイズで 1 度呼ばれる */
  resize?(width: number, height: number): void;
  /** 破棄。GPU リソースの解放に使う */
  dispose?(): void;
}
