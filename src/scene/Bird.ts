import type { FrameContext, InitContext, System } from "../core/System";
import type { InputSource } from "../flight/FlightInput";
import { stepFlight } from "../flight/flightModel";
import { createFlightState, type FlightState } from "../flight/FlightState";
import { DEFAULT_TUNING, type FlightTuning } from "../flight/tuning";
import { BirdMesh } from "./BirdMesh";

/**
 * プレイヤーの鳥。飛行状態を持ち、毎フレーム入力を飛行モデルに通して、
 * 結果を three のオブジェクトへ写す。
 *
 * このクラスは飛行の規則を一切持たない。規則は flightModel.ts、体感の数値は
 * tuning.ts、見た目は BirdMesh にある。ここにあるのは「入力を読む → モデルを
 * 1 ステップ進める → 描画用オブジェクトに反映する」という繋ぎ込みだけ。
 *
 * 入力源の寿命は Bird が持つ（Bird が唯一の利用者なので、破棄漏れを防ぐには
 * ここで面倒を見るのが確実）。
 */
export class Bird implements System {
  readonly name = "bird";

  private state: FlightState;
  private readonly birdMesh = new BirdMesh();

  constructor(
    private readonly input: InputSource,
    initial: Partial<FlightState> = {},
    private readonly tuning: FlightTuning = DEFAULT_TUNING,
  ) {
    this.state = createFlightState(initial);
    // 機首方位 → 機首の上下 → バンク の順で合成する（航空機の姿勢の合成順）。
    // 既定の "XYZ" だと、バンクした状態でのピッチ操作が斜めにねじれる。
    this.birdMesh.object.rotation.order = "YXZ";
    this.applyToMesh();
  }

  /** 追従カメラや HUD が読む。書き換えは stepFlight 経由に限る（readonly な型） */
  get flight(): FlightState {
    return this.state;
  }

  init(ctx: InitContext): void {
    ctx.scene.add(this.birdMesh.object);
  }

  update(ctx: FrameContext): void {
    this.state = stepFlight(
      this.state,
      this.input.read(),
      ctx.dt,
      this.tuning,
    );
    this.applyToMesh();
  }

  dispose(): void {
    this.input.dispose?.();
    this.birdMesh.dispose();
  }

  private applyToMesh(): void {
    const { position, yaw, pitch, roll, flapPhase, flapping } = this.state;
    this.birdMesh.object.position.set(position.x, position.y, position.z);
    // roll は「+ が右バンク」。three の rotation.z は + で右翼が上がるので反転する
    this.birdMesh.object.rotation.set(pitch, yaw, -roll);
    this.birdMesh.update(flapPhase, flapping);
  }
}
