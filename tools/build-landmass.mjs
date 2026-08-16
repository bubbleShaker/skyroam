#!/usr/bin/env node
/**
 * 東アジアの陸地ポリゴンを生成する。**開発時に手で 1 回だけ走らせるスクリプト**で、
 * 生成物 (src/world/data/eastasia-land.json) を commit する。
 * ゲーム本体は実行時にネットワークへ出ない（GitHub Pages の静的配信のまま）。
 *
 * 入力: Natural Earth の land ポリゴン (public domain)
 * 出力: bbox でクリップし、Douglas–Peucker で間引いた自前の軽量フォーマット
 *
 * 使い方:
 *   node tools/build-landmass.mjs                    # 50m 版をダウンロードして生成
 *   node tools/build-landmass.mjs --input land.json  # ローカルの GeoJSON から生成
 *   node tools/build-landmass.mjs --tolerance 0.02   # もっと粗く（ファイルが小さくなる）
 *
 * なぜクリップが要るか: Natural Earth ではユーラシア大陸が 1 個の巨大ポリゴンとして
 * 入っており、丸ごと持つと数万点になる。bbox の外を落として初めて数十 KB に収まる。
 */

import { createHash } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * PLAN.md の対象範囲: 日本・朝鮮半島・中国東岸・極東ロシア。
 *
 * 西端は PLAN.md の初稿では 118°E だったが、それだと北京 (116.4°E) が範囲外になる。
 * 北京は PLAN.md §3 で都市シードとして名指しされているので、114°E まで広げた。
 */
const BBOX = { minLon: 114, minLat: 20, maxLon: 152, maxLat: 55 };

/**
 * 入力元。`master` ではなく commit を固定してある。
 *
 * 追跡ブランチを指すと、上流が更新された時に同じコマンドから別の生成物が出て、
 * 「なぜ海岸線が変わったのか」を後から辿れなくなる。
 * 更新したい時は SHA を意図的に上げ、生成物の差分をレビューする。
 */
const SOURCE_COMMIT = "0b9a6ceb0a7032713abd9460ac1e995a9c60cd1e";
const SOURCES = {
  "50m": `https://raw.githubusercontent.com/martynafford/natural-earth-geojson/${SOURCE_COMMIT}/50m/physical/ne_50m_land.json`,
  "10m": `https://raw.githubusercontent.com/martynafford/natural-earth-geojson/${SOURCE_COMMIT}/10m/physical/ne_10m_land.json`,
};

const DEFAULTS = {
  // 10m を採るのは、ゲームが始まる日本近海の形が 50m だと潰れるため。
  // 現在の bbox では 50m: 35KB / 2.1k 点、10m: 116KB / 7.0k 点（gzip 後は 15KB と 41KB）。
  // Pages は gzip で配るので、41KB なら妥当な対価。
  resolution: "10m",
  /** Douglas–Peucker の許容誤差 (度)。0.01° ≒ 1.1km ≒ ワールドで 55m */
  tolerance: 0.01,
  /** これより小さい島は落とす (度^2)。0.0004 ≒ 4km^2 */
  minArea: 0.0004,
  /** 出力の小数点以下桁数。4 桁 ≒ 11m で、間引き幅よりずっと細かい */
  digits: 4,
  output: "src/world/data/eastasia-land.json",
};

// ---------------------------------------------------------------- 引数

/** 数値として受け取るオプション。`--tolerance abc` を黙って通さないために明示する */
const NUMERIC_OPTIONS = new Set(["tolerance", "minArea", "digits"]);

export function parseArgs(argv) {
  const options = { ...DEFAULTS, input: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (!key || value === undefined) throw new Error(`引数が不正: ${argv[i]}`);
    // `in` は prototype も見るので --toString や --constructor が通ってしまう
    if (!Object.hasOwn(options, key)) {
      throw new Error(`未知のオプション: --${key}`);
    }
    if (NUMERIC_OPTIONS.has(key)) {
      const asNumber = Number(value);
      if (!Number.isFinite(asNumber)) {
        throw new Error(`--${key} には数値を渡してください: ${value}`);
      }
      options[key] = asNumber;
    } else {
      options[key] = value;
    }
  }
  return options;
}

