/** 仮想スティックの読み取り結果 */
export interface StickReading {
  /** -1(左) .. +1(右) */
  readonly roll: number;
  /** -1(降下) .. +1(上昇) */
  readonly pitch: number;
  /** つまみの表示位置 (px)。指の位置をそのまま反映する（デッドゾーンを引かない） */
  readonly knobX: number;
  readonly knobY: number;
}

/** これ未満の倒し込みは無視する。指の微動で機体が揺れ続けるのを防ぐ */
export const STICK_DEADZONE = 0.12;

/**
 * スティック中心からの指のずれ (px) を飛行入力に変換する。
 *
 * DOM を触らない純粋関数にしてあるので、デッドゾーンと円形クランプの
 * 正しさだけをブラウザ無しでテストできる。
 *
 * 半径でクランプするのを縦横別々ではなく**距離**で行うのが要点。
 * 軸ごとにクランプすると、斜めに倒した時だけ合成量が √2 倍になり、
 * 斜め方向が不自然に速く効いてしまう。
 */
export function readStick(
  dx: number,
  dy: number,
  radius: number,
  deadzone: number = STICK_DEADZONE,
): StickReading {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || radius <= 0) {
    return { roll: 0, pitch: 0, knobX: 0, knobY: 0 };
  }

  const length = Math.hypot(dx, dy);
  if (length === 0) return { roll: 0, pitch: 0, knobX: 0, knobY: 0 };

  const magnitude = Math.min(length / radius, 1);
  const unitX = dx / length;
  const unitY = dy / length;

  // デッドゾーンぶんを差し引いた上で 0..1 に引き伸ばす。
  // 単に切り捨てるだけだと、デッドゾーンの境界で入力が飛び跳ねる。
  const effective =
    magnitude < deadzone ? 0 : (magnitude - deadzone) / (1 - deadzone);

  const knobX = unitX * magnitude * radius;
  const knobY = unitY * magnitude * radius;

  // effective が 0 のとき、単に掛けるだけだと符号付きゼロ (-0) が残る。
  // 値としては 0 と等しいが、HUD 表示や比較で紛れるので明示的に 0 を返す。
  if (effective === 0) return { roll: 0, pitch: 0, knobX, knobY };

  return {
    roll: unitX * effective,
    // 画面の y は下向きが正。スティックを上へ倒す = 機首上げ にするため反転する
    pitch: -unitY * effective,
    knobX,
    knobY,
  };
}
