import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Scene, Vector3 } from "three";
import { Bird } from "./Bird";
import { ChaseCamera } from "./ChaseCamera";
import {
  createFlightState,
  forwardVector,
  type FlightStateSource,
} from "../flight/FlightState";
import { NEUTRAL_INPUT, type InputSource } from "../flight/FlightInput";

/**
 * 飛行モデル（純粋な角度）と three（Euler / 右手系）の境界のテスト。
 *
 * ここは純粋関数の外側なので、これまで無検証だった。実際に BirdMesh の
 * 上反角の符号を取り違えていた場所でもあり、リファクタで静かに壊れやすい。
 */

const IDLE_INPUT: InputSource = { name: "idle", read: () => NEUTRAL_INPUT };

/** Bird がシーンに足した Object3D を取り出す */
function spawn(state: Parameters<typeof createFlightState>[0]) {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const bird = new Bird(IDLE_INPUT, state);
  bird.init({ scene, camera });
  // 前提を明示しておく。Bird が別のものも足すようになったら、
  // 静かに違うオブジェクトを検証し始めるのではなくここで落ちてほしい
  expect(scene.children).toHaveLength(1);
  const object = scene.children[0]!;
  object.updateMatrixWorld(true);
  return { bird, object, scene, camera };
}

describe("Bird の姿勢と three の対応", () => {
  it.each([
    { yaw: 0, pitch: 0 },
    { yaw: 0.9, pitch: 0.3 },
    { yaw: -2.4, pitch: -0.7 },
    { yaw: Math.PI, pitch: 1.2 },
  ])("機首の向きが forwardVector と一致する (yaw=$yaw, pitch=$pitch)", (angles) => {
    const { object } = spawn({ ...angles, roll: 0.4 });
    // Object3D.getWorldDirection が返すのは +z 軸（-z を返すのは Camera の
    // オーバーライドだけ）。鳥の機首は -z 側なので反転して比べる。
    const actual = object.getWorldDirection(new Vector3()).negate();
    const expected = forwardVector(angles.yaw, angles.pitch);

    expect(actual.x).toBeCloseTo(expected.x, 6);
    expect(actual.y).toBeCloseTo(expected.y, 6);
    expect(actual.z).toBeCloseTo(expected.z, 6);
  });

  it("バンクしても機首の向きは変わらない（roll は視線軸まわりの回転）", () => {
    const level = spawn({ yaw: 0.5, pitch: 0.2, roll: 0 });
    const banked = spawn({ yaw: 0.5, pitch: 0.2, roll: 1.2 });

    const a = level.object.getWorldDirection(new Vector3());
    const b = banked.object.getWorldDirection(new Vector3());
    expect(a.distanceTo(b)).toBeCloseTo(0, 6);
  });

  it("右バンク (roll > 0) で右翼が下がる", () => {
    const { object } = spawn({ roll: 0.6 });
    const rightWing = new Vector3(1, 0, 0).applyQuaternion(object.quaternion);
    expect(rightWing.y).toBeLessThan(0);
  });

  it("左バンク (roll < 0) で右翼が上がる", () => {
    const { object } = spawn({ roll: -0.6 });
    const rightWing = new Vector3(1, 0, 0).applyQuaternion(object.quaternion);
    expect(rightWing.y).toBeGreaterThan(0);
  });
});

describe("ChaseCamera の傾き", () => {
  /** FlightStateSource のおかげで Bird を組み立てずに状態を差し込める */
  function look(roll: number): Vector3 {
    const source: FlightStateSource = { flight: createFlightState({ roll }) };
    const camera = new PerspectiveCamera();
    new ChaseCamera(source).update({
      dt: 1 / 60,
      elapsed: 0,
      scene: new Scene(),
      camera,
    });
    return new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  }

  it("水平飛行では視界も水平", () => {
    expect(look(0).y).toBeCloseTo(0, 6);
  });

  it("右バンクではカメラも右下がりに傾く（機体と同じ向き）", () => {
    expect(look(0.6).y).toBeLessThan(0);
  });

  it("左バンクでは逆に傾く", () => {
    expect(look(-0.6).y).toBeGreaterThan(0);
  });
});
