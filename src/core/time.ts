/**
 * フレーム間経過時間 (dt) の上限 (秒)。
 *
 * タブ復帰や GC ストールで巨大な dt が入ると、物理が 1 フレームで壁を貫通したり
 * 発散したりする。上限で丸めることで「遅い時はスローモーションになる」に倒す。
 * 1/15 秒 = 15fps 相当。
 */
export const MAX_DELTA = 1 / 15;

/**
 * dt を安全な範囲に丸める。
 *
 * 負値・NaN・Infinity は 0 にする。タイマーの実装や時刻の巻き戻り
 * （システム時刻変更など）で異常値が来ても、呼び出し側が壊れないようにするため。
 */
export function clampDelta(raw: number, max: number = MAX_DELTA): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, max);
}
