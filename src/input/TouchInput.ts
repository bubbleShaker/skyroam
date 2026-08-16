import { isTouchPrimary } from "../core/device";
import type { FlightInput, InputSource } from "../flight/FlightInput";
import { readStick, type StickReading } from "./stick";

const NEUTRAL_READING: StickReading = { roll: 0, pitch: 0, knobX: 0, knobY: 0 };

/**
 * スマホ用の入力。左に仮想スティック、右に羽ばたき/ブーストのボタンを出す。
 *
 * 操作 UI の DOM もこのクラスが作る。HTML 側に置くと「タッチ操作の見た目」と
 * 「タッチ操作の読み取り」が別ファイルに分かれ、片方だけ変えて壊れる。
 *
 * ボタンに `<button>` を使わず div にしているのは、フォーカスを持つ要素だと
 * Space キー（＝羽ばたき）でクリックが発火し、キーボード操作と二重に反応するため。
 */
export class TouchInput implements InputSource {
  readonly name = "touch";

  private readonly root: HTMLDivElement;
  private readonly stickBase: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;

  private stickPointerId: number | null = null;
  private reading: StickReading = NEUTRAL_READING;
  private flapHeld = false;
  private boostHeld = false;
  private visible = false;

  constructor(private readonly container: HTMLElement = document.body) {
    this.root = document.createElement("div");
    this.root.className = "touch-controls";
    this.root.hidden = true;

    this.stickBase = document.createElement("div");
    this.stickBase.className = "touch-stick";
    this.stickKnob = document.createElement("div");
    this.stickKnob.className = "touch-stick__knob";
    this.stickBase.append(this.stickKnob);

    const buttons = document.createElement("div");
    buttons.className = "touch-buttons";
    buttons.append(
      this.createButton("ブースト", "touch-button--boost", (held) => {
        this.boostHeld = held;
      }),
      this.createButton("羽ばたく", "touch-button--flap", (held) => {
        this.flapHeld = held;
      }),
    );

    this.root.append(this.stickBase, buttons);
    this.container.append(this.root);

    this.stickBase.addEventListener("pointerdown", this.handleStickDown);
    this.stickBase.addEventListener("pointermove", this.handleStickMove);
    this.stickBase.addEventListener("pointerup", this.handleStickUp);
    this.stickBase.addEventListener("pointercancel", this.handleStickUp);

    if (isTouchPrimary()) {
      this.show();
    } else {
      // タッチ対応ノート PC では、初期判定は PC でも指で触られうる。
      // 実際にタッチが来た時点で操作 UI を出す。
      window.addEventListener("pointerdown", this.revealOnTouch);
    }
  }

  read(): FlightInput {
    return {
      pitch: this.reading.pitch,
      roll: this.reading.roll,
      flap: this.flapHeld,
      boost: this.boostHeld,
    };
  }

  dispose(): void {
    window.removeEventListener("pointerdown", this.revealOnTouch);
    this.stickBase.removeEventListener("pointerdown", this.handleStickDown);
    this.stickBase.removeEventListener("pointermove", this.handleStickMove);
    this.stickBase.removeEventListener("pointerup", this.handleStickUp);
    this.stickBase.removeEventListener("pointercancel", this.handleStickUp);
    this.root.remove();
  }

  private show(): void {
    if (this.visible) return;
    this.visible = true;
    this.root.hidden = false;
    window.removeEventListener("pointerdown", this.revealOnTouch);
  }

  private revealOnTouch = (event: PointerEvent): void => {
    if (event.pointerType === "touch") this.show();
  };

  private createButton(
    label: string,
    modifier: string,
    setHeld: (held: boolean) => void,
  ): HTMLDivElement {
    const button = document.createElement("div");
    button.className = `touch-button ${modifier}`;
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", label);
    button.textContent = label;

    const press = (event: PointerEvent): void => {
      event.preventDefault();
      // 指がボタンの外へ滑っても離した瞬間を受け取れるようにする。
      // これが無いと、押したまま指をずらして離した時にボタンが押しっぱなしになる。
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-held");
      setHeld(true);
    };
    const release = (): void => {
      button.classList.remove("is-held");
      setHeld(false);
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    return button;
  }

  private handleStickDown = (event: PointerEvent): void => {
    // 2 本目以降の指はスティックを乗っ取らない
    if (this.stickPointerId !== null) return;
    event.preventDefault();
    this.stickPointerId = event.pointerId;
    this.stickBase.setPointerCapture(event.pointerId);
    this.updateStick(event);
  };

  private handleStickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.stickPointerId) return;
    event.preventDefault();
    this.updateStick(event);
  };

  private handleStickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.stickPointerId) return;
    this.stickPointerId = null;
    this.reading = NEUTRAL_READING;
    this.stickKnob.style.transform = "";
  };

  /**
   * スティックの中心を原点として指のずれを測る。
   * 位置と大きさは CSS 側で決まるので、毎回 DOM から実寸を読む
   * （画面回転やセーフエリアの変化に追従させるため）。
   */
  private updateStick(event: PointerEvent): void {
    const rect = this.stickBase.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = event.clientX - (rect.left + radius);
    const dy = event.clientY - (rect.top + rect.height / 2);

    this.reading = readStick(dx, dy, radius);
    this.stickKnob.style.transform = `translate(${this.reading.knobX}px, ${this.reading.knobY}px)`;
  }
}