// ------------------------------------------------- Sutherland–Hodgman

/**
 * 凸なクリップ領域に対する多角形クリップ。bbox の 4 辺で順に切る。
 *
 * 各辺について「内側の点はそのまま残し、内外をまたぐ辺は交点を足す」を繰り返す。
 * 凹んだ多角形では境界に沿った縮退辺が出ることがあるが、それは bbox の縁
 * （＝ワールドの端、プレイ範囲の外）に現れるだけなので許容する。
 */
export function clipRing(ring, bbox) {
  if (ring.length < 3) return [];
  const edges = [
    { inside: (p) => p[0] >= bbox.minLon, at: (a, b) => lerpX(a, b, bbox.minLon) },
    { inside: (p) => p[0] <= bbox.maxLon, at: (a, b) => lerpX(a, b, bbox.maxLon) },
    { inside: (p) => p[1] >= bbox.minLat, at: (a, b) => lerpY(a, b, bbox.minLat) },
    { inside: (p) => p[1] <= bbox.maxLat, at: (a, b) => lerpY(a, b, bbox.maxLat) },
  ];

  let output = ring;
  for (const edge of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i += 1) {
      const current = input[i];
      const previous = input[(i - 1 + input.length) % input.length];
      const currentIn = edge.inside(current);
      const previousIn = edge.inside(previous);
      if (currentIn) {
        if (!previousIn) output.push(edge.at(previous, current));
        output.push(current);
      } else if (previousIn) {
        output.push(edge.at(previous, current));
      }
    }
    if (output.length === 0) return [];
  }
  return output;
}

function lerpX(a, b, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + (b[1] - a[1]) * t];
}

function lerpY(a, b, y) {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + (b[0] - a[0]) * t, y];
}

// ------------------------------------------------------ Douglas–Peucker

/** 線分 a-b から点 p までの距離の 2 乗 */
function squaredDistanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  let t = 0;
  if (lengthSquared > 0) {
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared;
    t = Math.min(1, Math.max(0, t));
  }
  const ex = a[0] + dx * t - p[0];
  const ey = a[1] + dy * t - p[1];
  return ex * ex + ey * ey;
}

export function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const toleranceSquared = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // 再帰ではなくスタックで回す。海岸線は 1 本が数万点になりうるため
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let farthest = -1;
    let maxDistance = toleranceSquared;
    for (let i = start + 1; i < end; i += 1) {
      const distance = squaredDistanceToSegment(
        points[i],
        points[start],
        points[end],
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = i;
      }
    }
    if (farthest > 0) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

// ------------------------------------------------------------- リング

/** 符号付き面積。絶対値を大きさの判定に使う */
export function signedArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

/** GeoJSON のリングは末尾が始点と同じ。閉じる責任は描画側に持たせるので落とす */
export function openRing(ring) {
  if (ring.length < 2) return ring;
  const last = ring[ring.length - 1];
  const first = ring[0];
  if (last[0] === first[0] && last[1] === first[1]) return ring.slice(0, -1);
  return ring;
}

function round(value, digits) {
  const factor = 10 ** digits;
  // -0 が出ると JSON に "-0" と書かれるので +0 で潰す
  return Math.round(value * factor) / factor + 0;
}

// --------------------------------------------------------------- 本体

/** GeoJSON の入れ子（FeatureCollection / GeometryCollection / 素の Geometry）を平らにする */
function* eachPolygon(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.features)) {
    for (const feature of node.features) yield* eachPolygon(feature);
  } else if (node.geometry) {
    yield* eachPolygon(node.geometry);
  } else if (Array.isArray(node.geometries)) {
    for (const geometry of node.geometries) yield* eachPolygon(geometry);
  } else if (node.type === "Polygon") {
    yield node.coordinates;
  } else if (node.type === "MultiPolygon") {
    yield* node.coordinates;
  }
}

