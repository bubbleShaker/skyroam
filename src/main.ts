import { Color, Fog } from "three";
import { Game } from "./core/Game";
import { Sky } from "./scene/Sky";
import { Ground } from "./scene/Ground";
import { Lighting } from "./scene/Lighting";
import { DemoCamera } from "./scene/DemoCamera";
import { Hud } from "./ui/Hud";

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#app");
  const hudElement = document.querySelector<HTMLElement>("#hud");
  if (!canvas || !hudElement) {
    throw new Error("必要な DOM 要素 (#app / #hud) が見つかりません");
  }

  const game = new Game(canvas);

  // 遠景を空の色に溶かして、地面グリッドの終端を目立たなくする
  game.scene.fog = new Fog(new Color("#bcd8f0"), 800, game.quality.drawDistance * 0.5);

  const hud = new Hud(hudElement);
  hud.set("build", `skyroam M0 (${game.quality.tier})`);

  game
    .add(new Sky(game.quality.drawDistance * 0.9))
    .add(new Lighting(game.quality.shadows))
    .add(new Ground())
    .add(new DemoCamera())
    .add(hud);

  game.start();
}

boot();
