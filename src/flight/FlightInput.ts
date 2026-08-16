/**
 * 飛行モデルが必要とする入力の形。
 *
 * この型を `input/` 側ではなく飛行ドメイン側に置いているのは、
 * 「何が必要か」を決めるのは使う側（飛行モデル）だから。
 * キーボードやタッチはこの契約を実装する立場になり、飛行モデルは
 * 入力デバイスの存在を一切知らずに済む（依存関係逆転の原則）。
 */
export interface FlightInput {
  /** -1(機首下げ・降下) .. +1(機首上げ・上昇) */
  readonly pitch: number;
  /** -1(左バンク) .. +1(右バンク) */
  readonly roll: number;
  /** 羽ばたき（推力）。押している間 true */
  readonly flap: boolean;
  /** 加速。押している間 true */
  readonly boost: boolean;
}

/** 何も操作していない状態 */
export const NEUTRAL_INPUT: FlightInput = {
  pitch: 0,
  roll: 0,
  flap: false,
  boost: false,
};

/**
 * 入力の供給元。キーボード・タッチなど、実装が何であれ
 * 「今フレームの入力を 1 つ返す」ことだけを約束する。
 */
export interface InputSource {
  readonly name: string;
  /** 今フレームの入力を返す。毎フレーム 1 回だけ呼ばれる */
  read(): FlightInput;
  /** イベントリスナの解除など */
  dispose?(): void;
}
