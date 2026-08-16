import { Game } from "./core/Game";
import { Sky } from "./scene/Sky";
import { Ground, GROUND_SIZE } from "./scene/Ground";
import { Lighting } from "./scene/Lighting";
import { DemoCamera } from "./scene/DemoCamera";
import { Hud } from "./ui/Hud";

function boot(hudElement: HTMLElement): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#app");
  if (!canvas) throw new Error("canvas (#app) が見つかりません");

  const game = new Game(canvas);

  const hud = new Hud(hudElement);
  hud.set("build", `skyroam M0 (${game.quality.tier})`);

  game
    .add(
      new Sky({
        radius: game.quality.drawDistance * 0.9,
        fogNear: GROUND_SIZE * 0.1,
        // 地面の端 (GROUND_SIZE/2) までに霧が効き切るようにする。
        // 描画距離を基準にすると地面の方が先に途切れ、ハードエッジが見える。
        fogFar: GROUND_SIZE * 0.5,
      }),
    )
    .add(new Lighting(game.quality.shadows))
    .add(new Ground())
    .add(new DemoCamera())
    .add(hud);

  game.start();
}

/**
 * WebGL が使えない端末やコンテキスト生成失敗では、何も表示されない真っ黒な画面
 * だけが残ってしまう。原因が分かる文言を出す。
 */
function showFatal(hudElement: HTMLElement | null, error: unknown): void {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  if (hudElement) {
    hudElement.textContent = `起動に失敗しました。\nこのブラウザで WebGL が利用できない可能性があります。\n\n${message}`;
  }
}

const hudElement = document.querySelector<HTMLElement>("#hud");
try {
  if (!hudElement) throw new Error("HUD (#hud) が見つかりません");
  boot(hudElement);
} catch (error) {
  showFatal(hudElement, error);
}
