/**
 * デバイス判定と描画品質プリセット。
 *
 * スマホは画面の物理解像度が高い一方で GPU が弱いため、PC と同じ設定で描くと
 * すぐにフレームレートが落ちる。ここで「どこまで描くか」を 1 箇所に集約し、
 * 各システムはこのプリセットを読むだけにする。
 */

export type QualityTier = "mobile" | "desktop";

export interface QualityPreset {
  readonly tier: QualityTier;
  /** devicePixelRatio の上限。2 を超える描画は体感差の割にコストが高い */
  readonly maxPixelRatio: number;
  /** 影を落とすか */
  readonly shadows: boolean;
  /** カメラの描画距離 (m)。遠景をどこまで見せるか */
  readonly drawDistance: number;
  /** アンチエイリアス */
  readonly antialias: boolean;
}

const MOBILE: QualityPreset = {
  tier: "mobile",
  maxPixelRatio: 1.5,
  shadows: false,
  drawDistance: 12_000,
  antialias: false,
};

const DESKTOP: QualityPreset = {
  tier: "desktop",
  maxPixelRatio: 2,
  shadows: true,
  drawDistance: 24_000,
  antialias: true,
};

/**
 * タッチ主体の端末か判定する。
 * UA 文字列は詐称・変更が多いので、入力方式 (pointer: coarse) を主な根拠にする。
 */
export function isTouchPrimary(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const hasTouch = navigator.maxTouchPoints > 0;
  return coarse && hasTouch;
}

export function detectQuality(): QualityPreset {
  return isTouchPrimary() ? MOBILE : DESKTOP;
}

/** プリセット上限と実機の devicePixelRatio の小さい方を採る */
export function resolvePixelRatio(preset: QualityPreset): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(dpr, preset.maxPixelRatio);
}
