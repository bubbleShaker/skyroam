import { describe, expect, it } from "vitest";
import { pickPixelRatio, QUALITY_PRESETS } from "./device";

const { mobile, desktop } = QUALITY_PRESETS;

describe("pickPixelRatio", () => {
  it("プリセットの上限で頭打ちにする", () => {
    // 昨今のスマホは DPR 3 以上。そのまま描くと描画ピクセルが 4 倍になる
    expect(pickPixelRatio(3, mobile)).toBe(mobile.maxPixelRatio);
    expect(pickPixelRatio(3, desktop)).toBe(desktop.maxPixelRatio);
  });

  it("上限より低い DPR はそのまま使う", () => {
    expect(pickPixelRatio(1, mobile)).toBe(1);
    expect(pickPixelRatio(1.25, desktop)).toBe(1.25);
  });

  it("不正な DPR は 1 として扱う", () => {
    expect(pickPixelRatio(0, mobile)).toBe(1);
    expect(pickPixelRatio(-2, mobile)).toBe(1);
    expect(pickPixelRatio(Number.NaN, mobile)).toBe(1);
  });
});

describe("品質プリセット", () => {
  it("モバイルはデスクトップより軽い設定になっている", () => {
    expect(mobile.maxPixelRatio).toBeLessThan(desktop.maxPixelRatio);
    expect(mobile.drawDistance).toBeLessThan(desktop.drawDistance);
    expect(mobile.shadows).toBe(false);
    expect(mobile.antialias).toBe(false);
  });

  it("モバイルは発熱を避けるため GPU を高性能側に倒さない", () => {
    expect(mobile.powerPreference).toBe("default");
  });
});
