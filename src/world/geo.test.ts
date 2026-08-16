import { describe, expect, it } from "vitest";
import {
  formatLonLat,
  lonLatToWorld,
  ORIGIN,
  ringToWorld,
  SCALE,
  worldToLonLat,
  type LonLat,
} from "./geo";

/** 主要都市。投影が実際の地理と合っているかの検算に使う */
const CITIES = {
  tokyo: { lon: 139.7671, lat: 35.6812 },
  seoul: { lon: 126.978, lat: 37.5665 },
  beijing: { lon: 116.4074, lat: 39.9042 },
  vladivostok: { lon: 131.8869, lat: 43.1155 },
} as const satisfies Record<string, LonLat>;

function worldDistance(a: LonLat, b: LonLat): number {
  const pa = lonLatToWorld(a);
  const pb = lonLatToWorld(b);
  return Math.hypot(pa.x - pb.x, pa.z - pb.z);
}

/**
 * 球面上の実距離 (m)。テストの中だけで使う「正解」。
 *
 * 投影の検算に投影の式を使うと同語反復になるので、独立した式で照らし合わせる。
 * 定数の取り違え（cos を掛け忘れる、SCALE を二重に掛ける）も、
 * 向きの誤り（南北の反転）も、この比較なら一度に捕まる。
 */
function haversineMeters(a: LonLat, b: LonLat): number {
  const R = 6_371_008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

describe("lonLatToWorld", () => {
  it("原点（東京駅）が (0, 0) になる", () => {
    const { x, z } = lonLatToWorld(ORIGIN);
    expect(x).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(0, 9);
  });

  it("北へ行くと -z、東へ行くと +x", () => {
    const north = lonLatToWorld({ lon: ORIGIN.lon, lat: ORIGIN.lat + 1 });
    expect(north.z).toBeLessThan(0);
    expect(north.x).toBeCloseTo(0, 9);

    const east = lonLatToWorld({ lon: ORIGIN.lon + 1, lat: ORIGIN.lat });
    expect(east.x).toBeGreaterThan(0);
    expect(east.z).toBeCloseTo(0, 9);
  });

  it("経度 1 度より緯度 1 度の方が長い（原点は北緯 35 度なので）", () => {
    const east = lonLatToWorld({ lon: ORIGIN.lon + 1, lat: ORIGIN.lat });
    const north = lonLatToWorld({ lon: ORIGIN.lon, lat: ORIGIN.lat + 1 });
    expect(Math.abs(north.z)).toBeGreaterThan(Math.abs(east.x));
  });

  it("線形写像である（原点の緯度で経度スケールを固定しているため）", () => {
    // 緯度が違っても、同じ経度差なら同じ x 差になる
    const atSouth = lonLatToWorld({ lon: 145, lat: 20 }).x;
    const atNorth = lonLatToWorld({ lon: 145, lat: 55 }).x;
    expect(atSouth).toBeCloseTo(atNorth, 9);
  });
});

describe("worldToLonLat", () => {
  it("lonLatToWorld と往復して元に戻る", () => {
    for (const city of Object.values(CITIES)) {
      const round = worldToLonLat(lonLatToWorld(city));
      expect(round.lon).toBeCloseTo(city.lon, 9);
      expect(round.lat).toBeCloseTo(city.lat, 9);
    }
  });

  it("ワールド座標から往復しても元に戻る", () => {
    for (const point of [
      { x: 0, z: 0 },
      { x: 12_345, z: -6_789 },
      { x: -80_000, z: 150_000 },
    ]) {
      const round = lonLatToWorld(worldToLonLat(point));
      expect(round.x).toBeCloseTo(point.x, 6);
      expect(round.z).toBeCloseTo(point.z, 6);
    }
  });
});

describe("距離の圧縮", () => {
  it("東京→ソウルが実距離のおよそ 1/20 になっている", () => {
    // 実距離は約 1,160km。ワールドでは約 58km を期待する
    const km = worldDistance(CITIES.tokyo, CITIES.seoul) / 1000;
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(65);
  });

  it("巡航速度 100m/s なら東京→ソウルが 10 分前後", () => {
    const minutes = worldDistance(CITIES.tokyo, CITIES.seoul) / 100 / 60;
    expect(minutes).toBeGreaterThan(7);
    expect(minutes).toBeLessThan(13);
  });

  it("東京からの距離が、球面上の実距離の 1/20 と 10% 以内で一致する", () => {
    // 順序だけを見ると定数の取り違えを見逃す。実距離そのものと突き合わせる。
    // 等距円筒近似なので原点から離れるほどずれるが、対象範囲では数 % に収まる
    for (const [name, city] of Object.entries(CITIES)) {
      if (name === "tokyo") continue;
      const expected = haversineMeters(CITIES.tokyo, city) / SCALE;
      const ratio = worldDistance(CITIES.tokyo, city) / expected;
      expect(ratio, `${name} の距離比`).toBeGreaterThan(0.9);
      expect(ratio, `${name} の距離比`).toBeLessThan(1.1);
    }
  });

  it("原点から離れるほど東西方向が過大になる（近似の性質）", () => {
    // この近似の限界を明示しておく。M7 で地図に距離を出す時はここを見ること。
    // 北緯 50 度では実距離の 1.25 倍以上になる
    const a = { lon: 140, lat: 50 };
    const b = { lon: 145, lat: 50 };
    const ratio = worldDistance(a, b) / (haversineMeters(a, b) / SCALE);
    expect(ratio).toBeGreaterThan(1.2);
  });
});

describe("ringToWorld", () => {
  it("平坦な [lon, lat, ...] を lonLatToWorld と同じ規則で投影する", () => {
    const points = ringToWorld([ORIGIN.lon, ORIGIN.lat, 140.7671, 36.6812]);
    expect(points).toHaveLength(2);
    expect(points[0]!.x).toBeCloseTo(0, 6);
    expect(points[0]!.z).toBeCloseTo(0, 6);

    const expected = lonLatToWorld({ lon: 140.7671, lat: 36.6812 });
    expect(points[1]!.x).toBeCloseTo(expected.x, 6);
    expect(points[1]!.z).toBeCloseTo(expected.z, 6);
  });

  it("端数の座標を無視する（対にならない末尾を読まない）", () => {
    expect(ringToWorld([139, 35, 140])).toHaveLength(1);
    expect(ringToWorld([])).toHaveLength(0);
  });
});

describe("formatLonLat", () => {
  it("北緯・東経を N / E で出す", () => {
    expect(formatLonLat({ lon: 139.7671, lat: 35.6812 })).toBe(
      "35.68N 139.77E",
    );
  });

  it("南緯・西経は符号ではなく S / W で出す", () => {
    expect(formatLonLat({ lon: -70.6, lat: -33.45 })).toBe("33.45S 70.60W");
  });

  it("桁数を指定できる", () => {
    expect(formatLonLat(ORIGIN, 0)).toBe("36N 140E");
    expect(formatLonLat(ORIGIN, 4)).toBe("35.6812N 139.7671E");
  });
});
