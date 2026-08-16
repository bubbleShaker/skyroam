import type { FlightInput, InputSource } from "../flight/FlightInput";
import { NEUTRAL_INPUT } from "../flight/FlightInput";

/** 絶対値の大きい方を採る。符号は勝った側のものを保つ */
function strongest(a: number, b: number): number {
  return Math.abs(b) > Math.abs(a) ? b : a;
}

/**
 * 複数の入力源をひとつに束ねる。
 *
 * 端末で分岐せずキーボードとタッチを常時両方生かすのは、タッチ対応の
 * ノート PC や、スマホに Bluetooth キーボードを繋いだ場合に
 * 「片方しか効かない」状態を避けるため。
 *
 * 軸は合計ではなく**絶対値の大きい方**を採る。合計にすると、キーボードで
 * 左に倒しながらタッチで右に倒した時に打ち消し合って 0 になり、
 * 「押しているのに効かない」という一番不快な挙動になる。
 * 触っていない側は 0 を返すので、この規則なら常に操作中の側が勝つ。
 */
export class CompositeInput implements InputSource {
  readonly name = "composite";

  private readonly sources: readonly InputSource[];

  constructor(...sources: InputSource[]) {
    this.sources = sources;
  }

  read(): FlightInput {
    let merged: FlightInput = NEUTRAL_INPUT;
    for (const source of this.sources) {
      const input = source.read();
      merged = {
        pitch: strongest(merged.pitch, input.pitch),
        roll: strongest(merged.roll, input.roll),
        flap: merged.flap || input.flap,
        boost: merged.boost || input.boost,
      };
    }
    return merged;
  }

  dispose(): void {
    for (const source of this.sources) source.dispose?.();
  }
}
