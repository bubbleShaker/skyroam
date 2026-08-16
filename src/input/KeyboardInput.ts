import type { FlightInput, InputSource } from "../flight/FlightInput";
import { isBoundKey, keysToInput } from "./keymap";

/**
 * PC 用の入力。押されているキーの集合を保つだけで、
 * 何をどう飛ばすかは keymap.ts と飛行モデルに任せる。
 */
export class KeyboardInput implements InputSource {
  readonly name = "keyboard";

  private readonly pressed = new Set<string>();

  constructor(private readonly target: Window = window) {
    this.target.addEventListener("keydown", this.handleKeyDown);
    this.target.addEventListener("keyup", this.handleKeyUp);
    // キーを押したままタブを離れると keyup が飛んでこず、戻った時に
    // そのキーが押しっぱなしの扱いで残る。フォーカスを失ったら全部離す。
    this.target.addEventListener("blur", this.releaseAll);
  }

  read(): FlightInput {
    return keysToInput(this.pressed);
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("blur", this.releaseAll);
    this.pressed.clear();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    // Ctrl+W や Cmd+R などのブラウザ操作を奪わない
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!isBoundKey(event.code)) return;
    // Space によるページスクロールや矢印キーによる画面移動を止める
    event.preventDefault();
    this.pressed.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private releaseAll = (): void => {
    this.pressed.clear();
  };
}
