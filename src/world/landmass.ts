import { lonLatToWorld, type LonLat, type WorldXZ } from "./geo";

/**
 * 陸地ポリゴンの保持と陸/海の判定。
 *
 * geo.ts と同様に three を知らない。データは `tools/build-landmass.mjs` が
 * Natural Earth から生成した JSON で、この層はその形しか知らない。
 * 具体的な東アジアのデータと結び付けるのは eastAsia.ts の役割。
 */

/**
 * 1 本のリング。平坦な `[lon, lat, lon, lat, ...]`。
 *
 * `[lon, lat][]` ではなく平坦にしてあるのは、JSON が小さくなることと、
 * 判定ループで組ごとの配列アクセスを避けられるため。
 * 始点と終点は重複させない（閉じているものとして扱う）。
 */
export type Ring = readonly number[];

/** 外周リングが先頭、以降は穴（湖など） */
export type PolygonRings = readonly Ring[];

/** build-landmass.mjs が出力する JSON の形 */
export interface LandmassSource {
  /** データが覆う範囲 `[minLon, minLat, maxLon, maxLat]` */
  readonly bbox: readonly number[];
  readonly polygons: readonly PolygonRings[];
}

export interface Bounds {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
}

/** ポリゴンと、その外周から求めた bbox */
export interface IndexedPolygon {
  readonly rings: PolygonRings;
  readonly bounds: Bounds;
}

function ringBounds(ring: Ring): Bounds {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    const lon = ring[i]!;
    const lat = ring[i + 1]!;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

function withinBounds(bounds: Bounds, position: LonLat): boolean {
  return (
    position.lon >= bounds.minLon &&
    position.lon <= bounds.maxLon &&
    position.lat >= bounds.minLat &&
    position.lat <= bounds.maxLat
  );
}

/**
 * 点から東向きに伸ばした半直線が、リングの辺を何回横切るか数える（ray casting）。
 *
 * 頂点をちょうど通る時に二重に数えないよう、辺の判定を
 * 「片方の端点だけが lat より上」= 半開区間にしてある。これは教科書的な形で、
 * 水平な辺（両端が同じ lat）も自動的に無視される。
 */
function crossings(ring: Ring, position: LonLat): number {
  const count = ring.length / 2;
  let total = 0;
  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const lonI = ring[i * 2]!;
    const latI = ring[i * 2 + 1]!;
    const lonJ = ring[j * 2]!;
    const latJ = ring[j * 2 + 1]!;
    if (latI > position.lat !== latJ > position.lat) {
      const lonAtLat =
        lonI + ((position.lat - latI) / (latJ - latI)) * (lonJ - lonI);
      if (position.lon < lonAtLat) total += 1;
    }
  }
  return total;
}

/**
 * 全リングの交差回数の合計が奇数なら内側（even-odd 規則）。
 *
 * 穴の扱いに専用のコードが要らないのがこの規則の利点。湖の中の点は
 * 外周で 1 回、湖のリングでもう 1 回横切って偶数になり、自動的に「外」になる。
 */
function containsPoint(polygon: IndexedPolygon, position: LonLat): boolean {
  if (!withinBounds(polygon.bounds, position)) return false;
  let total = 0;
  for (const ring of polygon.rings) total += crossings(ring, position);
  return total % 2 === 1;
}

export class Landmass {
  /** データが覆う範囲。ここより外は判定できない */
  readonly bounds: Bounds;
  /** bbox を前計算したポリゴン。M2-b の地形メッシュ生成もこれを読む */
  readonly polygons: readonly IndexedPolygon[];

  constructor(source: LandmassSource) {
    const [minLon = 0, minLat = 0, maxLon = 0, maxLat = 0] = source.bbox;
    this.bounds = { minLon, minLat, maxLon, maxLat };
    this.polygons = source.polygons
      // 3 頂点未満のリングは面積を持たない。データ生成側でも落としているが、
      // 判定ループの中で毎回気にしなくて済むようここでも弾いておく
      .filter((rings) => (rings[0]?.length ?? 0) >= 6)
      .map((rings) => ({ rings, bounds: ringBounds(rings[0]!) }));
  }

  /**
   * その緯度経度が陸地か。
   *
   * **データ範囲の外は false（海）を返す**。ワールドの端は外洋という扱いで、
   * 「陸かどうか分からない」と「海」を呼び出し側で区別する必要が無いため。
   * 区別したい時は covers() を先に呼ぶ。
   */
  isLand(position: LonLat): boolean {
    if (!withinBounds(this.bounds, position)) return false;
    // ポリゴンごとの bbox で先に弾く。200 個程度なら空間索引を作るより
    // この単純な線形走査の方が速く、データ構造も増えない
    for (const polygon of this.polygons) {
      if (containsPoint(polygon, position)) return true;
    }
    return false;
  }

  /** データが覆う範囲内か。範囲外での isLand() は「海」に丸められている */
  covers(position: LonLat): boolean {
    return withinBounds(this.bounds, position);
  }
}

/** リングをワールド座標に投影する。地形メッシュ生成 (M2-b) と地図 (M7) が使う */
export function ringToWorld(ring: Ring): WorldXZ[] {
  const points: WorldXZ[] = [];
  for (let i = 0; i < ring.length; i += 2) {
    points.push(lonLatToWorld({ lon: ring[i]!, lat: ring[i + 1]! }));
  }
  return points;
}
