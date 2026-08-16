import { describe, expect, it } from "vitest";
import {
  build,
  clipRing,
  openRing,
  parseArgs,
  signedArea,
  simplify,
} from "./build-landmass.mjs";

/**
 * 生成スクリプトの幾何アルゴリズムのテスト。
 *
 * ここが守っているのは「出荷される海岸線データが正しく作られるか」で、
 * src/world/eastAsia.test.ts の地理アサーション（東京は陸、日本海は海）では
 * 網が粗すぎて捕まらない範囲。実際、許容誤差を数倍にして海岸線をかなり潰しても
 * あちらのテストは全部通ってしまう。
 */

const BBOX = { minLon: 0, minLat: 0, maxLon: 10, maxLat: 10 };

describe("clipRing", () => {
  it("完全に内側なら形を変えない", () => {
    const ring = [
      [2, 2],
      [8, 2],
      [8, 8],
    ];
    expect(clipRing(ring, BBOX)).toEqual(ring);
  });

  it("完全に外側なら空になる", () => {
    const ring = [
      [20, 20],
      [30, 20],
      [30, 30],
    ];
    expect(clipRing(ring, BBOX)).toEqual([]);
  });

  it("はみ出した部分を bbox の縁で切る", () => {
    const ring = [
      [5, 5],
      [50, 5],
      [50, 8],
      [5, 8],
    ];
    const clipped = clipRing(ring, BBOX);
    for (const [lon, lat] of clipped) {
      expect(lon).toBeGreaterThanOrEqual(BBOX.minLon);
      expect(lon).toBeLessThanOrEqual(BBOX.maxLon);
      expect(lat).toBeGreaterThanOrEqual(BBOX.minLat);
      expect(lat).toBeLessThanOrEqual(BBOX.maxLat);
    }
    // 切った結果は 5..10 × 5..8 の長方形。面積で確かめる
    expect(Math.abs(signedArea(clipped))).toBeCloseTo(5 * 3, 6);
  });

  it("bbox を跨いで出入りする凹んだ形でも、内側の面積を保つ", () => {
    // コの字。bbox の右側へ 2 本の腕が伸びて戻ってくる
    const ring = [
      [5, 1],
      [50, 1],
      [50, 3],
      [5, 3],
      [5, 7],
      [50, 7],
      [50, 9],
      [5, 9],
    ];
    const clipped = clipRing(ring, BBOX);
    for (const [lon] of clipped) expect(lon).toBeLessThanOrEqual(BBOX.maxLon);
    // 腕 2 本ぶん (5×2 が 2 つ) に、Sutherland–Hodgman が縁沿いに残す
    // 縮退部分を足したもの。腕の面積は最低でも確保されている必要がある
    expect(Math.abs(signedArea(clipped))).toBeGreaterThanOrEqual(5 * 2 * 2);
  });

  it("辺が bbox を完全に横断する場合も切れる", () => {
    const ring = [
      [-50, 5],
      [50, 5],
      [50, 6],
      [-50, 6],
    ];
    const clipped = clipRing(ring, BBOX);
    expect(Math.abs(signedArea(clipped))).toBeCloseTo(10 * 1, 6);
  });

  it("3 点未満は面積を持たないので空にする", () => {
    expect(clipRing([], BBOX)).toEqual([]);
    expect(clipRing([[5, 5]], BBOX)).toEqual([]);
    expect(
      clipRing(
        [
          [5, 5],
          [6, 6],
        ],
        BBOX,
      ),
    ).toEqual([]);
  });
});

describe("simplify", () => {
  it("直線上に並んだ中間点を落とす", () => {
    const line = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    expect(simplify(line, 0.01)).toEqual([
      [0, 0],
      [3, 0],
    ]);
  });

  it("許容誤差より大きく外れた点は残す", () => {
    const bump = [
      [0, 0],
      [1, 0.5],
      [2, 0],
    ];
    expect(simplify(bump, 0.1)).toHaveLength(3);
    expect(simplify(bump, 1)).toHaveLength(2);
  });

  it("両端は必ず残る", () => {
    const points = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const result = simplify(points, 100);
    expect(result[0]).toEqual([0, 0]);
    expect(result[result.length - 1]).toEqual([2, 0]);
  });

  it("2 点以下はそのまま返す", () => {
    expect(simplify([], 1)).toEqual([]);
    expect(simplify([[0, 0]], 1)).toEqual([[0, 0]]);
  });

  it("許容誤差を上げるほど点が減る（単調）", () => {
    // 振れ幅が 0.05 から 0.54 まで少しずつ育つぎざぎざ。
    // 一様な振れ幅だと「全部残る」か「2 点に潰れる」の 2 択にしかならず、
    // 中間の許容誤差で中間の点数になることを確かめられない
    const zigzag = Array.from({ length: 50 }, (_, i) => [
      i,
      (i % 2) * (0.05 + i * 0.01),
    ]);
    const counts = [0.01, 0.2, 1].map((t) => simplify(zigzag, t).length);
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBe(2);
  });
});

