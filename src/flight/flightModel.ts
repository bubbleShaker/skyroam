import { clamp, damp } from "../core/math";
import type { FlightInput } from "./FlightInput";
import { forwardVector, type FlightState } from "./FlightState";
import { DEFAULT_TUNING, type FlightTuning } from "./tuning";

/**
 * 飛行の 1 ステップ。**この関数が M1 の心臓部**で、three を一切知らない。
 *
 * 状態を書き換えず新しい状態を返す純粋関数にしてあるのは、飛行の体感を
 * パラメータで詰める作業の間、挙動が壊れていないことをテストで確かめ続けるため。
 * three のオブジェクトを直接動かす実装だと、確認手段がブラウザで飛んでみることしか
 * 無くなり、「旋回で速度が落ちる」といった性質を機械的に守れない。
 *
 * 飛行の規則は 4 つだけ:
 *  1. 入力で機首の向き（pitch / roll）が変わる。離すと水平に戻る
 *  2. 揚力が足りないと機首が下がる（滑空・失速）
 *  3. 機首が下向きなら加速、上向きなら減速する
 *  4. バンクしている方向へ機首方位が回る
 *
 * 2〜3 が噛み合うと、滑空中に「沈む → 加速する → 揚力が戻って機首が上がる →
 * 減速する → また沈む」という緩やかな上下動が勝手に生まれる。
 * グライダー特有の動きだが、専用のコードは書いていない。
 */
export function stepFlight(
  state: FlightState,
  input: FlightInput,
  dt: number,
  tuning: FlightTuning = DEFAULT_TUNING,
): FlightState {
  // NaN も弾く書き方。dt が進んでいないフレームでは状態をそのまま返す
  if (!(dt > 0)) return state;

  const pitchIn = clamp(input.pitch, -1, 1);
  const rollIn = clamp(input.roll, -1, 1);

  // --- 1. 姿勢 ---
  // 水平へ戻す力は「入力を離している度合い」に比例させる。倒し切っている間は
  // 戻す力が 0 になり、バンク角を維持して旋回し続けられる。
  //
  // 「入力がちょうど 0 の時だけ戻す」としないのは、スティックが 0.005 のような
  // 微小値で止まった瞬間に復帰が完全に止まり、バンクが溜まって戻らなくなるため。
  // キーボードは 0 か 1 しか返さないので、この式でも挙動は変わらない。
  let roll = state.roll + rollIn * tuning.rollRate * dt;
  roll = damp(roll, 0, tuning.rollReturn * (1 - Math.abs(rollIn)), dt);
  roll = clamp(roll, -tuning.maxRoll, tuning.maxRoll);

  let pitch = state.pitch + pitchIn * tuning.pitchRate * dt;
  pitch = damp(pitch, 0, tuning.pitchReturn * (1 - Math.abs(pitchIn)), dt);

  // --- 2. 揚力不足による機首下げ ---
  // 巡航速度に届いていない割合をそのまま「沈み具合」として使う。
  // 速度が巡航以上なら 0 になり、高度を保てる。
  const speedRatio = state.speed / tuning.cruiseSpeed;
  const liftDeficit = clamp(1 - speedRatio * speedRatio, 0, 1);
  // 羽ばたいている間は推力で揚力を賄えるものとみなす。
  // 「滑空すると降り、羽ばたけば高度を保てる」という鳥の挙動がこの 1 行で決まる。
  const sinking = input.flap ? 0 : liftDeficit;
  pitch -= sinking * tuning.stallPitchRate * dt;
  pitch = clamp(pitch, -tuning.maxPitch, tuning.maxPitch);

  // --- 3. 速度 ---
  // 機首を下げれば加速、上げれば減速（位置エネルギー ⇄ 運動エネルギー）
  let speed = state.speed - tuning.gravity * Math.sin(pitch) * dt;
  if (input.flap) speed += tuning.flapAccel * dt;
  if (input.boost) speed += tuning.boostAccel * dt;
  // 抗力は速度の 2 乗に比例する。急降下し続けても終端速度で頭打ちになる
  speed -= tuning.drag * speed * speed * dt;
  speed = clamp(speed, tuning.minSpeed, tuning.maxSpeed);

  // --- 4. バンク旋回 ---
  // three は右手系で、上から見ると yaw の増加は左回り。
  // roll は「+ が右バンク」と定義しているので、右へ曲がる = yaw を減らす。
  const yaw = state.yaw - Math.sin(roll) * tuning.turnRate * dt;

  // --- 位置 ---
  // 速度ベクトルは常に機首方向。横滑りは表現しない（鳥には十分で、規則が減る）
  const forward = forwardVector(yaw, pitch);
  const distance = speed * dt;
  let y = state.position.y + forward.y * distance;

  // 地面より下へは行かせない。着地とモード遷移は M4 で実装するので、
  // ここでは地面すれすれを水平に滑る形にとどめる。
  if (y < tuning.minAltitude) {
    y = tuning.minAltitude;
    if (pitch < 0) pitch = 0;
  } else if (y > tuning.maxAltitude) {
    // 天井。羽ばたき + ブーストを機首上げで押し続けると加速項が減速項を上回り、
    // 際限なく上昇できてしまう。霧に溶けて上下が分からなくなる高さの手前で止める。
    y = tuning.maxAltitude;
    if (pitch > 0) pitch = 0;
  }

  const flapHz = input.flap ? tuning.flapHz : tuning.glideHz;

  return {
    position: {
      x: state.position.x + forward.x * distance,
      y,
      z: state.position.z + forward.z * distance,
    },
    yaw,
    pitch,
    roll,
    speed,
    // 位相は 0..1 で循環させる。累積したままだと長時間飛行で精度が落ちる
    flapPhase: (state.flapPhase + flapHz * dt) % 1,
    flapping: input.flap,
    stalling: speed < tuning.stallSpeed,
  };
}
