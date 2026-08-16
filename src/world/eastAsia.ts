import { Landmass, type LandmassSource } from "./landmass";
import source from "./data/eastasia-land.json";

/**
 * 東アジアの陸地。アプリ全体で 1 つだけ持つ。
 *
 * データの結び付けを landmass.ts から分けてあるのは、判定のアルゴリズムを
 * 小さな合成データでテストできるようにするため。こちらのテストは
 * 「実データが本当に日本や朝鮮半島の形になっているか」だけを見る。
 *
 * JSON はバンドルに同梱される（実行時にネットワークへ出ない）。
 * 原寸 110KB / gzip 41KB で、GitHub Pages は gzip で配る。
 */
export const EAST_ASIA_LAND = new Landmass(source as LandmassSource);
