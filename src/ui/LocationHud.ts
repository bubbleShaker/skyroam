import type { System } from "../core/System";
import type { FlightStateSource } from "../flight/FlightState";
import { formatLonLat, worldToLonLat } from "../world/geo";
import type { Landmass } from "../world/landmass";
import type { Hud } from "./Hud";

/**
 * 現在地（緯度経度と陸/海）を HUD に流し込む System。
 *
 * FlightHud と同じく、飛行と UI の間に挟むだけの繋ぎ込み。
 * M2-a では、これが座標変換と陸/海判定の唯一の目に見える出口であり、
 * 計算が合っているかの検算そのものになっている。M7 の地図の前哨でもある。
 */
export class LocationHud implements System {
  readonly name = "location-hud";

  constructor(
    private readonly target: FlightStateSource,
    private readonly landmass: Landmass,
    private readonly hud: Hud,
  ) {}

  /** 行の並び順は Hud への登録順で決まるので、最初に確定させておく */
  init(): void {
    this.write();
  }

  update(): void {
    this.write();
  }

  private write(): void {
    const { x, z } = this.target.flight.position;
    const position = worldToLonLat({ x, z });

    this.hud.set("pos", formatLonLat(position));

    // 範囲外を「海」と一括りにすると、データが欠けているのか本当に外洋なのかが
    // 分からなくなる。開発中に効くので、ここでは区別して出す
    const terrain = !this.landmass.covers(position)
      ? "範囲外"
      : this.landmass.isLand(position)
        ? "陸上"
        : "海上";
    this.hud.set("terrain", terrain);
  }
}
