import { describe, expect, it } from "vitest";
import { Landmass, type LandmassSource } from "./landmass";

/** 経度 0..10 / 緯度 0..10 の正方形の島 */
const SQUARE = [0, 0, 10, 0, 10, 10, 0, 10];

function landmassOf(polygons: number[][][], bbox = [-50, -50, 50, 50]) {
  return new Landmass({ bbox, polygons } satisfies LandmassSource);
}

describe("Landmass.isLand", () => {
  const land = landmassOf([[SQUARE]]);

  it("ポリゴンの内側は陸", () => {
    expect(land.isLand({ lon: 5, lat: 5 })).toBe(true);
  });

  it("ポリゴンの外側は海", () => {
    expect(land.isLand({ lon: 20, lat: 5 })).toBe(false);
    expect(land.isLand({ lon: -5, lat: 5 })).toBe(false);
    expect(land.isLand({ lon: 5, lat: 20 })).toBe(false);
    expect(land.isLand({ lon: 5, lat: -5 })).toBe(false);
  });

  it("頂点と同じ緯度でも二重に数えない", () => {
    // 半直線が頂点をちょうど通る場合。ここが崩れると陸と海が縞になる
    expect(land.isLand({ lon: 5, lat: 0 })).toBe(true);
    expect(land.isLand({ lon: 5, lat: 10 })).toBe(false);
    expect(land.isLand({ lon: -5, lat: 0 })).toBe(false);
    expect(land.isLand({ lon: -5, lat: 10 })).toBe(false);
  });

  it("穴（湖）の中は海", () => {
    const withLake = landmassOf([[SQUARE, [4, 4, 6, 4, 6, 6, 4, 6]]]);
    expect(withLake.isLand({ lon: 5, lat: 5 })).toBe(false);
    expect(withLake.isLand({ lon: 2, lat: 2 })).toBe(true);
    // 湖の中の島までは表現しない（データ側に 3 重リングが無い）が、
    // even-odd 規則なので入れれば自動的に陸になる
    const island = landmassOf([
      [SQUARE, [3, 3, 7, 3, 7, 7, 3, 7], [4.5, 4.5, 5.5, 4.5, 5.5, 5.5, 4.5, 5.5]],
    ]);
    expect(island.isLand({ lon: 5, lat: 5 })).toBe(true);
  });

  it("複数のポリゴンをすべて調べる", () => {
    const two = landmassOf([[SQUARE], [[20, 0, 30, 0, 30, 10, 20, 10]]]);
    expect(two.isLand({ lon: 5, lat: 5 })).toBe(true);
    expect(two.isLand({ lon: 25, lat: 5 })).toBe(true);
    expect(two.isLand({ lon: 15, lat: 5 })).toBe(false);
  });

  it("データ範囲の外は海として扱う", () => {
    const narrow = landmassOf([[SQUARE]], [0, 0, 10, 10]);
    expect(narrow.isLand({ lon: 5, lat: 5 })).toBe(true);
    expect(narrow.isLand({ lon: 500, lat: 5 })).toBe(false);
    expect(narrow.covers({ lon: 5, lat: 5 })).toBe(true);
    expect(narrow.covers({ lon: 500, lat: 5 })).toBe(false);
  });

  it("面積を持たないリングは無視する", () => {
    const degenerate = landmassOf([[[0, 0, 1, 1]], [SQUARE]]);
    expect(degenerate.polygons).toHaveLength(1);
    expect(degenerate.isLand({ lon: 5, lat: 5 })).toBe(true);
  });
});

describe("壊れたデータを黙って受け入れない", () => {
  // どの壊れ方も、例外を出さなければ「陸が存在しない世界」として静かに動く。
  // JSON は as キャストで型検査を迂回して入ってくるので、ここが最後の砦になる

  it("bbox の要素数が 4 でなければ落ちる", () => {
    for (const bbox of [[], [1, 2], [1, 2, 3], [1, 2, 3, 4, 5]]) {
      expect(() => landmassOf([[SQUARE]], bbox)).toThrow(/bbox/);
    }
  });

  it("bbox に数値でないものが混ざれば落ちる", () => {
    expect(() => landmassOf([[SQUARE]], [0, 0, NaN, 10])).toThrow(/bbox/);
  });

  it("bbox が反転していれば落ちる", () => {
    expect(() => landmassOf([[SQUARE]], [10, 0, 0, 10])).toThrow(/反転/);
    expect(() => landmassOf([[SQUARE]], [0, 10, 10, 0])).toThrow(/反転/);
    // 幅ゼロも「どこも範囲内でない」ことになるので弾く
    expect(() => landmassOf([[SQUARE]], [5, 0, 5, 10])).toThrow(/反転/);
  });

  it("リングの座標数が奇数なら落ちる", () => {
    // 通すと経度と緯度が入れ替わって読まれ、例外も出ずに誤判定になる
    expect(() => landmassOf([[[0, 0, 10, 0, 10, 10, 5]]])).toThrow(/奇数/);
    expect(() => landmassOf([[SQUARE, [1, 1, 2, 2, 3]]])).toThrow(/奇数/);
  });
});
