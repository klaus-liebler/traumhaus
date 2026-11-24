import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Stilisierte Spielzeugfigur (eigene Gestaltung, ca. 1,6 m hoch) */
export class Figure {
  group = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private phase = 0;

  constructor() {
    const m = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 });
    const skin = m(0xffd9b0), shirt = m(0xff5d8f), pants = m(0x3a7bd5), hair = m(0x8a4b22), shoe = m(0x3b3f4a), black = m(0x222222);
    const add = (p: THREE.Object3D, geo: THREE.BufferGeometry, mt: THREE.Material, x: number, y: number, z: number) => {
      const me = new THREE.Mesh(geo, mt);
      me.position.set(x, y, z);
      me.castShadow = true;
      p.add(me);
      return me;
    };
    const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r);

    // Beine (Drehpunkt an der Hüfte)
    for (const [leg, x] of [[this.legL, -0.11], [this.legR, 0.11]] as const) {
      leg.position.set(x, 0.72, 0);
      add(leg, rb(0.2, 0.62, 0.24, 0.06), pants, 0, -0.33, 0);
      add(leg, rb(0.21, 0.1, 0.3, 0.04), shoe, 0, -0.67, 0.03);
      this.group.add(leg);
    }
    add(this.group, rb(0.44, 0.14, 0.26, 0.05), pants, 0, 0.74, 0);
    // Oberkörper (leicht trapezförmig)
    const torso = new THREE.CylinderGeometry(0.2, 0.24, 0.5, 4, 1);
    torso.rotateY(Math.PI / 4);
    torso.scale(1.15, 1, 0.65);
    add(this.group, torso, shirt, 0, 1.06, 0);
    add(this.group, new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), skin, 0, 1.33, 0);
    // Arme (Drehpunkt an der Schulter)
    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(s * 0.29, 1.25, 0);
      const a = add(arm, rb(0.13, 0.46, 0.15, 0.05), shirt, s * 0.02, -0.2, 0);
      a.rotation.z = s * 0.12;
      const hand = add(arm, new THREE.TorusGeometry(0.05, 0.028, 8, 16, Math.PI * 1.5), skin, s * 0.05, -0.47, 0.02);
      hand.rotation.y = Math.PI / 2;
      this.group.add(arm);
    }
    // Kopf
    const head = add(this.group, new THREE.CylinderGeometry(0.19, 0.18, 0.34, 28), skin, 0, 1.55, 0);
    void head;
    add(this.group, new THREE.SphereGeometry(0.19, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 1.71, 0).scale.y = 0.35;
    // Haare: Kappe + Zopf
    const cap = add(this.group, new THREE.SphereGeometry(0.215, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.6, -0.01);
    cap.scale.set(1, 0.95, 1.02);
    add(this.group, rb(0.4, 0.3, 0.12, 0.05), hair, 0, 1.52, -0.13);
    add(this.group, new THREE.SphereGeometry(0.08, 16, 12), hair, 0, 1.6, -0.25);
    add(this.group, new THREE.CylinderGeometry(0.05, 0.03, 0.3, 12), hair, 0, 1.42, -0.27);
    // Gesicht
    for (const s of [-1, 1]) add(this.group, new THREE.SphereGeometry(0.025, 10, 8), black, s * 0.07, 1.58, 0.17);
    const smile = add(this.group, new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI), black, 0, 1.5, 0.175);
    smile.rotation.z = Math.PI;
  }

  animate(dt: number, speed: number) {
    if (speed > 0.01) this.phase += dt * speed * 4.2;
    else this.phase *= 0.85;
    const a = Math.sin(this.phase) * Math.min(1, speed) * 0.6;
    this.legL.rotation.x = a;
    this.legR.rotation.x = -a;
    this.armL.rotation.x = -a * 0.8;
    this.armR.rotation.x = a * 0.8;
  }
}
