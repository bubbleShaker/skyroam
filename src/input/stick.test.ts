import { describe, expect, it } from "vitest";
import { readStick, STICK_DEADZONE } from "./stick";

const RADIUS = 100;

describe("readStick", () => {
  it("中心では入力なし", () => {
    expect(readStick(0, 0, RADIUS)).toEqual({
      roll: 0,
      pitch: 0,
      knobX: 0,
      knobY: 0,
    });
  });

  it("デッドゾーン内の微動は無視する", () => {
    const tiny = readStick(RADIUS * STICK_DEADZONE * 0.5, 0, RADIUS);
    expect(tiny.roll).toBe(0);
    expect(tiny.pitch).toBe(0);
  });

  it("右へ倒し切ると roll が +1、左で -1", () => {
    expect(readStick(RADIUS, 0, RADIUS).roll).toBeCloseTo(1);
    expect(readStick(-RADIUS, 0, RADIUS).roll).toBeCloseTo(-1);
  });

  it("上へ倒すと機首上げになる（画面の y は下向きが正なので反転する）", () => {
    expect(readStick(0, -RADIUS, RADIUS).pitch).toBeCloseTo(1);
    expect(readStick(0, RADIUS, RADIUS).pitch).toBeCloseTo(-1);
  });

  it("半径を超えて倒しても 1 を超えない", () => {
    const far = readStick(RADIUS * 5, 0, RADIUS);
    expect(far.roll).toBeCloseTo(1);
    expect(far.knobX).toBeCloseTo(RADIUS);
  });

  it("斜めに倒しても合成量は 1 を超えない（軸ごとではなく距離でクランプする）", () => {
    const diagonal = readStick(RADIUS, RADIUS, RADIUS);
    const magnitude = Math.hypot(diagonal.roll, diagonal.pitch);
    expect(magnitude).toBeLessThanOrEqual(1 + 1e-9);
    expect(magnitude).toBeCloseTo(1);
  });

  it("デッドゾーンの境界で入力が飛び跳ねない", () => {
    const justInside = readStick(RADIUS * (STICK_DEADZONE - 0.001), 0, RADIUS);
    const justOutside = readStick(RADIUS * (STICK_DEADZONE + 0.001), 0, RADIUS);
    expect(justInside.roll).toBe(0);
    expect(justOutside.roll).toBeLessThan(0.01);
  });

  it("つまみの表示位置は指に追従する（デッドゾーンを引かない）", () => {
    const inside = readStick(RADIUS * STICK_DEADZONE * 0.5, 0, RADIUS);
    expect(inside.knobX).toBeCloseTo(RADIUS * STICK_DEADZONE * 0.5);
  });

  it("不正な値では入力なしにする", () => {
    expect(readStick(Number.NaN, 0, RADIUS).roll).toBe(0);
    expect(readStick(10, 10, 0).roll).toBe(0);
  });
});
