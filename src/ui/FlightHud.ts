import type { System } from "../core/System";
import type { FlightStateSource } from "../flight/FlightState";
import { DEFAULT_TUNING, type FlightTuning } from "../flight/tuning";
import type { Hud } from "./Hud";

/**
 * 鳥の状態を HUD の行に流し込むだけの System。
 *
 * Hud（表示の器）と Bird（飛行）の間に挟むことで、Hud は何を表示するか知らず、
 * Bird は UI を知らないままでいられる。M7 で緯度経度や国名を出す時も、
 * 同じように専用の System を足すだけで済む。
 */
export class FlightHud implements System {
  readonly name = "flight-hud";

  constructor(
    private readonly target: FlightStateSource,
    private readonly hud: Hud,
    private readonly tuning: FlightTuning = DEFAULT_TUNING,
  ) {}

  /** 行の並び順は Hud への登録順で決まるので、最初に確定させておく */
  init(): void {
    this.write();
  }

  update(): void {
    this.write();
  }

  private write(): void {
    const { speed, position, stalling } = this.target.flight;

    const stall = stalling ? `  ⚠ 失速 (${this.tuning.stallSpeed} 未満)` : "";
    this.hud.set("speed", `${speed.toFixed(0)} m/s${stall}`);

    // 天井に張り付くと、機首上げを入れているのに機首が水平に戻される。
    // 上空には地面のような手がかりが無いので、何も出さないと
    // 「操作が効かなくなった」ようにしか見えない。
    const ceiling = position.y >= this.tuning.maxAltitude ? "  ⚠ 上限高度" : "";
    this.hud.set("alt", `${Math.round(position.y)} m${ceiling}`);
  }
}
