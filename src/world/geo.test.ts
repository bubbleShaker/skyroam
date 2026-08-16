import { describe, expect, it } from "vitest";
import {
  formatLonLat,
  lonLatToWorld,
  ORIGIN,
  SCALE,
  worldToLonLat,
  worldToRealMeters,
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

  it("都市の遠近の順序が実際の地理と一致する", () => {
    // 実距離は ウラジオストク 約 1,060km < ソウル 約 1,160km < 北京 約 2,100km
    const toVladivostok = worldDistance(CITIES.tokyo, CITIES.vladivostok);
    const toSeoul = worldDistance(CITIES.tokyo, CITIES.seoul);
    const toBeijing = worldDistance(CITIES.tokyo, CITIES.beijing);
    expect(toVladivostok).toBeLessThan(toSeoul);
    expect(toSeoul).toBeLessThan(toBeijing);
  });

  it("worldToRealMeters がワールド距離を実距離に戻す", () => {
    const world = worldDistance(CITIES.tokyo, CITIES.seoul);
    const realKm = worldToRealMeters(world) / 1000;
    // 東京—ソウルの実測は約 1,160km
    expect(realKm).toBeGreaterThan(1_050);
    expect(realKm).toBeLessThan(1_270);
    expect(worldToRealMeters(world)).toBeCloseTo(world * SCALE, 6);
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
});
