import type { FlightInput } from "../flight/FlightInput";

/**
 * キー割り当て。`KeyboardEvent.code`（キーの物理的な位置）を使う。
 *
 * `key`（入力される文字）ではなく `code` を見るのは、キーボード配列や
 * IME の状態に左右されないため。日本語入力が有効なままでも WASD は動く。
 */
export const KEY_BINDINGS = {
  pitchUp: ["KeyW", "ArrowUp"],
  pitchDown: ["KeyS", "ArrowDown"],
  rollLeft: ["KeyA", "ArrowLeft"],
  rollRight: ["KeyD", "ArrowRight"],
  flap: ["Space"],
  boost: ["ShiftLeft", "ShiftRight"],
} as const;

const BOUND_CODES: ReadonlySet<string> = new Set(
  Object.values(KEY_BINDINGS).flat(),
);

/** ゲームが使うキーか。ブラウザ既定の動作（Space でのスクロール等）を止める判断に使う */
export function isBoundKey(code: string): boolean {
  return BOUND_CODES.has(code);
}

function anyPressed(
  pressed: ReadonlySet<string>,
  codes: readonly string[],
): boolean {
  return codes.some((code) => pressed.has(code));
}

/**
 * 押されているキーの集合を飛行入力に変換する。
 *
 * DOM を触らない純粋関数にしてあるので、キー割り当ての正しさだけを
 * ブラウザ無しでテストできる。KeyboardInput 側はイベントの購読と
 * 集合の出し入れに専念する。
 */
export function keysToInput(pressed: ReadonlySet<string>): FlightInput {
  const up = anyPressed(pressed, KEY_BINDINGS.pitchUp);
  const down = anyPressed(pressed, KEY_BINDINGS.pitchDown);
  const left = anyPressed(pressed, KEY_BINDINGS.rollLeft);
  const right = anyPressed(pressed, KEY_BINDINGS.rollRight);

  return {
    // 逆方向を同時押しした時は打ち消し合って 0 にする
    pitch: (up ? 1 : 0) - (down ? 1 : 0),
    roll: (right ? 1 : 0) - (left ? 1 : 0),
    flap: anyPressed(pressed, KEY_BINDINGS.flap),
    boost: anyPressed(pressed, KEY_BINDINGS.boost),
  };
}
