/** 汎用の数値ユーティリティ。three に依存しない */

export function clamp(value: number, min: number, max: number): number {
  // 非有限値では、レンジ内で最も 0 に近い値へ倒す。
  // min を返すと -1..1 のような対称レンジで「フルに倒し切った入力」になり、
  // 異常値が一番危険な操作に化ける。
  if (!Number.isFinite(value)) return Math.min(Math.max(0, min), max);
  return Math.min(Math.max(value, min), max);
}

/**
 * 指数減衰による平滑化。current を target へ、rate の速さで近づける。
 *
 * `current + (target - current) * 0.1` のような固定係数の補間はフレームレートに
 * 依存し、144Hz の PC と 30fps のスマホで追従速度が別物になる。
 * この形なら dt をどう刻んでも同じ時間で同じところまで到達する。
 *
 * rate は「1 秒でどれだけ縮むか」の尺度で、rate=1 なら 1 秒で残差が約 37% に減る。
 */
export function damp(
  current: number,
  target: number,
  rate: number,
  dt: number,
): number {
  return current + (target - current) * dampFactor(rate, dt);
}

/**
 * damp と同じ考え方の補間係数だけを返す。
 * three の Vector3.lerp のように「係数を受け取る API」に渡すために分けてある。
 */
export function dampFactor(rate: number, dt: number): number {
  if (!(dt > 0) || rate <= 0) return 0;
  return 1 - Math.exp(-rate * dt);
}

/** 度をラジアンに変換する */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
