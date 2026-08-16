/**
 * 「どこまで見えるか」を決める数値。
 *
 * 霧の距離・空の球の半径・地形の板の広さは、**互いに独立に決められない**。
 * 1 つだけ動かすと必ずどこかにハードエッジか、遠景が空へ溶けない帯が出る。
 * すべて `drawDistance`（品質プリセットが持つカメラの描画距離）から導き、
 * 満たすべき大小関係をここ 1 箇所に書く。
 *
 * ```
 *   fogFar  <  skyRadius  <  drawDistance (= far 面)  <  terrainReach
 *  霧が効き切る  空の球     ここで切られる          地形はその外側まで届く
 * ```
 *
 * - `fogFar < skyRadius`: 遠景が空の球より手前で霧に溶けきる。逆だと遠景が
 *   空を突き抜けて見える
 * - `drawDistance < terrainReach`: 地平線が必ず far 面で決まる。far 面は平面なので
 *   水平な地形との交線は直線になり、板が正方形であることが見えない。
 *   逆だと正方形の角が地平線に切り欠きとして現れる
 *
 * このモジュールは three を知らない。`Sky` と `Terrain` の両方から読まれ、
 * 「同じ 1 箇所を読む」ことで配線ミスを構造的に防ぐ。
 */

export interface FogRange {
  /** これより手前は霧がかからない距離 (m) */
  readonly near: number;
  /** これより奥は完全に霧の色になる距離 (m) */
  readonly far: number;
}

export function fogRange(drawDistance: number): FogRange {
  const far = drawDistance * 0.8;
  return { near: far * 0.05, far };
}

/** 空を表す球の半径 (m) */
export function skyRadius(drawDistance: number): number {
  return drawDistance * 0.9;
}

/** 地形の板が届いていなければならない半径 (m) */
export function terrainReach(drawDistance: number): number {
  return drawDistance * 1.5;
}
