import { isTouchPrimary } from "../core/device";
import type { System } from "../core/System";

interface ControlRow {
  readonly keys: string;
  readonly action: string;
}

/** フェードアウトにかける時間 (ms)。style.css の transition と揃えること */
const FADE_MS = 320;

const KEYBOARD_ROWS: readonly ControlRow[] = [
  { keys: "W / S ・ ↑ / ↓", action: "機首を上下する" },
  { keys: "A / D ・ ← / →", action: "傾けて旋回する" },
  { keys: "Space", action: "羽ばたく（加速・高度を保つ）" },
  { keys: "Shift", action: "ブースト" },
];

const TOUCH_ROWS: readonly ControlRow[] = [
  { keys: "左のスティック", action: "機首を上下する・旋回する" },
  { keys: "羽ばたく", action: "加速して高度を保つ" },
  { keys: "ブースト", action: "さらに加速する" },
];

/**
 * 起動時に一度だけ出す操作説明。何か操作した瞬間に消える。
 *
 * 表示したことを localStorage に覚えさせていないのは、覚えさせると
 * 「もう一度確認したい」が二度とできなくなり、そのためのヘルプボタンや
 * 設定画面が必要になるため。触れば即座に消えるので、毎回出しても邪魔にならない。
 *
 * System にしてあるのは、生成と破棄を Game のライフサイクルに乗せるためだけで、
 * 毎フレームの更新は持たない。
 */
export class ControlsOverlay implements System {
  readonly name = "controls-overlay";

  private readonly root: HTMLDivElement;
  private dismissed = false;
  private removalTimer = 0;

  constructor(private readonly container: HTMLElement = document.body) {
    const rows = isTouchPrimary() ? TOUCH_ROWS : KEYBOARD_ROWS;

    this.root = document.createElement("div");
    this.root.className = "controls-overlay";

    const panel = document.createElement("div");
    panel.className = "controls-overlay__panel";

    const title = document.createElement("h1");
    title.className = "controls-overlay__title";
    title.textContent = "skyroam";

    const lead = document.createElement("p");
    lead.className = "controls-overlay__lead";
    lead.textContent = "鳥になって東アジアの上空を飛ぶ。";

    const list = document.createElement("dl");
    list.className = "controls-overlay__list";
    for (const row of rows) {
      const keys = document.createElement("dt");
      keys.textContent = row.keys;
      const action = document.createElement("dd");
      action.textContent = row.action;
      list.append(keys, action);
    }

    const hint = document.createElement("p");
    hint.className = "controls-overlay__hint";
    hint.textContent = isTouchPrimary()
      ? "画面をタップすると始まります"
      : "キーを押すか、クリックすると始まります";

    panel.append(title, lead, list, hint);
    this.root.append(panel);
    this.container.append(this.root);

    // capture フェーズで拾う。操作 UI やキャンバスが先に受け取って
    // 止めてしまっても、確実に閉じられるようにするため。
    window.addEventListener("pointerdown", this.dismiss, { capture: true });
    window.addEventListener("keydown", this.dismiss, { capture: true });
  }

  dispose(): void {
    this.detach();
    window.clearTimeout(this.removalTimer);
    this.root.remove();
  }

  private dismiss = (): void => {
    if (this.dismissed) return;
    this.dismissed = true;
    this.detach();

    // すぐに remove せず、CSS の transition でフェードアウトさせる。
    // クラス側で pointer-events を切ってあるので、消えていく最中の
    // クリックは背後のゲームに届く。
    this.root.classList.add("is-dismissed");

    // 削除は transitionend ではなくタイマーで行う。背景タブや
    // prefers-reduced-motion では transition が走らずイベントが来ないため、
    // それに頼ると要素が DOM に残り続ける。
    this.removalTimer = window.setTimeout(() => this.root.remove(), FADE_MS);
  };

  private detach(): void {
    window.removeEventListener("pointerdown", this.dismiss, { capture: true });
    window.removeEventListener("keydown", this.dismiss, { capture: true });
  }
}
