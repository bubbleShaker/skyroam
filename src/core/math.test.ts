import { describe, expect, it } from "vitest";
import { clamp, damp, dampFactor, degToRad } from "./math";

describe("clamp", () => {
  it("範囲内はそのまま、範囲外は端に丸める", () => {
    expect(clamp(0.5, -1, 1)).toBe(0.5);
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
  });

  it("非有限値は範囲内で最も 0 に近い値にする（フル入力に化けさせない）", () => {
    // min を返す実装だと、-1..1 では「フルに倒し切った操作」になってしまう
    expect(clamp(Number.NaN, -1, 1)).toBe(0);
    expect(clamp(Number.POSITIVE_INFINITY, -1, 1)).toBe(0);
    expect(clamp(Number.NaN, 10, 20)).toBe(10);
    expect(clamp(Number.NaN, -20, -10)).toBe(-10);
  });
});

describe("damp", () => {
  it("目標へ近づくが、1 ステップでは到達しない", () => {
    const stepped = damp(0, 100, 5, 1 / 60);
    expect(stepped).toBeGreaterThan(0);
    expect(stepped).toBeLessThan(100);
  });

  /**
   * この PR の主張の土台。固定係数の補間だと 60fps と 30fps で
   * 追従速度が変わってしまうので、そうなっていないことを固定する。
   */
  it("同じ時間だけ進めれば、フレームレートが違っても同じ地点に来る", () => {
    let fast = 0;
    for (let i = 0; i < 60; i += 1) fast = damp(fast, 100, 4, 1 / 60);

    let slow = 0;
    for (let i = 0; i < 30; i += 1) slow = damp(slow, 100, 4, 1 / 30);

    let veryFast = 0;
    for (let i = 0; i < 240; i += 1) veryFast = damp(veryFast, 100, 4, 1 / 240);

    expect(slow).toBeCloseTo(fast, 1);
    expect(veryFast).toBeCloseTo(fast, 1);
  });

  it("dt が進んでいない、または rate が 0 以下なら動かさない", () => {
    expect(damp(3, 100, 5, 0)).toBe(3);
    expect(damp(3, 100, 5, Number.NaN)).toBe(3);
    expect(damp(3, 100, 5, -1)).toBe(3);
    expect(damp(3, 100, 0, 1 / 60)).toBe(3);
    expect(damp(3, 100, -2, 1 / 60)).toBe(3);
  });
});

describe("dampFactor", () => {
  it("0..1 の補間係数を返す", () => {
    expect(dampFactor(5, 1 / 60)).toBeGreaterThan(0);
    expect(dampFactor(5, 1 / 60)).toBeLessThan(1);
    expect(dampFactor(5, 0)).toBe(0);
    expect(dampFactor(0, 1)).toBe(0);
  });

  it("dt が長いほど 1 に近づく", () => {
    expect(dampFactor(5, 10)).toBeGreaterThan(dampFactor(5, 0.1));
    expect(dampFactor(5, 100)).toBeCloseTo(1);
  });
});

describe("degToRad", () => {
  it("度をラジアンに変換する", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2);
  });
});
