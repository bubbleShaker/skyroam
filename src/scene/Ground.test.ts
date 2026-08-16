import { describe, expect, it } from "vitest";
import { snapToCell, GROUND_CELL, GROUND_SIZE } from "./Ground";

describe("snapToCell", () => {
  it("最も近いマスの境界に丸める", () => {
    expect(snapToCell(0, 50)).toBe(0);
    expect(snapToCell(24, 50)).toBe(0);
    expect(snapToCell(26, 50)).toBe(50);
    expect(snapToCell(-26, 50)).toBe(-50);
  });

  it("丸めた結果は常にマスの整数倍になる（グリッドの目が動いて見えないため）", () => {
    for (const value of [0, 1, 123.4, -987.6, 1e6]) {
      expect(snapToCell(value) % GROUND_CELL).toBeCloseTo(0);
    }
  });

  it("元の値との差は半マス以内に収まる（地面の端が視界に入らないため）", () => {
    for (const value of [0, 37, -412.5, 99999]) {
      expect(Math.abs(snapToCell(value) - value)).toBeLessThanOrEqual(
        GROUND_CELL / 2,
      );
    }
  });

  it("不正な値では原点に落とす", () => {
    expect(snapToCell(Number.NaN)).toBe(0);
    expect(snapToCell(Number.POSITIVE_INFINITY)).toBe(0);
    expect(snapToCell(100, 0)).toBe(0);
  });
});

describe("地面の寸法", () => {
  it("マスが地面を割り切る", () => {
    expect(GROUND_SIZE % GROUND_CELL).toBeCloseTo(0);
  });
});
