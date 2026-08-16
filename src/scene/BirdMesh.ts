import {
  BoxGeometry,
  ConeGeometry,
  Color,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from "three";

/** 滑空中の翼の振り幅 (rad)。ゆったり姿勢を整えている程度 */
const GLIDE_SWING = 0.16;
/** 羽ばたき中の翼の振り幅 (rad) */
const FLAP_SWING = 0.85;
/** 翼を常に少し持ち上げておく角度 (rad)。上反角があると鳥らしく見える */
const DIHEDRAL = 0.12;

/**
 * 鳥のプレースホルダー 3D モデル。M1 の間だけの見た目で、
 * 後日ちゃんとしたモデルに差し替える前提。
 *
 * System ではなく素のクラスにしてあるのは、これが「見た目だけ」の部品で、
 * 毎フレームの更新タイミングを持たないため。飛行状態を持つ Bird が
 * 位相を渡して駆動する。見た目と挙動を分けておくと、モデルを差し替える時に
 * 飛行のコードを触らずに済む。
 */
export class BirdMesh {
  readonly object = new Group();

  private readonly leftWing = new Group();
  private readonly rightWing = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  constructor() {
    const bodyMaterial = this.track(
      new MeshLambertMaterial({ color: new Color("#3c4657") }),
    );
    const wingMaterial = this.track(
      new MeshLambertMaterial({ color: new Color("#586479") }),
    );
    const beakMaterial = this.track(
      new MeshLambertMaterial({ color: new Color("#d9863b") }),
    );

    // 胴体: 球を前後に引き伸ばして紡錘形にする
    const body = new SphereGeometry(1, 12, 8);
    body.scale(0.6, 0.6, 2.2);
    this.object.add(this.mesh(body, bodyMaterial));

    const head = new SphereGeometry(0.5, 10, 8);
    head.translate(0, 0.25, -2.0);
    this.object.add(this.mesh(head, bodyMaterial));

    // くちばし: 円錐は既定で +y を向くので、-z（機首方向）へ倒す
    const beak = new ConeGeometry(0.18, 0.8, 8);
    beak.rotateX(-Math.PI / 2);
    beak.translate(0, 0.2, -2.6);
    this.object.add(this.mesh(beak, beakMaterial));

    const tail = new BoxGeometry(1.0, 0.1, 1.3);
    tail.translate(0, 0.1, 2.2);
    this.object.add(this.mesh(tail, bodyMaterial));

    // 翼は付け root の Group を回して羽ばたかせる。
    // 翼そのものを回すと胴体の中心を軸に回ってしまい、付け根がめり込む。
    for (const [pivot, side] of [
      [this.leftWing, -1],
      [this.rightWing, 1],
    ] as const) {
      const wing = new BoxGeometry(3.2, 0.12, 1.4);
      wing.translate(side * 1.9, 0, 0.1);
      pivot.add(this.mesh(wing, wingMaterial));
      pivot.position.set(side * 0.3, 0.15, 0);
      this.object.add(pivot);
    }
  }

  /**
   * 羽ばたきを反映する。
   * @param phase 0..1 の位相
   * @param flapping 羽ばたき中か（滑空中は振り幅を小さくする）
   */
  update(phase: number, flapping: boolean): void {
    const swing = flapping ? FLAP_SWING : GLIDE_SWING;
    const angle = DIHEDRAL + swing * Math.sin(phase * Math.PI * 2);
    // 左翼 (-x) と右翼 (+x) は同じ符号で回すと片方が上、片方が下になるので、
    // 符号を反転させて左右対称に振る
    this.leftWing.rotation.z = angle;
    this.rightWing.rotation.z = -angle;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.object.removeFromParent();
  }

  private mesh(geometry: BufferGeometry, material: Material): Mesh {
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  private track<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
