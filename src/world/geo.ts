import { degToRad } from "../core/math";

/**
 * ワールド座標 ⇄ 実緯度経度の変換。
 *
 * three も DOM も知らない純粋な層。`flight/` と同じ理由でここを切り離してある:
 * 座標変換は一度ずれると全部がずれるのに、画面を見ても「少しずれている」ことに
 * 気づけない。往復や既知の都市との距離をテストで固定できる形にしておく。
 */

/** 地理座標（度）。x/z と取り違えないよう、名前付きの型にしてある */
export interface LonLat {
  /** 経度 (度)。東が + */
  readonly lon: number;
  /** 緯度 (度)。北が + */
  readonly lat: number;
}

/** ワールドの水平面座標 (m)。高度 y は飛行状態側が持つ */
export interface WorldXZ {
  readonly x: number;
  readonly z: number;
}

/** ワールド原点 = 東京駅 */
export const ORIGIN: LonLat = { lon: 139.7671, lat: 35.6812 };

/**
 * 距離圧縮率。ワールドは実距離の 1/SCALE。
 *
 * 実距離のままでは東京→ソウル 1,200km を鳥の速度で越えられない。
 * 1/20 にすると 60km 相当となり、巡航 100m/s で約 10 分で着く。
 * **地図 UI は実緯度経度で表示する**ので、プレイヤーから見た地理は正しいまま。
 *
 * 体感調整用の単一定数。ここだけを触れば世界の広さが変わる。
 */
export const SCALE = 20;

/**
 * 緯度 1 度あたりの距離 (m)。WGS84 の**赤道での**値。
 * 実際は極に向かって伸び、北緯 35 度では約 110,900m になる（0.3% の差）。
 */
const METERS_PER_LAT_DEGREE = 110_574;
/** 赤道上の経度 1 度あたりの距離 (m) */
const METERS_PER_LON_DEGREE_AT_EQUATOR = 111_320;

/**
 * 経度 1 度あたりの距離は緯度によって変わる（極では 0 になる）。
 * ここでは**原点の緯度で固定**する = 等距円筒近似。
 *
 * 正確な投影（メルカトル等）にしない理由: 原点の緯度で固定すると
 * `lonLatToWorld` が完全な線形写像になり、逆変換が割り算 1 回で厳密に求まる。
 * 対象範囲（北緯 20〜55°）では東西方向に最大 3 割ほど歪むが、
 * これは「ソウルが少し遠い/近い」程度の話で、遊びの体験には影響しない。
 * 一方、投影のずれで現在地表示と地図がずれるのは即座に破綻として見える。
 */
const METERS_PER_LON_DEGREE =
  METERS_PER_LON_DEGREE_AT_EQUATOR * Math.cos(degToRad(ORIGIN.lat));

/** 経度 1 度が何ワールドメートルに相当するか */
const WORLD_METERS_PER_LON_DEGREE = METERS_PER_LON_DEGREE / SCALE;
/** 緯度 1 度が何ワールドメートルに相当するか */
const WORLD_METERS_PER_LAT_DEGREE = METERS_PER_LAT_DEGREE / SCALE;

export function lonLatToWorld(position: LonLat): WorldXZ {
  return {
    x: (position.lon - ORIGIN.lon) * WORLD_METERS_PER_LON_DEGREE,
    // 北が -z。three の既定の前方が -z なので、yaw=0 で北を向くことになる
    z: -(position.lat - ORIGIN.lat) * WORLD_METERS_PER_LAT_DEGREE,
  };
}

export function worldToLonLat(position: WorldXZ): LonLat {
  return {
    lon: ORIGIN.lon + position.x / WORLD_METERS_PER_LON_DEGREE,
    lat: ORIGIN.lat - position.z / WORLD_METERS_PER_LAT_DEGREE,
  };
}

/**
 * リング（平坦な `[lon, lat, ...]`）をまとめてワールド座標へ投影する。
 * 地形メッシュ生成 (M2-b) と地図 (M7) が使う。
 *
 * 投影は geo.ts の責務なので、リングの持ち主である landmass.ts ではなくここに置く。
 * 引数は素の数値配列なので、geo.ts が landmass.ts に依存することはない。
 */
export function ringToWorld(ring: readonly number[]): WorldXZ[] {
  const points: WorldXZ[] = [];
  for (let i = 0; i + 1 < ring.length; i += 2) {
    points.push(lonLatToWorld({ lon: ring[i]!, lat: ring[i + 1]! }));
  }
  return points;
}

/**
 * 緯度経度を「35.68N 139.77E」のような表示文字列にする。
 *
 * 南緯・西経を負の数で出すと符号を読み違えるので、N/S・E/W の文字にする。
 * 対象範囲は北半球・東経のみだが、変換式自体は全球で成立するので分岐は残す。
 */
export function formatLonLat(position: LonLat, digits = 2): string {
  const ns = position.lat >= 0 ? "N" : "S";
  const ew = position.lon >= 0 ? "E" : "W";
  const lat = Math.abs(position.lat).toFixed(digits);
  const lon = Math.abs(position.lon).toFixed(digits);
  return `${lat}${ns} ${lon}${ew}`;
}
