# skyroam

東アジア上空を鳥になって飛ぶ 3D ゲーム。

**▶ プレイ（最新版）: https://bubbleshaker.github.io/skyroam/**

`main` への push ごとに自動でビルド・公開されるので、上の URL がそのまま進捗確認用になる。

## いまできること

| マイルストーン | 状態 |
| --- | --- |
| M0 土台とデプロイ | ✅ 空と地面が描画され、Pages に自動公開される |
| M1 飛行操作 | ⬜ |
| M2 世界座標と地形 | ⬜ |
| M3 都市生成 | ⬜ |
| M4 着地と歩行 | ⬜ |
| M5 時間と空 | ⬜ |
| M6 人 | ⬜ |
| M7 地図 | ⬜ |
| M8 BGM | ⬜ |
| M9 最適化 | ⬜ |

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm test           # ユニットテスト (vitest)
npm run build      # 型チェック + 本番ビルド
npm run typecheck  # 型チェックのみ
```

PR を出すと GitHub Actions がテストとビルドを回す。`main` にマージされると Pages へ公開される。

## 構成

```
src/
  core/     Game ループ、System インターフェース、デバイス品質判定
  scene/    空・地面・光源など 3D シーンの構成要素
  ui/       HUD などの DOM UI
```

`core/Game.ts` は `System` インターフェースしか知らない。
機能を足すときは `System` を実装して `game.add()` に渡す。

## 設計

技術選定の理由、座標系、距離圧縮、手続き生成の方針は [PLAN.md](./PLAN.md) を参照。
