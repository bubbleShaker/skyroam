/** three の Vector3 を使わない最小の 3 次元座標。飛行モデルを three から切り離すため */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * 鳥の飛行状態。数値だけで構成され、three のオブジェクトを一切含まない。
 *
 * 姿勢をクォータニオンではなく 3 つの角度で持つのは、飛行のルールが
 * 「バンク角に比例して機首方位が変わる」「機首の上下で加減速する」という、
 * 角度そのものを名指しする形をしているため。宙返りは想定しないので、
 * pitch を ±maxPitch にクランプしてジンバルロックを避ける。
 */
export interface FlightState {
  /** ワールド座標 (m)。y が高度 */
  readonly position: Vec3;
  /** 機首方位 (rad)。y 軸まわり。0 で -z 方向を向く（three の既定の前方） */
  readonly yaw: number;
  /** 機首の上下 (rad)。+ が機首上げ */
  readonly pitch: number;
  /** バンク角 (rad)。**+ が右バンク**（three の rotation.z とは符号が逆） */
  readonly roll: number;
  /** 機首方向の速さ (m/s)。常に非負 */
  readonly speed: number;
  /** 羽ばたきの位相 0..1。見た目のアニメーションに使う */
  readonly flapPhase: number;
  /** 今フレーム羽ばたいていたか。翼の振り幅を決めるのに使う */
  readonly flapping: boolean;
  /** 失速速度を下回っているか。HUD の警告に使う */
  readonly stalling: boolean;
}

export function createFlightState(
  overrides: Partial<FlightState> = {},
): FlightState {
  return {
    position: { x: 0, y: 300, z: 0 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    speed: 90,
    flapPhase: 0,
    flapping: false,
    stalling: false,
    ...overrides,
  };
}

/**
 * yaw / pitch から機首方向の単位ベクトルを求める。
 * yaw=0, pitch=0 で (0, 0, -1)。カメラや鳥の向きの計算で共有する。
 */
export function forwardVector(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}
