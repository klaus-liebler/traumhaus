import * as THREE from 'three';
import type { ItemDef } from './catalog';
import type { HouseDef } from './houses';
import { buildHouse } from './houseBuilder';

function setup(w: number, h: number) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0c0d0, 2.0));
  const d = new THREE.DirectionalLight(0xffffff, 1.6);
  d.position.set(3, 6, 5);
  scene.add(d);
  return { r, scene };
}

const disposeTree = (o: THREE.Object3D) =>
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => mt.dispose());
    }
  });

export function renderItemThumbs(defs: ItemDef[]): Map<string, string> {
  const out = new Map<string, string>();
  const { r, scene } = setup(160, 160);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  for (const d of defs) {
    const g = d.build(d.colors[0]);
    scene.add(g);
    const box = new THREE.Box3().setFromObject(g);
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const dir = d.placement === 'wall' ? new THREE.Vector3(0.5, 0.25, 1) : d.flat ? new THREE.Vector3(0.6, 1.4, 1) : new THREE.Vector3(0.9, 0.7, 1.2);
    dir.normalize();
    const dist = sph.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02;
    cam.position.copy(sph.center).addScaledVector(dir, dist);
    cam.lookAt(sph.center);
    r.render(scene, cam);
    out.set(d.id, r.domElement.toDataURL());
    scene.remove(g);
    disposeTree(g);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}

export function renderHouseThumbs(defs: HouseDef[]): Map<string, string> {
  const out = new Map<string, string>();
  const { r, scene } = setup(480, 320);
  r.shadowMap.enabled = false;
  scene.background = new THREE.Color(0xbfe6ff);
  const cam = new THREE.PerspectiveCamera(35, 1.5, 0.1, 200);
  for (const d of defs) {
    const h = buildHouse(d);
    h.roof.visible = true;
    scene.add(h.group);
    const c = h.center;
    const s = Math.max(h.size.x, h.size.z);
    cam.position.set(c.x + s * 0.9, s * 0.8 + h.size.y * 0.5, c.z + s * 1.45);
    cam.lookAt(c.x, h.size.y * 0.35, c.z);
    r.render(scene, cam);
    out.set(d.id, r.domElement.toDataURL('image/jpeg', 0.85));
    scene.remove(h.group);
    h.dispose();
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
