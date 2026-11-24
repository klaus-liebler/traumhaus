import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ITEMS, type ItemDef } from './catalog';

/**
 * „Balançoire et toboggan Playmobil“ (Schaukel und Rutsche) von LaWouattebete, Cults3D, Lizenz CC BY.
 * Die STL-Teile liegen unter assets-src/cults-schaukel/ und werden mit `npm run models` nach public/models/cults.json gebündelt.
 * Die Teile sind fürs Drucken flach ausgerichtet und werden hier zusammengebaut (Maße in mm, y nach oben).
 */
export const CULTS_CREDIT = 'Schaukel & Wal-Rutsche: „Balançoire et toboggan Playmobil“ von LaWouattebete (Cults3D), CC BY';

/** mm → Meter im Planer (eine 75-mm-Figur ist hier etwa 1,78 m groß) */
const MM = 1.78 / 75;
const raw = new Map<string, THREE.BufferGeometry>();

interface Part { file: string; color: number | 'tint'; rot?: THREE.Euler; mirrorZ?: boolean; x: number; z: number; y0: number }

function placePart(p: Part): THREE.BufferGeometry {
  let g = raw.get(p.file)!.clone();
  if (p.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(p.rot));
  if (p.mirrorZ) {
    g.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i + 1), ay = pos.getY(i + 1), az = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, ax, ay, az);
    }
  }
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.translate(p.x - (b.min.x + b.max.x) / 2, p.y0 - b.min.y, p.z - (b.min.z + b.max.z) / 2);
  g.deleteAttribute('normal');
  g = toCreasedNormals(g, Math.PI / 5);
  return g;
}

function assemble(parts: Part[], tint: number) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const mats = new Map<number, THREE.Material>();
  for (const p of parts) {
    const col = p.color === 'tint' ? tint : p.color;
    let m = mats.get(col);
    if (!m) mats.set(col, (m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 })));
    const mesh = new THREE.Mesh(placePart(p), m);
    mesh.castShadow = mesh.receiveShadow = true;
    inner.add(mesh);
  }
  inner.scale.setScalar(MM);
  const box = new THREE.Box3().setFromObject(inner);
  inner.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  return g;
}

const Rx = (a: number) => new THREE.Euler(a, 0, 0);
const Ry = (a: number) => new THREE.Euler(0, a, 0);
const Rz = (a: number) => new THREE.Euler(0, 0, a);

// --- Schaukel ---------------------------------------------------------------
const BAR_Z = 0, TOP_Y = 86.5, CORD_BOTTOM = TOP_Y - 62.5;
const swingParts = (): Part[] => [
  { file: 'ground', color: 0x5cbf4a, rot: Rx(-Math.PI / 2), x: 0, z: 0, y0: 0 },
  { file: 'barR', color: 'tint', rot: Rz(Math.PI / 2), x: 34.9, z: BAR_Z, y0: 1 },
  { file: 'barL', color: 'tint', rot: Rz(Math.PI / 2), x: -34.9, z: BAR_Z, y0: 1 },
  { file: 'barTop', color: 'tint', x: 0, z: BAR_Z, y0: TOP_Y - 9.5 },
  { file: 'cord', color: 0x6b7078, rot: Ry(-Math.PI / 2), x: 15.5, z: BAR_Z, y0: CORD_BOTTOM },
  { file: 'cord', color: 0x6b7078, rot: Ry(-Math.PI / 2), x: -15.5, z: BAR_Z, y0: CORD_BOTTOM },
  { file: 'seat', color: 0xe23b3b, rot: Rx(-Math.PI / 2), x: 0, z: BAR_Z, y0: CORD_BOTTOM + 2 - 13 },
];

// --- Wal-Rutsche --------------------------------------------------------------
const slideParts = (): Part[] => [
  { file: 'slide', color: 0x9aa7b8, x: 0, z: 0, y0: 0 },
  { file: 'whaleL', color: 'tint', x: 0, z: -15.2, y0: 0 },
  { file: 'whaleR', color: 'tint', mirrorZ: true, x: 0, z: 15.2, y0: 0 },
];

/** Lädt die Cults3D-Modelle und hängt sie an den Katalog an */
export async function loadCults(url = 'models/cults.json'): Promise<number> {
  const bundle = (await (await fetch(url)).json()) as Record<string, string>;
  const loader = new STLLoader();
  for (const [k, b64] of Object.entries(bundle)) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    raw.set(k, loader.parse(u.buffer));
  }
  const defs: ItemDef[] = [
    { id: 'c-babyschaukel', name: 'Babyschaukel', cat: 'garten', placement: 'floor', colors: [0xf4d03f, 0xff8fc8, 0x5dade2, 0xffffff, 0xa0d468], build: (c) => assemble(swingParts(), c) },
    { id: 'c-walrutsche', name: 'Wal-Rutsche', cat: 'garten', placement: 'floor', colors: [0x2e5cc8, 0xff8fc8, 0x8e6fd8, 0x48c9b0, 0xf4d03f], build: (c) => assemble(slideParts(), c) },
  ];
  ITEMS.push(...defs);
  return defs.length;
}