export function build(geojson, options) {
  // クリップ範囲を引数で受ける。モジュール定数を直接読むと、
  // 東アジアの座標を持ったテストデータでしか検査できなくなる
  const bbox = options.bbox ?? BBOX;
  const polygons = [];
  let inputPoints = 0;
  let outputPoints = 0;

  for (const rings of eachPolygon(geojson)) {
    const [outer, ...holes] = rings ?? [];
    if (!outer) continue;
    inputPoints += rings.reduce((sum, ring) => sum + ring.length, 0);

    const clippedOuter = simplify(
      clipRing(openRing(outer), bbox),
      options.tolerance,
    );
    if (clippedOuter.length < 3) continue;
    if (Math.abs(signedArea(clippedOuter)) < options.minArea) continue;

    const kept = [clippedOuter];
    for (const hole of holes) {
      const clipped = simplify(clipRing(openRing(hole), bbox), options.tolerance);
      // 穴は外周と同じ閾値で残す。
      // 現状 Natural Earth の land レイヤに穴は 1 つも無いので、この経路は通らない。
      // 湖を海として扱いたくなったら lakes レイヤをここへ穴として合成する（M2 の積み残し）
      if (clipped.length >= 3 && Math.abs(signedArea(clipped)) >= options.minArea) {
        kept.push(clipped);
      }
    }

    outputPoints += kept.reduce((sum, ring) => sum + ring.length, 0);
    polygons.push(
      kept.map((ring) =>
        // 平坦な [lon, lat, lon, lat, ...] にする。ネストした組より JSON が小さい
        ring.flatMap(([lon, lat]) => [
          round(lon, options.digits),
          round(lat, options.digits),
        ]),
      ),
    );
  }

  return { polygons, inputPoints, outputPoints };
}

/** 入力の中身そのものを指紋にする。ローカルの --input でも同じ値が出る */
function fingerprint(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

async function loadSource(options) {
  if (options.input) {
    return readFileSync(resolve(options.input), "utf8");
  }
  const url = SOURCES[options.resolution];
  if (!url) throw new Error(`未知の解像度: ${options.resolution}`);
  console.log(`取得中: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`取得に失敗: HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const text = await loadSource(options);
  const { polygons, inputPoints, outputPoints } = build(JSON.parse(text), options);

  // 0 個で正常終了すると「世界が全部海」の JSON を静かに出荷することになる。
  // GeoJSON の形が想定と違った時は、ここで気づけるようにする
  if (polygons.length === 0) {
    throw new Error("ポリゴンが 1 つも取れませんでした。入力の形式を確認してください");
  }

  const output = {
    $comment:
      "tools/build-landmass.mjs が生成。手で編集しない。Natural Earth (public domain) 由来",
    source: `Natural Earth ${options.resolution} land`,
    sourceCommit: SOURCE_COMMIT,
    // 生成物から入力を辿れるようにする。海岸線が変わった時に
    // 「上流が変わったのか、こちらの設定を変えたのか」を切り分けられる
    sourceSha256: fingerprint(text),
    license: "public domain",
    bbox: [BBOX.minLon, BBOX.minLat, BBOX.maxLon, BBOX.maxLat],
    toleranceDeg: options.tolerance,
    /** 外周リングが先頭、以降は穴。各リングは平坦な [lon, lat, ...] */
    polygons,
  };

  const outputPath = resolve(ROOT, options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  const json = JSON.stringify(output);
  writeFileSync(outputPath, `${json}\n`);

  console.log(
    [
      `解像度       ${options.resolution}`,
      `許容誤差     ${options.tolerance}° (≒ ${Math.round(options.tolerance * 111)}km)`,
      `ポリゴン数   ${polygons.length}`,
      `頂点数       ${inputPoints} → ${outputPoints}`,
      `サイズ       ${(json.length / 1024).toFixed(1)} KB`,
      `入力指紋     ${output.sourceSha256}`,
      `出力先       ${options.output}`,
    ].join("\n"),
  );
}

// 直接実行された時だけ走らせる。
// トップレベルで実行していると、テストが import した瞬間に
// ダウンロードとファイル書き込みが起きてしまい、純粋関数を検査できない
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
