import { Vector3 } from "three";
import { dampFactor } from "../core/math";
import type { FrameContext, System } from "../core/System";
import { forwardVector, type FlightStateSource } from "../flight/FlightState";

export interface ChaseCameraOptions {
  /** 静止時に鳥の後ろへ取る距離 (m) */
  readonly distance: number;
  /** 速度 1 m/s あたり、さらに後ろへ下がる距離 (m)。速度感を出すために効かせる */
  readonly speedPull: number;
  /** 鳥より上へ取る高さ (m) */
  readonly height: number;
  /** 鳥のどれだけ前を見るか (m) */
  readonly lookAhead: number;
  /** 位置の追従の速さ。小さいほど旋回で置いていかれる */
  readonly followRate: number;
  /** 鳥のバンク角のうち、カメラも一緒に傾く割合 */
  readonly rollRatio: number;
  /** カメラがこれより下へ潜らない高さ (m) */
  readonly minAltitude: number;
}

export const DEFAULT_CHASE_CAMERA: ChaseCameraOptions = {
  distance: 16,
  speedPull: 0.06,
  height: 4.5,
  lookAhead: 12,
  followRate: 6,
  rollRatio: 0.35,
  minAltitude: 2.5,
};

/**
 * 鳥の背後を、バネのように遅れて追う三人称カメラ。
 *
 * `update` で動かしているのは、System の約束事に従うため。
 * 「カメラを動かす側は update、カメラに追従する側 (Sky / Terrain) は lateUpdate」
 * と分けることで、追従が 1 フレーム遅れない。
 * そのため main.ts では Bird より後、かつ update フェーズに登録する。
 *
 * 位置だけを遅らせ、視線は毎フレーム鳥に正確に向ける。両方遅らせると
 * 急旋回で鳥が画面から外れ、どこを飛んでいるのか分からなくなる。
 */
export class ChaseCamera implements System {
  readonly name = "chase-camera";

  /** Vector3 の生成を毎フレーム繰り返さないための作業用 */
  private readonly desired = new Vector3();
  private readonly lookTarget = new Vector3();
  private snapped = false;

  constructor(
    private readonly target: FlightStateSource,
    private readonly options: ChaseCameraOptions = DEFAULT_CHASE_CAMERA,
  ) {}

  update(ctx: FrameContext): void {
    const { position, yaw, pitch, roll, speed } = this.target.flight;
    const { options } = this;
    const forward = forwardVector(yaw, pitch);
    const back = options.distance + speed * options.speedPull;

    this.desired.set(
      position.x - forward.x * back,
      Math.max(
        position.y - forward.y * back + options.height,
        options.minAltitude,
      ),
      position.z - forward.z * back,
    );

    if (this.snapped) {
      ctx.camera.position.lerp(
        this.desired,
        dampFactor(options.followRate, ctx.dt),
      );
    } else {
      // 初回はカメラが原点にいるので、補間すると遠くから飛んでくる
      ctx.camera.position.copy(this.desired);
      this.snapped = true;
    }

    this.lookTarget.set(
      position.x + forward.x * options.lookAhead,
      position.y + forward.y * options.lookAhead,
      position.z + forward.z * options.lookAhead,
    );
    ctx.camera.lookAt(this.lookTarget);

    // lookAt は必ず水平な視界を作るので、そのあとで機体と一緒に傾ける。
    // 傾きが無いと、旋回しているのに景色が回らず、曲がった感じがしない。
    // rotation.z の + は右側が上がる向きなので、右バンク (roll > 0) には負を入れる。
    ctx.camera.rotateZ(-roll * options.rollRatio);
  }
}
