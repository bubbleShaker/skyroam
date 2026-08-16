import { Color, DirectionalLight, HemisphereLight, Vector3 } from "three";
import type { FrameContext, InitContext, System } from "../core/System";

/**
 * 太陽 (DirectionalLight) と環境光 (HemisphereLight)。
 *
 * M5 の昼夜サイクルは、この 2 つの向きと色を時刻に応じて動かすことで表現する。
 * そのため光源の生成箇所をここに 1 本化しておく。
 */
export class Lighting implements System {
  readonly name = "lighting";

  readonly sun = new DirectionalLight(new Color("#fff4e0"), 2.2);
  readonly ambient = new HemisphereLight(
    new Color("#9fc6ef"), // 空からの光
    new Color("#3a4a38"), // 地面からの照り返し
    1.1,
  );

  /** 太陽を光源として見た時の向き。位置はここを基準にカメラへ追従させる */
  private readonly sunOffset = new Vector3(600, 900, 400);

  constructor(castShadow: boolean) {
    this.sun.position.copy(this.sunOffset);
    this.sun.castShadow = castShadow;
    if (castShadow) {
      this.sun.shadow.mapSize.set(2048, 2048);
      const cam = this.sun.shadow.camera;
      cam.near = 1;
      cam.far = 4_000;
      cam.left = -1_200;
      cam.right = 1_200;
      cam.top = 1_200;
      cam.bottom = -1_200;
    }
  }

  init(ctx: InitContext): void {
    ctx.scene.add(this.sun, this.sun.target, this.ambient);
  }

  /**
   * 影を落とす範囲をカメラに追従させる。
   *
   * DirectionalLight は平行光なので、位置を動かしても照らされ方は変わらない。
   * 動かす必要があるのは影を描く範囲（shadow.camera）の方で、原点に固定したままだと
   * M1 で原点から離れて飛んだ瞬間に鳥の影が消える。
   * y は 0 のままにして、太陽の向きは変えない（変えると影の方向が飛ぶたびに揺れる）。
   */
  lateUpdate(ctx: FrameContext): void {
    const { x, z } = ctx.camera.position;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(
      x + this.sunOffset.x,
      this.sunOffset.y,
      z + this.sunOffset.z,
    );
  }

  dispose(): void {
    this.sun.dispose();
    this.ambient.dispose();
    this.sun.removeFromParent();
    this.ambient.removeFromParent();
  }
}
