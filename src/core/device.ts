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
  /**
   * GPU の選択ヒント。スマホで "high-performance" を指定すると発熱と電池消費が
   * 増え、サーマルスロットリングでかえって fps が落ちるため "default" にする。
   */
  readonly powerPreference: WebGLPowerPreference;
}

const MOBILE: QualityPreset = {
  tier: "mobile",
  maxPixelRatio: 1.5,
  shadows: false,
  drawDistance: 12_000,
  antialias: false,
  powerPreference: "default",
};

const DESKTOP: QualityPreset = {
  tier: "desktop",
  maxPixelRatio: 2,
  shadows: true,
  drawDistance: 24_000,
  antialias: true,
  powerPreference: "high-performance",
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

/**
 * プリセット上限と実機の devicePixelRatio の小さい方を採る。
 *
 * ブラウザ API から切り離した純粋関数にしてあるのは、この計算だけを
 * テストできるようにするため（呼び出し側の resolvePixelRatio が window を読む）。
 */
export function pickPixelRatio(
  devicePixelRatio: number,
  preset: QualityPreset,
): number {
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  return Math.min(dpr, preset.maxPixelRatio);
}

export function resolvePixelRatio(preset: QualityPreset): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return pickPixelRatio(dpr, preset);
}

/** テスト用にプリセットを参照するための公開 */
export const QUALITY_PRESETS = { mobile: MOBILE, desktop: DESKTOP } as const;
