import { describe, expect, it } from "vitest";
import { clampDelta, MAX_DELTA } from "./time";

describe("clampDelta", () => {
  it("通常の値はそのまま通す", () => {
    expect(clampDelta(1 / 60)).toBeCloseTo(1 / 60);
  });

  it("上限を超える値は丸める（タブ復帰時の巨大 dt 対策）", () => {
    expect(clampDelta(5)).toBe(MAX_DELTA);
  });

  it("上限は引数で変えられる", () => {
    expect(clampDelta(1, 0.1)).toBe(0.1);
  });

  it("0 と負値は 0 にする（時刻の巻き戻り対策）", () => {
    expect(clampDelta(0)).toBe(0);
    expect(clampDelta(-1)).toBe(0);
  });

  it("NaN と Infinity は 0 にする", () => {
    expect(clampDelta(Number.NaN)).toBe(0);
    expect(clampDelta(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("丸めた dt を積み上げても elapsed は単調増加する", () => {
    let elapsed = 0;
    for (const raw of [1 / 60, 5, Number.NaN, -3, 1 / 30]) {
      const previous = elapsed;
      elapsed += clampDelta(raw);
      expect(elapsed).toBeGreaterThanOrEqual(previous);
    }
    expect(elapsed).toBeCloseTo(1 / 60 + MAX_DELTA + 1 / 30);
  });
});