describe("signedArea", () => {
  it("反時計回りが正、時計回りが負", () => {
    const ccw = [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ];
    expect(signedArea(ccw)).toBeCloseTo(12, 6);
    expect(signedArea([...ccw].reverse())).toBeCloseTo(-12, 6);
  });

  it("退化した形は 0", () => {
    expect(
      signedArea([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBeCloseTo(0, 6);
  });
});

describe("openRing", () => {
  it("閉じたリングの重複した終点を落とす", () => {
    expect(
      openRing([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it("開いたリングはそのまま", () => {
    const ring = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    expect(openRing(ring)).toEqual(ring);
  });

  it("空や 1 点でも落ちない", () => {
    expect(openRing([])).toEqual([]);
    expect(openRing([[0, 0]])).toEqual([[0, 0]]);
  });
});

describe("parseArgs", () => {
  it("既定値を返す", () => {
    expect(parseArgs([]).resolution).toBe("10m");
  });

  it("数値オプションを数値として受ける", () => {
    expect(parseArgs(["--tolerance", "0.05"]).tolerance).toBe(0.05);
  });

  it("数値オプションに数値以外を渡すと落ちる", () => {
    // 黙って通すと toleranceSquared が NaN になり、間引き無しで完走してしまう
    expect(() => parseArgs(["--tolerance", "abc"])).toThrow();
  });

  it("未知のオプションで落ちる。prototype のプロパティ名も通さない", () => {
    expect(() => parseArgs(["--nope", "1"])).toThrow();
    expect(() => parseArgs(["--toString", "1"])).toThrow();
    expect(() => parseArgs(["--constructor", "1"])).toThrow();
  });
});

describe("build", () => {
  const options = { tolerance: 0.001, minArea: 0.0001, digits: 4, bbox: BBOX };

  function feature(coordinates, type = "Polygon") {
    return { type: "Feature", geometry: { type, coordinates } };
  }

  const square = [
    [
      [1, 1],
      [5, 1],
      [5, 5],
      [1, 5],
      [1, 1],
    ],
  ];

  it("平坦な [lon, lat, ...] を出す", () => {
    const { polygons } = build(
      { type: "FeatureCollection", features: [feature(square)] },
      options,
    );
    expect(polygons).toHaveLength(1);
    // 終点の重複が落ちて 4 点 = 8 要素
    expect(polygons[0][0]).toEqual([1, 1, 5, 1, 5, 5, 1, 5]);
  });

  it("リングの座標数は必ず偶数になる（landmass.ts が奇数を弾くため）", () => {
    const { polygons } = build(
      { type: "FeatureCollection", features: [feature(square)] },
      options,
    );
    for (const rings of polygons) {
      for (const ring of rings) expect(ring.length % 2).toBe(0);
    }
  });

  it("bbox の外にあるポリゴンは落ちる", () => {
    const outside = [
      [
        [900, 900],
        [910, 900],
        [910, 910],
        [900, 900],
      ],
    ];
    const { polygons } = build(
      { type: "FeatureCollection", features: [feature(outside)] },
      options,
    );
    expect(polygons).toHaveLength(0);
  });

  it("minArea より小さい島は落ちる", () => {
    const speck = [
      [
        [1, 1],
        [1.001, 1],
        [1.001, 1.001],
        [1, 1],
      ],
    ];
    const { polygons } = build(
      { type: "FeatureCollection", features: [feature(speck)] },
      options,
    );
    expect(polygons).toHaveLength(0);
  });

  it("穴を外周のあとに残す", () => {
    const withHole = [
      square[0],
      [
        [2, 2],
        [4, 2],
        [4, 4],
        [2, 2],
      ],
    ];
    const { polygons } = build(
      { type: "FeatureCollection", features: [feature(withHole)] },
      options,
    );
    expect(polygons[0]).toHaveLength(2);
  });

  /** square を経度方向にずらした別の島。bbox には収まる */
  const shifted = [square[0].map(([lon, lat]) => [lon + 5, lat])];

  it("MultiPolygon を島ごとに分ける", () => {
    const { polygons } = build(
      {
        type: "FeatureCollection",
        features: [feature([square, shifted], "MultiPolygon")],
      },
      options,
    );
    expect(polygons).toHaveLength(2);
  });

  it("GeometryCollection とトップレベルの素の Geometry も読める", () => {
    // 黙って 0 個を返すと「世界が全部海」の JSON を出荷することになる
    const collection = build(
      {
        type: "GeometryCollection",
        geometries: [
          { type: "Polygon", coordinates: square },
          { type: "Polygon", coordinates: shifted },
        ],
      },
      options,
    );
    expect(collection.polygons).toHaveLength(2);

    const bare = build({ type: "Polygon", coordinates: square }, options);
    expect(bare.polygons).toHaveLength(1);
  });
});
