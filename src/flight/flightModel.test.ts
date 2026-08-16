import { describe, expect, it } from "vitest";
import { stepFlight } from "./flightModel";
import { createFlightState, type FlightState } from "./FlightState";
import { NEUTRAL_INPUT, type FlightInput } from "./FlightInput";
import { DEFAULT_TUNING } from "./tuning";

const STEP = 1 / 60;

/** 指定の入力を seconds 秒ぶん流し込む */
function advance(
  state: FlightState,
  input: Partial<FlightInput>,
  seconds: number,
): FlightState {
  const full: FlightInput = { ...NEUTRAL_INPUT, ...input };
  let current = state;
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
    current = stepFlight(current, full, STEP);
  }
  return current;
}

describe("stepFlight — 入力と姿勢", () => {
  it("dt が進んでいないフレームでは状態を変えない", () => {
    const state = createFlightState();
    expect(stepFlight(state, NEUTRAL_INPUT, 0)).toBe(state);
    expect(stepFlight(state, NEUTRAL_INPUT, Number.NaN)).toBe(state);
    expect(stepFlight(state, NEUTRAL_INPUT, -1)).toBe(state);
  });

  it("渡された状態を書き換えない（純粋関数である）", () => {
    const state = createFlightState();
    const before = structuredClone(state);
    stepFlight(state, { pitch: 1, roll: -1, flap: true, boost: true }, STEP);
    expect(state).toEqual(before);
  });

  it("ピッチ入力で機首が上下する", () => {
    const up = advance(createFlightState(), { pitch: 1 }, 1);
    const down = advance(createFlightState(), { pitch: -1 }, 1);
    expect(up.pitch).toBeGreaterThan(0);
    expect(down.pitch).toBeLessThan(0);
  });

  it("機首の上下は限界角を超えない（真上・真下を向かせない）", () => {
    const high = createFlightState({ position: { x: 0, y: 90_000, z: 0 } });
    const up = advance(createFlightState(), { pitch: 1, flap: true }, 20);
    const down = advance(high, { pitch: -1 }, 20);
    expect(up.pitch).toBeLessThanOrEqual(DEFAULT_TUNING.maxPitch);
    expect(down.pitch).toBeGreaterThanOrEqual(-DEFAULT_TUNING.maxPitch);
  });

  it("ロール入力でバンクし、限界角を超えない", () => {
    const right = advance(createFlightState(), { roll: 1 }, 10);
    expect(right.roll).toBeGreaterThan(0);
    expect(right.roll).toBeLessThanOrEqual(DEFAULT_TUNING.maxRoll);
  });

  it("ロール入力を離すと水平に戻る", () => {
    const banked = advance(createFlightState(), { roll: 1 }, 2);
    const released = advance(banked, {}, 3);
    expect(Math.abs(released.roll)).toBeLessThan(Math.abs(banked.roll) * 0.2);
  });

  it("スティックが微小値で止まっていても水平へ戻る", () => {
    // 入力ちょうど 0 の時だけ戻す実装だと、ここでバンクが溜まって戻らなくなる
    const banked = advance(createFlightState(), { roll: 1 }, 2);
    const drifting = advance(banked, { roll: 0.005 }, 5);
    expect(Math.abs(drifting.roll)).toBeLessThan(Math.abs(banked.roll) * 0.3);
  });

  it("倒し込みを維持している間はバンク角が保たれる（旋回し続けられる）", () => {
    const held = advance(createFlightState(), { roll: 1 }, 5);
    expect(held.roll).toBeCloseTo(DEFAULT_TUNING.maxRoll, 2);
  });
});

describe("stepFlight — 速度", () => {
  it("機首を下げると加速し、上げると減速する（位置エネルギー ⇄ 運動エネルギー）", () => {
    const base = createFlightState();
    expect(advance(base, { pitch: -1 }, 2).speed).toBeGreaterThan(base.speed);
    expect(advance(base, { pitch: 1 }, 2).speed).toBeLessThan(base.speed);
  });

  it("羽ばたくと加速する", () => {
    const base = createFlightState();
    const flapped = advance(base, { flap: true }, 2);
    const glided = advance(base, {}, 2);
    expect(flapped.speed).toBeGreaterThan(glided.speed);
  });

  it("ブーストは羽ばたきよりさらに加速する", () => {
    const base = createFlightState();
    const flap = advance(base, { flap: true }, 2);
    const boosted = advance(base, { flap: true, boost: true }, 2);
    expect(boosted.speed).toBeGreaterThan(flap.speed);
  });

  it("抗力があるので急降下し続けても最高速度を超えない", () => {
    const high = createFlightState({ position: { x: 0, y: 500_000, z: 0 } });
    const diving = advance(high, { pitch: -1, flap: true, boost: true }, 120);
    expect(diving.speed).toBeLessThanOrEqual(DEFAULT_TUNING.maxSpeed);
  });

  it("失速速度を下回ると stalling が立つ", () => {
    const slow = createFlightState({ speed: DEFAULT_TUNING.minSpeed });
    const stepped = stepFlight(slow, { ...NEUTRAL_INPUT, pitch: 1 }, STEP);
    expect(stepped.stalling).toBe(true);
    expect(advance(createFlightState(), { flap: true }, 2).stalling).toBe(false);
  });
});

