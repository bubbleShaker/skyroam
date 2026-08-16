import { defineConfig } from "vite";

// GitHub Pages はリポジトリ名のサブパス配下で配信されるため、
// 本番ビルドだけ base を /skyroam/ にする。ローカル開発は / のまま。
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/skyroam/" : "/",
  build: {
    target: "es2022",
    sourcemap: true,
  },
}));
