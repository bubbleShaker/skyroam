import { degToRad } from "../core/math";

/**
 * 飛行の体感を決める数値。**操作感を変えたい時に触るのはこのファイルだけ**。
 *
 * 飛行モデル (flightModel.ts) はここから値を受け取るだけで、定数を持たない。
 * 「ルール」と「効き具合」を分けておくと、調整でロジックを壊さずに済む。
 */
export interface FlightTuning {
  /** 入力 1.0 のときのピッチ変化速度 (rad/s) */
  readonly pitchRate: number;
  /** 入力 1.0 のときのロール変化速度 (rad/s) */
  readonly rollRate: number;
  /** 機首の上下の限界 (rad)。真上・真下を向かせないことでジンバルロックを避ける */
  readonly maxPitch: number;
  /** バンク角の限界 (rad) */
  readonly maxRoll: number;
  /** ピッチ入力を離した時に水平へ戻る速さ */
  readonly pitchReturn: number;
  /** ロール入力を離した時に水平へ戻る速さ */
  readonly rollReturn: number;
  /** バンク角 90° 相当のときの旋回速度 (rad/s) */
  readonly turnRate: number;
  /** 機首の上下による加減速の強さ (m/s^2)。実際の重力より大きくして機敏にしている */
  readonly gravity: number;
  /** 速度の 2 乗に掛かる抗力係数。最高速度を決めるのは実質この値 */
  readonly drag: number;
  /** 羽ばたき中の加速 (m/s^2) */
  readonly flapAccel: number;
  /** ブースト中の追加加速 (m/s^2) */
  readonly boostAccel: number;
  /** 揚力が釣り合う速さ (m/s)。これを超えると高度を維持できる */
  readonly cruiseSpeed: number;
  /** これを下回ると HUD に失速警告を出す (m/s) */
  readonly stallSpeed: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  /** 揚力が完全に足りない時の機首下げ速度 (rad/s) */
  readonly stallPitchRate: number;
  /** これより下へは降りられない高度 (m)。着地は M4 で実装する */
  readonly minAltitude: number;
  /** これより上へは昇れない高度 (m)。霧に溶けて上下が分からなくなる手前に置く */
  readonly maxAltitude: number;
  /** 羽ばたき中の羽ばたき周波数 (Hz) */
  readonly flapHz: number;
  /** 滑空中に翼がゆっくり動く周波数 (Hz) */
  readonly glideHz: number;
}

export const DEFAULT_TUNING: FlightTuning = {
  pitchRate: 1.2,
  rollRate: 2.2,
  maxPitch: degToRad(80),
  maxRoll: degToRad(75),
  pitchReturn: 0.8,
  rollReturn: 2.5,
  turnRate: 1.4,
  gravity: 30,
  // 急降下時に maxSpeed 付近で釣り合う値: gravity / maxSpeed^2 ≒ 6e-4
  drag: 6e-4,
  flapAccel: 45,
  boostAccel: 60,
  cruiseSpeed: 90,
  stallSpeed: 45,
  minSpeed: 15,
  maxSpeed: 220,
  stallPitchRate: 0.9,
  minAltitude: 2,
  // main.ts の fogFar (GROUND_SIZE * 0.5 = 4000) より下。
  // 霧より上へ出ると地面が完全に溶けて、自分が上下どちらを向いているか分からなくなる
  maxAltitude: 3_000,
  flapHz: 2.5,
  glideHz: 0.25,
};
