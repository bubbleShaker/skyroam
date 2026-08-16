import { describe, expect, it } from "vitest";
import { EAST_ASIA_LAND } from "./eastAsia";
import type { LonLat } from "./geo";

/**
 * 実データが本当に東アジアの形になっているかを、地理の事実で確かめる。
 *
 * 判定アルゴリズム自体は landmass.test.ts で合成データを使って固定してある。
 * こちらは「クリップや間引きで日本列島が消えていないか」を見るためのもの。
 */

const ON_LAND: Record<string, LonLat> = {
  東京: { lon: 139.7671, lat: 35.6812 },
  大阪: { lon: 135.5023, lat: 34.6937 },
  札幌: { lon: 141.3545, lat: 43.0618 },
  那覇: { lon: 127.6809, lat: 26.2124 },
  ソウル: { lon: 126.978, lat: 37.5665 },
  北京: { lon: 116.4074, lat: 39.9042 },
  上海: { lon: 121.4737, lat: 31.2304 },
  ウラジオストク: { lon: 131.8869, lat: 43.1155 },
  台北: { lon: 121.5654, lat: 25.033 },
};

const AT_SEA: Record<string, LonLat> = {
  "太平洋（東京の東）": { lon: 145, lat: 35 },
  日本海: { lon: 134, lat: 39 },
  東シナ海: { lon: 125, lat: 28 },
  黄海: { lon: 123, lat: 35 },
  オホーツク海: { lon: 145, lat: 50 },
  "フィリピン海（南端）": { lon: 135, lat: 22 },
};

describe("東アジアの陸地データ", () => {
  it("PLAN.md の対象範囲を覆っている", () => {
    expect(EAST_ASIA_LAND.bounds).toEqual({
      minLon: 114,
      minLat: 20,
      maxLon: 152,
      maxLat: 55,
    });
  });

  it("PLAN.md が都市シードに挙げた都市がすべて範囲内にある", () => {
    // 西端 118°E のままだと北京 (116.4°E) が範囲外になっていた
    for (const position of Object.values(ON_LAND)) {
      expect(EAST_ASIA_LAND.covers(position)).toBe(true);
    }
  });

  it("ポリゴンが失われていない", () => {
    expect(EAST_ASIA_LAND.polygons.length).toBeGreaterThan(50);
  });

  it.each(Object.entries(ON_LAND))("%s は陸", (_name, position) => {
    expect(EAST_ASIA_LAND.isLand(position)).toBe(true);
  });

  it.each(Object.entries(AT_SEA))("%s は海", (_name, position) => {
    expect(EAST_ASIA_LAND.isLand(position)).toBe(false);
  });

  it("東京から東へ出ると海になる（M2 の完了条件の裏返し）", () => {
    const tokyo = ON_LAND.東京!;
    const offshore = { lon: tokyo.lon + 3, lat: tokyo.lat };
    expect(EAST_ASIA_LAND.isLand(tokyo)).toBe(true);
    expect(EAST_ASIA_LAND.isLand(offshore)).toBe(false);
  });

  it("東京から西へ飛ぶと、海を挟んで大陸に着く", () => {
    // 北緯 37 度を東経 139 → 120 まで 0.25 度刻みで進み、
    // 「陸 → 海 → 陸」の順に変わることを確かめる
    const sequence: boolean[] = [];
    for (let lon = 139; lon >= 118; lon -= 0.25) {
      const land = EAST_ASIA_LAND.isLand({ lon, lat: 37 });
      if (sequence[sequence.length - 1] !== land) sequence.push(land);
    }
    expect(sequence[0]).toBe(true); // 本州
    expect(sequence).toContain(false); // 日本海
    expect(sequence[sequence.length - 1]).toBe(true); // 朝鮮半島か中国大陸
    expect(sequence.length).toBeGreaterThanOrEqual(3);
  });

  it("判定が実用的な速さで返る", () => {
    // 毎フレーム呼ぶので、線形走査で足りることをここで押さえておく。
    // 空間索引を足すかどうかの判断材料にもなる
    const started = performance.now();
    for (let i = 0; i < 10_000; i += 1) {
      EAST_ASIA_LAND.isLand({ lon: 118 + (i % 34), lat: 20 + (i % 35) });
    }
    const perCall = (performance.now() - started) / 10_000;
    expect(perCall).toBeLessThan(0.1);
  });
});
