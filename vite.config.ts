import { defineConfig } from "vite";

// GitHub Pages はリポジトリ名のサブパス配下で配信されるため、
// 本番ビルドだけ base を /skyroam/ にする。ローカル開発は / のまま。
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/skyroam/" : "/",
  build: {
    target: "es2022",
    // 開発中はスマホ実機の不具合を追う手段が乏しいため、本番にも sourcemap を出す。
    // 転送量は増えるが、公開リポジトリなので隠すべき情報も無い。
    // 開発が落ち着いたら (M9) 見直す。
    sourcemap: true,
  },
}));
