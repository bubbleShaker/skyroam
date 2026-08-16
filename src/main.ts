import { Game } from "./core/Game";
import { CompositeInput } from "./input/CompositeInput";
import { KeyboardInput } from "./input/KeyboardInput";
import { TouchInput } from "./input/TouchInput";
import { Sky } from "./scene/Sky";
import { Ground, GROUND_SIZE } from "./scene/Ground";
import { Lighting } from "./scene/Lighting";
import { Bird } from "./scene/Bird";
import { ChaseCamera } from "./scene/ChaseCamera";
import { Hud } from "./ui/Hud";
import { FlightHud } from "./ui/FlightHud";
import { ControlsOverlay } from "./ui/ControlsOverlay";

function boot(hudElement: HTMLElement): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#app");
  if (!canvas) throw new Error("canvas (#app) が見つかりません");

  const game = new Game(canvas);

  const hud = new Hud(hudElement);
  hud.set("build", `skyroam M1 (${game.quality.tier})`);

  // キーボードとタッチを常に両方生かす。端末で分岐しないので、
  // タッチ対応ノート PC でもスマホ + キーボードでも両方の操作が効く。
  const input = new CompositeInput(new KeyboardInput(), new TouchInput());
  const bird = new Bird(input);

  game
    // 入力源も System として登録する。毎フレームの更新は無いが、
    // イベントリスナと DOM の破棄を Game のライフサイクルに任せられる。
    .add(input)
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
    // 登録順が意味を持つのはこの 3 つ。Bird が飛行状態を更新し、
    // ChaseCamera がそれを見てカメラを動かし（ここまでが update フェーズ）、
    // Sky と Ground は lateUpdate で確定後のカメラ位置に追従する。
    .add(bird)
    .add(new ChaseCamera(bird))
    .add(new FlightHud(bird, hud))
    .add(hud)
    .add(new ControlsOverlay());

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