describe("stepFlight — 旋回", () => {
  it("右バンクすると右へ旋回する（yaw が減る）", () => {
    const turned = advance(createFlightState(), { roll: 1 }, 2);
    expect(turned.yaw).toBeLessThan(0);
  });

  it("左バンクすると左へ旋回する（yaw が増える）", () => {
    const turned = advance(createFlightState(), { roll: -1 }, 2);
    expect(turned.yaw).toBeGreaterThan(0);
  });

  it("水平のままでは機首方位が変わらない", () => {
    const straight = advance(createFlightState(), { flap: true }, 5);
    expect(straight.yaw).toBeCloseTo(0, 6);
  });
});

describe("stepFlight — 高度と位置", () => {
  it("yaw=0 では -z 方向へ進む（three の既定の前方）", () => {
    const moved = advance(createFlightState(), { flap: true }, 1);
    expect(moved.position.z).toBeLessThan(-50);
    expect(moved.position.x).toBeCloseTo(0, 6);
  });

  it("右へ 90° 旋回すると +x 方向へ進む（-z から見て右は +x）", () => {
    // yaw が -90° になるまで右バンクを維持し、そこから直進させる
    let state = createFlightState();
    while (state.yaw > -Math.PI / 2) {
      state = stepFlight(state, { ...NEUTRAL_INPUT, roll: 1, flap: true }, STEP);
    }
    const from = state.position;
    const moved = advance(state, { flap: true }, 1);
    expect(moved.position.x - from.x).toBeGreaterThan(50);
  });

  it("滑空すると徐々に高度が下がる", () => {
    const start = createFlightState();
    const glided = advance(start, {}, 10);
    expect(glided.position.y).toBeLessThan(start.position.y);
  });

  it("羽ばたき続ければ高度を維持できる", () => {
    const start = createFlightState();
    const flapped = advance(start, { flap: true }, 10);
    expect(flapped.position.y).toBeGreaterThanOrEqual(start.position.y - 1);
  });

  it("地面より下へは行かない（着地は M4）", () => {
    const low = createFlightState({ position: { x: 0, y: 20, z: 0 } });
    const crashed = advance(low, { pitch: -1 }, 10);
    expect(crashed.position.y).toBeGreaterThanOrEqual(DEFAULT_TUNING.minAltitude);
  });

  it("天井より上へは昇れない（霧に溶けて上下が分からなくなるのを防ぐ）", () => {
    // 羽ばたき + ブーストを機首上げで押し続けると、加速項が減速項を上回る
    const climbing = advance(
      createFlightState(),
      { pitch: 1, flap: true, boost: true },
      180,
    );
    expect(climbing.position.y).toBeLessThanOrEqual(DEFAULT_TUNING.maxAltitude);
  });
});

describe("stepFlight — 頑健性", () => {
  it("入力が -1..1 の外でもクランプされる", () => {
    const state = createFlightState();
    const sane = stepFlight(state, { ...NEUTRAL_INPUT, roll: 1, pitch: -1 }, STEP);
    const wild = stepFlight(
      state,
      { ...NEUTRAL_INPUT, roll: 100, pitch: -50 },
      STEP,
    );
    expect(wild).toEqual(sane);
  });

  it("長時間放置しても値が発散しない", () => {
    const drifting = advance(createFlightState(), {}, 120);
    expect(Number.isFinite(drifting.speed)).toBe(true);
    expect(Number.isFinite(drifting.position.x)).toBe(true);
    expect(Number.isFinite(drifting.position.y)).toBe(true);
    expect(Number.isFinite(drifting.position.z)).toBe(true);
    expect(drifting.speed).toBeLessThanOrEqual(DEFAULT_TUNING.maxSpeed);
    expect(drifting.speed).toBeGreaterThanOrEqual(DEFAULT_TUNING.minSpeed);
  });

  it("羽ばたきの位相は 0..1 に収まり続ける", () => {
    const flapped = advance(createFlightState(), { flap: true }, 60);
    expect(flapped.flapPhase).toBeGreaterThanOrEqual(0);
    expect(flapped.flapPhase).toBeLessThan(1);
  });
});
