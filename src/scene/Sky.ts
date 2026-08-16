import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  type Scene,
} from "three";
import type { System } from "../core/System";

/**
 * 空のグラデーション。
 *
 * 内側を向いた巨大な球にシェーダーを貼る方式。テクスチャを持たずに済み、
 * 色を uniform で差し替えられるので、M5 の昼夜サイクルでそのまま使える。
 * 球はカメラに追従させ、どこまで飛んでも空の外に出ないようにする。
 */
export class Sky implements System {
  readonly name = "sky";

  private readonly material: ShaderMaterial;
  private readonly mesh: Mesh;

  constructor(radius: number) {
    this.material = new ShaderMaterial({
      uniforms: {
        topColor: { value: new Color("#2a6fd6") },
        bottomColor: { value: new Color("#bcd8f0") },
        // グラデーションの中心を水平線からどれだけずらすか
        offset: { value: 0.0 },
        // 大きいほど地平線側の明るい帯が薄くなる
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });

    this.mesh = new Mesh(new SphereGeometry(radius, 32, 16), this.material);
    // 空は常に最初に、深度を書かずに描く
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
  }

  init(ctx: { scene: Scene }): void {
    ctx.scene.add(this.mesh);
  }

  update(ctx: { camera: { position: { x: number; y: number; z: number } } }): void {
    const { x, y, z } = ctx.camera.position;
    this.mesh.position.set(x, y, z);
  }

  /** 昼夜サイクル (M5) から呼ぶ想定 */
  setColors(top: Color, bottom: Color): void {
    (this.material.uniforms.topColor!.value as Color).copy(top);
    (this.material.uniforms.bottomColor!.value as Color).copy(bottom);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
