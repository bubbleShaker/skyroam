import {
  BackSide,
  Color,
  Fog,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import type { FrameContext, InitContext, System } from "../core/System";

export interface SkyOptions {
  /** 空を表す球の半径。カメラの描画距離より内側にする */
  readonly radius: number;
  /** これより手前は霧がかからない距離 (m) */
  readonly fogNear: number;
  /** これより奥は完全に霧の色になる距離 (m) */
  readonly fogFar: number;
}

/**
 * 空のグラデーションと大気（fog）。
 *
 * 内側を向いた巨大な球にシェーダーを貼る方式。テクスチャを持たずに済み、
 * 色を uniform で差し替えられるので、M5 の昼夜サイクルでそのまま使える。
 *
 * fog もこの System の責務に含めている。fog の色は「遠くの空の色」であり、
 * 空の色とは常に一致していなければならない。別々に管理すると、夜になった時に
 * 遠景だけ昼の色で残る、といった破綻が起きる。
 */
export class Sky implements System {
  readonly name = "sky";

  private readonly material: ShaderMaterial;
  private readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly fog: Fog;

  constructor(options: SkyOptions) {
    const top = new Color("#2a6fd6");
    const bottom = new Color("#bcd8f0");

    this.material = new ShaderMaterial({
      uniforms: {
        topColor: { value: top.clone() },
        bottomColor: { value: bottom.clone() },
        // 地平線をどれだけ上下にずらすか（正規化済みの高さに加算する）
        offset: { value: 0.0 },
        // 大きいほど地平線側の明るい帯が薄くなる
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDirection;
        void main() {
          // 球はカメラに追従して原点中心のまま動くので、オブジェクト空間の
          // 頂点位置がそのまま「カメラから見た方向」になる。
          // ワールド座標を使うと、原点から遠く離れた場所（M2 の大陸間移動）で
          // 正規化した y 成分が 0 に潰れ、空が単色になってしまう。
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vDirection;
        void main() {
          float h = normalize(vDirection).y + offset;
          float t = pow(clamp(h, 0.0, 1.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });

    this.mesh = new Mesh(
      new SphereGeometry(options.radius, 32, 16),
      this.material,
    );
    // 空は常に最初に、深度を書かずに描く
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;

    // 地平線側の色 = 遠景が溶け込む色
    this.fog = new Fog(bottom.clone(), options.fogNear, options.fogFar);
  }

  init(ctx: InitContext): void {
    ctx.scene.add(this.mesh);
    ctx.scene.fog = this.fog;
  }

  /**
   * カメラ追従は lateUpdate で行う。update で行うと、同フレームに動いた
   * カメラの位置がまだ反映されておらず 1 フレーム遅れる。
   */
  lateUpdate(ctx: FrameContext): void {
    this.mesh.position.copy(ctx.camera.position);
  }

  /** 昼夜サイクル (M5) から呼ぶ想定。fog も同時に追従させる */
  setColors(top: Color, bottom: Color): void {
    (this.material.uniforms.topColor!.value as Color).copy(top);
    (this.material.uniforms.bottomColor!.value as Color).copy(bottom);
    this.fog.color.copy(bottom);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
