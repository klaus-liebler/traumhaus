import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { shade } from './textures';

export type Placement = 'floor' | 'wall' | 'ceiling';

export interface ItemDef {
  id: string;
  name: string;
  cat: string;
  placement: Placement;
  colors: number[];
  /** flache Dinge (Teppiche) kollidieren nicht */
  flat?: boolean;
  build: (c: number) => THREE.Group;
}

export interface Category { id: string; name: string; icon: string; kind: 'cover' | 'item'; surface?: 'floor' | 'wall' | 'ceil' }

export const CATEGORIES: Category[] = [
  { id: 'boden', name: 'Böden', icon: '🟫', kind: 'cover', surface: 'floor' },
  { id: 'wand', name: 'Wände', icon: '🎨', kind: 'cover', surface: 'wall' },
  { id: 'decke', name: 'Decken', icon: '☁️', kind: 'cover', surface: 'ceil' },
  { id: 'wohnen', name: 'Wohnzimmer', icon: '🛋️', kind: 'item' },
  { id: 'schlafen', name: 'Schlafzimmer', icon: '🛏️', kind: 'item' },
  { id: 'kueche', name: 'Küche', icon: '🍳', kind: 'item' },
  { id: 'bad', name: 'Bad', icon: '🛁', kind: 'item' },
  { id: 'kinder', name: 'Kinderzimmer', icon: '🧸', kind: 'item' },
  { id: 'elektro', name: 'Elektrogeräte', icon: '📺', kind: 'item' },
  { id: 'deko', name: 'Deko', icon: '🌸', kind: 'item' },
  { id: 'garten', name: 'Garten', icon: '🌳', kind: 'item' },
];

// ---------- Farben ----------
const PINK = 0xff8fb8, ROSE = 0xff5d8f, RED = 0xe8453c, ORANGE = 0xff9f40, YELLOW = 0xffd23f, LIME = 0x9bd34a,
  GREEN = 0x4caf6a, MINT = 0x7fe0c8, TEAL = 0x2bb5b0, SKY = 0x6cc4ff, BLUE = 0x3a7bd5, VIOLET = 0x9b6ad8,
  LILAC = 0xc9a7f0, WHITE = 0xf7f4ee, CREAM = 0xf3e6c8, WOOD = 0xc98b52, DARKWOOD = 0x8a5a33, GREY = 0x9aa3ad,
  DARK = 0x3b3f4a, BLACK = 0x26292f, SILVER = 0xd5dbe1, SKIN = 0xffd9b0;

const SOFT = [PINK, SKY, MINT, YELLOW, VIOLET, ORANGE, GREY, RED];
const WOODS = [WOOD, WHITE, DARKWOOD, PINK, SKY, MINT];
const APPL = [WHITE, SILVER, RED, SKY, PINK, BLACK];

// ---------- Bau-Helfer ----------
type MatOpts = Partial<THREE.MeshStandardMaterialParameters>;
const mat = (c: number, o: MatOpts = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0, ...o });

class B {
  g = new THREE.Group();
  private add(geo: THREE.BufferGeometry, c: number, x: number, y: number, z: number, o?: MatOpts) {
    const m = new THREE.Mesh(geo, mat(c, o));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.g.add(m);
    return m;
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, c: number, r = 0.025, o?: MatOpts) {
    const rr = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
    const geo = rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
    return this.add(geo, c, x, y, z, o);
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, c: number, seg = 24, o?: MatOpts) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, o);
  }
  sph(r: number, x: number, y: number, z: number, c: number, sx = 1, sy = 1, sz = 1, o?: MatOpts) {
    const m = this.add(new THREE.SphereGeometry(r, 20, 14), c, x, y, z, o);
    m.scale.set(sx, sy, sz);
    return m;
  }
  torus(r: number, t: number, x: number, y: number, z: number, c: number, arc = Math.PI * 2, o?: MatOpts) {
    return this.add(new THREE.TorusGeometry(r, t, 10, 28, arc), c, x, y, z, o);
  }
  tex(w: number, h: number, x: number, y: number, z: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, o?: MatOpts) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = Math.round((256 * h) / w);
    draw(cv.getContext('2d')!, cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, ...o }));
    m.position.set(x, y, z);
    this.g.add(m);
    return m;
  }
  legs(w: number, d: number, h: number, c: number, r = 0.025, inset = 0.05) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cyl(r, r * 0.8, h, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), c, 12);
  }
}

const L = (c: number, f = 0.35) => shade(c, f);
const D = (c: number, f = -0.25) => shade(c, f);

// ---------- Möbel ----------
function sofa(c: number, w = 2.0) {
  const b = new B();
  b.box(w, 0.32, 0.85, 0, 0.26, 0, c, 0.06);
  b.box(w, 0.55, 0.22, 0, 0.62, -0.32, c, 0.08);
  for (const s of [-1, 1]) b.box(0.2, 0.6, 0.85, s * (w / 2 - 0.1), 0.38, 0, D(c, -0.08), 0.08);
  const n = w > 1.2 ? 2 : 1, cw = (w - 0.44) / n;
  for (let i = 0; i < n; i++) b.box(cw - 0.03, 0.14, 0.62, -w / 2 + 0.22 + cw * (i + 0.5), 0.48, 0.07, L(c, 0.2), 0.06);
  for (let i = 0; i < n; i++) b.box(cw - 0.08, 0.36, 0.14, -w / 2 + 0.22 + cw * (i + 0.5), 0.72, -0.17, L(c, 0.28), 0.06).rotation.x = -0.18;
  b.legs(w - 0.1, 0.75, 0.1, DARKWOOD, 0.03, 0.04);
  return b.g;
}

function coffeeTable(c: number) {
  const b = new B();
  b.box(1.1, 0.06, 0.6, 0, 0.42, 0, c, 0.03);
  b.box(1.0, 0.03, 0.5, 0, 0.14, 0, D(c, -0.1), 0.01);
  b.legs(1.1, 0.6, 0.4, D(c), 0.03, 0.06);
  return b.g;
}

function bookshelf(c: number) {
  const b = new B();
  const w = 1.0, h = 1.9, d = 0.35;
  b.box(w, h, 0.03, 0, h / 2, -d / 2 + 0.015, D(c, -0.1), 0.01);
  for (const s of [-1, 1]) b.box(0.04, h, d, s * (w / 2 - 0.02), h / 2, 0, c, 0.015);
  const books = [RED, BLUE, YELLOW, GREEN, PINK, VIOLET, ORANGE, TEAL, SKY, ROSE];
  for (let i = 0; i < 5; i++) {
    const y = 0.04 + i * 0.45;
    b.box(w - 0.06, 0.03, d - 0.02, 0, y, 0, c, 0.01);
    if (i < 4) {
      let x = -w / 2 + 0.07;
      let k = i * 3;
      while (x < w / 2 - 0.15 - (i === 1 ? 0.3 : 0)) {
        const bw = 0.05 + ((k * 37) % 4) * 0.012, bh = 0.26 + ((k * 13) % 5) * 0.025;
        b.box(bw, bh, 0.22, x + bw / 2, y + 0.015 + bh / 2, 0.02, books[k % books.length], 0.008);
        x += bw + 0.008;
        k++;
      }
    }
  }
  return b.g;
}

function sideboard(c: number) {
  const b = new B();
  b.box(1.6, 0.6, 0.45, 0, 0.4, 0, c, 0.03);
  for (let i = 0; i < 3; i++) {
    b.box(0.5, 0.52, 0.02, -0.53 + i * 0.53, 0.4, 0.225, L(c, 0.12), 0.01);
    b.sph(0.02, -0.53 + i * 0.53 + 0.18, 0.5, 0.245, SILVER);
  }
  b.legs(1.5, 0.38, 0.1, DARKWOOD, 0.02);
  return b.g;
}

function rug(c: number, round = false) {
  const b = new B();
  if (round) {
    b.cyl(0.9, 0.9, 0.02, 0, 0.01, 0, c, 40);
    b.cyl(0.65, 0.65, 0.022, 0, 0.011, 0, L(c, 0.35), 40);
    b.cyl(0.35, 0.35, 0.024, 0, 0.012, 0, c, 40);
  } else {
    b.box(2.0, 0.02, 1.4, 0, 0.01, 0, c, 0.005);
    b.box(1.7, 0.022, 1.1, 0, 0.011, 0, L(c, 0.4), 0.004);
    b.box(1.2, 0.024, 0.6, 0, 0.012, 0, c, 0.004);
  }
  return b.g;
}

function bed(c: number, w: number) {
  const b = new B();
  const len = 2.05;
  b.box(w + 0.08, 0.3, len, 0, 0.22, 0, WOOD, 0.03);
  b.box(w + 0.1, 0.9, 0.08, 0, 0.45, -len / 2, WOOD, 0.04);
  b.box(w + 0.1, 0.5, 0.08, 0, 0.25, len / 2, WOOD, 0.04);
  b.box(w, 0.18, len - 0.1, 0, 0.45, 0, WHITE, 0.06);
  b.box(w + 0.04, 0.12, len * 0.68, 0, 0.55, len * 0.14, c, 0.05);
  b.box(w + 0.02, 0.04, 0.15, 0, 0.6, -len * 0.18, L(c, 0.4), 0.02);
  const np = w > 1.2 ? 2 : 1;
  for (let i = 0; i < np; i++) b.box(w / np - 0.12, 0.13, 0.4, -w / 2 + (w / np) * (i + 0.5), 0.6, -len / 2 + 0.3, L(c, 0.55), 0.06);
  return b.g;
}

function wardrobe(c: number) {
  const b = new B();
  b.box(1.2, 2.0, 0.6, 0, 1.05, 0, c, 0.03);
  for (const s of [-1, 1]) {
    b.box(0.57, 1.9, 0.02, s * 0.295, 1.05, 0.3, L(c, 0.12), 0.01);
    b.cyl(0.015, 0.015, 0.3, s * 0.05, 1.1, 0.33, SILVER, 8);
  }
  b.legs(1.1, 0.5, 0.06, DARKWOOD, 0.02);
  return b.g;
}

function nightstand(c: number) {
  const b = new B();
  b.box(0.45, 0.45, 0.4, 0, 0.3, 0, c, 0.03);
  b.box(0.38, 0.16, 0.02, 0, 0.4, 0.2, L(c, 0.15), 0.01);
  b.sph(0.022, 0, 0.4, 0.22, SILVER);
  b.legs(0.4, 0.35, 0.08, DARKWOOD, 0.015);
  return b.g;
}

function dresser(c: number) {
  const b = new B();
  b.box(1.0, 0.8, 0.5, 0, 0.48, 0, c, 0.03);
  for (let i = 0; i < 3; i++) {
    b.box(0.92, 0.22, 0.02, 0, 0.24 + i * 0.25, 0.25, L(c, 0.12), 0.01);
    b.sph(0.025, 0, 0.24 + i * 0.25, 0.27, YELLOW);
  }
  b.legs(0.92, 0.42, 0.08, DARKWOOD, 0.02);
  return b.g;
}

function vanity(c: number) {
  const b = new B();
  b.box(1.0, 0.05, 0.45, 0, 0.75, 0, c, 0.02);
  b.box(0.35, 0.3, 0.42, 0.3, 0.58, 0, c, 0.02);
  b.sph(0.02, 0.3, 0.58, 0.22, YELLOW);
  b.legs(1.0, 0.45, 0.73, c, 0.025, 0.04);
  b.torus(0.3, 0.04, 0, 1.15, -0.18, c);
  b.cyl(0.28, 0.28, 0.01, 0, 1.15, -0.19, 0xdff4ff, 32, { metalness: 0.6, roughness: 0.05 }).rotation.x = Math.PI / 2;
  b.box(0.06, 0.15, 0.06, 0, 0.83, -0.18, c, 0.02);
  return b.g;
}

function kitchenCounter(c: number) {
  const b = new B();
  b.box(1.2, 0.82, 0.58, 0, 0.45, 0, c, 0.02);
  b.box(1.22, 0.05, 0.62, 0, 0.885, 0.01, CREAM, 0.01);
  for (const s of [-1, 1]) {
    b.box(0.57, 0.62, 0.02, s * 0.3, 0.4, 0.29, L(c, 0.15), 0.01);
    b.box(0.15, 0.02, 0.03, s * 0.3, 0.66, 0.31, SILVER, 0.008);
  }
  b.box(1.2, 0.06, 0.5, 0, 0.03, -0.03, DARK, 0.01);
  return b.g;
}

function sinkCounter(c: number) {
  const b = kitchenCounter(c);
  const x = new B();
  x.g = b;
  x.box(0.5, 0.02, 0.4, 0, 0.912, 0.02, SILVER, 0.01, { metalness: 0.6, roughness: 0.3 });
  x.box(0.44, 0.03, 0.34, 0, 0.9, 0.02, 0x8fa0ad, 0.01);
  x.cyl(0.02, 0.02, 0.25, 0, 1.03, -0.2, SILVER, 10, { metalness: 0.7, roughness: 0.2 });
  const sp = x.cyl(0.015, 0.015, 0.18, 0, 1.15, -0.13, SILVER, 10, { metalness: 0.7, roughness: 0.2 });
  sp.rotation.x = Math.PI / 2;
  return b;
}

function stove(c: number) {
  const b = new B();
  b.box(0.6, 0.86, 0.6, 0, 0.45, 0, c, 0.02);
  b.box(0.58, 0.02, 0.58, 0, 0.885, 0, BLACK, 0.005);
  for (const [x, z, r] of [[-0.14, -0.13, 0.09], [0.14, -0.13, 0.07], [-0.14, 0.13, 0.07], [0.14, 0.13, 0.09]]) b.cyl(r, r, 0.01, x, 0.9, z, DARK, 24);
  b.box(0.48, 0.42, 0.02, 0, 0.38, 0.3, BLACK, 0.01, { roughness: 0.15 });
  b.box(0.4, 0.03, 0.04, 0, 0.66, 0.32, SILVER, 0.01);
  for (let i = 0; i < 4; i++) b.cyl(0.025, 0.025, 0.03, -0.18 + i * 0.12, 0.78, 0.31, DARK, 12).rotation.x = Math.PI / 2;
  return b.g;
}

function fridge(c: number) {
  const b = new B();
  b.box(0.62, 1.8, 0.64, 0, 0.9, 0, c, 0.05);
  b.box(0.6, 0.01, 0.01, 0, 1.2, 0.325, D(c, -0.2), 0.002);
  b.box(0.03, 0.4, 0.04, 0.24, 1.45, 0.34, SILVER, 0.012);
  b.box(0.03, 0.4, 0.04, 0.24, 0.85, 0.34, SILVER, 0.012);
  b.sph(0.03, -0.12, 1.55, 0.33, RED, 1, 1, 0.4);
  b.sph(0.03, 0.0, 1.35, 0.33, YELLOW, 1, 1, 0.4);
  return b.g;
}

function wallCabinet(c: number) {
  const b = new B();
  // Ursprung: Rückseite, vertikale Mitte
  b.box(0.8, 0.6, 0.34, 0, 0, 0.17, c, 0.02);
  for (const s of [-1, 1]) {
    b.box(0.38, 0.56, 0.02, s * 0.2, 0, 0.345, L(c, 0.15), 0.01);
    b.box(0.02, 0.12, 0.02, s * 0.04, -0.15, 0.36, SILVER, 0.006);
  }
  return b.g;
}

function diningTable(c: number) {
  const b = new B();
  b.box(1.6, 0.06, 0.9, 0, 0.74, 0, c, 0.03);
  b.legs(1.6, 0.9, 0.72, D(c, -0.1), 0.035, 0.1);
  return b.g;
}

function roundTable(c: number) {
  const b = new B();
  b.cyl(0.55, 0.55, 0.05, 0, 0.74, 0, c, 40);
  b.cyl(0.05, 0.07, 0.7, 0, 0.36, 0, D(c, -0.1), 16);
  b.cyl(0.3, 0.3, 0.04, 0, 0.02, 0, D(c, -0.1), 32);
  return b.g;
}

function chair(c: number) {
  const b = new B();
  b.box(0.44, 0.05, 0.44, 0, 0.46, 0, c, 0.02);
  b.box(0.44, 0.45, 0.05, 0, 0.72, -0.2, c, 0.03);
  b.legs(0.44, 0.44, 0.45, D(c, -0.1), 0.022, 0.04);
  b.box(0.36, 0.04, 0.36, 0, 0.5, 0.02, L(c, 0.4), 0.02);
  return b.g;
}

function bathtub(c: number) {
  const b = new B();
  b.box(1.7, 0.52, 0.78, 0, 0.28, 0, c, 0.12);
  b.box(1.5, 0.03, 0.58, 0, 0.47, 0, 0x7ac8f0, 0.02, { roughness: 0.1, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 6; i++) b.sph(0.07, -0.5 + (i % 3) * 0.12, 0.5, -0.12 + Math.floor(i / 3) * 0.14, WHITE);
  b.cyl(0.02, 0.02, 0.2, 0.75, 0.6, 0, SILVER, 10, { metalness: 0.7, roughness: 0.2 });
  b.sph(0.06, 0.4, 0.52, 0.1, YELLOW, 1.2, 0.9, 1);
  b.sph(0.035, 0.4, 0.6, 0.15, YELLOW);
  b.sph(0.015, 0.4, 0.6, 0.19, ORANGE);
  return b.g;
}

function shower(c: number) {
  const b = new B();
  b.box(0.9, 0.08, 0.9, 0, 0.04, 0, WHITE, 0.02);
  const glass = { transparent: true, opacity: 0.3, roughness: 0.05 };
  b.box(0.9, 1.9, 0.02, 0, 1.03, 0.44, 0xcdefff, 0.005, glass);
  b.box(0.02, 1.9, 0.9, 0.44, 1.03, 0, 0xcdefff, 0.005, glass);
  b.box(0.9, 1.9, 0.04, 0, 1.03, -0.43, c, 0.01);
  b.box(0.04, 1.9, 0.9, -0.43, 1.03, 0, c, 0.01);
  b.cyl(0.015, 0.015, 1.5, -0.38, 1.2, -0.38, SILVER, 8, { metalness: 0.7, roughness: 0.2 });
  b.cyl(0.1, 0.06, 0.04, -0.3, 1.95, -0.3, SILVER, 20, { metalness: 0.7, roughness: 0.2 });
  b.box(0.92, 0.04, 0.04, 0, 1.99, 0.44, SILVER, 0.01);
  return b.g;
}

function toilet(c: number) {
  const b = new B();
  b.cyl(0.16, 0.13, 0.38, 0, 0.19, 0.05, WHITE, 24);
  b.cyl(0.2, 0.19, 0.06, 0, 0.41, 0.07, WHITE, 28).scale.set(0.95, 1, 1.15);
  b.cyl(0.2, 0.2, 0.03, 0, 0.455, 0.07, c, 28).scale.set(0.95, 1, 1.15);
  b.box(0.42, 0.38, 0.18, 0, 0.62, -0.22, WHITE, 0.04);
  b.box(0.08, 0.03, 0.05, 0, 0.82, -0.22, SILVER, 0.01);
  return b.g;
}

function washbasin(c: number) {
  const b = new B();
  b.box(0.7, 0.55, 0.45, 0, 0.5, 0, c, 0.03);
  b.box(0.64, 0.45, 0.02, 0, 0.5, 0.225, L(c, 0.15), 0.01);
  b.box(0.72, 0.1, 0.48, 0, 0.82, 0.01, WHITE, 0.04);
  b.box(0.46, 0.04, 0.3, 0, 0.865, 0.04, 0xb9dff5, 0.02);
  b.cyl(0.018, 0.018, 0.16, 0, 0.94, -0.16, SILVER, 10, { metalness: 0.7, roughness: 0.2 });
  b.cyl(0.012, 0.012, 0.1, 0, 1.0, -0.12, SILVER, 10, { metalness: 0.7, roughness: 0.2 }).rotation.x = Math.PI / 2;
  b.box(0.7, 0.2, 0.4, 0, 0.12, 0, D(c, -0.1), 0.03);
  return b.g;
}

function mirror(c: number) {
  const b = new B();
  b.box(0.65, 0.85, 0.04, 0, 0, 0.02, c, 0.03);
  b.box(0.55, 0.75, 0.01, 0, 0, 0.045, 0xe5f6ff, 0.005, { metalness: 0.8, roughness: 0.03 });
  return b.g;
}

function laundryBasket(c: number) {
  const b = new B();
  b.cyl(0.22, 0.18, 0.5, 0, 0.25, 0, c, 20);
  b.torus(0.22, 0.02, 0, 0.5, 0, D(c, -0.15)).rotation.x = Math.PI / 2;
  b.sph(0.12, 0.04, 0.5, 0.02, PINK, 1.3, 0.6, 1);
  b.sph(0.1, -0.06, 0.52, -0.05, SKY, 1.2, 0.6, 1);
  return b.g;
}

function towelRack(c: number) {
  const b = new B();
  b.box(0.6, 0.04, 0.04, 0, 0.25, 0.08, SILVER, 0.015, { metalness: 0.6, roughness: 0.25 });
  b.box(0.04, 0.04, 0.1, -0.28, 0.25, 0.04, SILVER, 0.015);
  b.box(0.04, 0.04, 0.1, 0.28, 0.25, 0.04, SILVER, 0.015);
  b.box(0.45, 0.6, 0.05, 0, 0.0, 0.08, c, 0.02);
  b.box(0.45, 0.05, 0.051, 0, -0.18, 0.08, WHITE, 0.01);
  return b.g;
}

// ---------- Kinderzimmer ----------
function loftBed(c: number) {
  const b = new B();
  const w = 1.0, len = 2.05, h = 1.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, h + 0.4, 0.08, sx * (w / 2 + 0.04), (h + 0.4) / 2, sz * (len / 2), WOOD, 0.02);
  b.box(w + 0.1, 0.12, len, 0, h, 0, WOOD, 0.02);
  b.box(w, 0.16, len - 0.1, 0, h + 0.14, 0, WHITE, 0.05);
  b.box(w + 0.02, 0.1, len * 0.65, 0, h + 0.25, len * 0.15, c, 0.04);
  b.box(w - 0.15, 0.12, 0.4, 0, h + 0.27, -len / 2 + 0.3, L(c, 0.5), 0.05);
  for (const s of [-1, 1]) b.box(0.04, 0.25, len, s * (w / 2 + 0.04), h + 0.35, 0, WOOD, 0.015);
  b.box(w + 0.1, 0.25, 0.04, 0, h + 0.35, -len / 2, WOOD, 0.015);
  // Leiter
  for (const s of [-1, 1]) b.box(0.05, h + 0.1, 0.05, w / 2 + 0.12, (h + 0.1) / 2, len / 2 - 0.25 + s * 0.2, c, 0.015);
  for (let i = 1; i < 5; i++) b.cyl(0.02, 0.02, 0.4, w / 2 + 0.12, i * 0.27, len / 2 - 0.25, c, 8).rotation.x = Math.PI / 2;
  // Kuschelecke unten
  b.box(w - 0.1, 0.2, 1.0, 0, 0.1, -0.4, L(c, 0.3), 0.08);
  b.box(w - 0.1, 0.4, 0.15, 0, 0.3, -0.95, L(c, 0.4), 0.06);
  return b.g;
}

function desk(c: number) {
  const b = new B();
  b.box(1.2, 0.05, 0.6, 0, 0.74, 0, c, 0.02);
  b.box(0.4, 0.68, 0.56, 0.38, 0.36, 0, c, 0.02);
  for (let i = 0; i < 3; i++) {
    b.box(0.36, 0.18, 0.02, 0.38, 0.14 + i * 0.21, 0.29, L(c, 0.2), 0.008);
    b.sph(0.018, 0.38, 0.14 + i * 0.21, 0.31, YELLOW);
  }
  b.box(0.04, 0.7, 0.56, -0.56, 0.36, 0, c, 0.02);
  return b.g;
}

function deskChair(c: number) {
  const b = new B();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = b.box(0.28, 0.03, 0.04, Math.cos(a) * 0.14, 0.07, Math.sin(a) * 0.14, DARK, 0.01);
    leg.rotation.y = -a;
    b.sph(0.03, Math.cos(a) * 0.28, 0.03, Math.sin(a) * 0.28, DARK);
  }
  b.cyl(0.03, 0.03, 0.36, 0, 0.27, 0, SILVER, 10);
  b.box(0.46, 0.08, 0.44, 0, 0.48, 0, c, 0.04);
  b.box(0.44, 0.48, 0.07, 0, 0.8, -0.2, c, 0.05);
  return b.g;
}

function toyChest(c: number) {
  const b = new B();
  b.box(0.8, 0.45, 0.45, 0, 0.23, 0, c, 0.04);
  b.box(0.82, 0.04, 0.47, 0, 0.46, -0.2, L(c, 0.2), 0.02).rotation.x = -1.2;
  b.sph(0.09, -0.2, 0.47, 0.05, RED);
  b.box(0.14, 0.14, 0.14, 0.05, 0.47, 0.0, YELLOW, 0.02);
  b.cyl(0.05, 0.05, 0.25, 0.25, 0.5, 0.02, BLUE, 12).rotation.z = 0.5;
  b.sph(0.03, 0.05, 0.36, 0.23, WHITE);
  return b.g;
}

function rockingHorse(c: number) {
  const b = new B();
  for (const s of [-1, 1]) {
    const r = b.torus(0.6, 0.025, 0, 0.62, s * 0.16, D(c, -0.2), Math.PI * 0.45);
    r.rotation.z = Math.PI * 1.275;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.025, 0.025, 0.28, sx * 0.25, 0.2, sz * 0.12, D(c, -0.2), 8);
  b.sph(0.22, 0, 0.42, 0, c, 1.6, 0.8, 0.8);
  b.box(0.12, 0.3, 0.12, 0.3, 0.6, 0, c, 0.05).rotation.z = -0.4;
  b.box(0.26, 0.13, 0.13, 0.42, 0.75, 0, c, 0.05);
  b.sph(0.02, 0.48, 0.79, 0.06, BLACK);
  b.sph(0.02, 0.48, 0.79, -0.06, BLACK);
  b.box(0.06, 0.25, 0.06, 0.25, 0.75, 0, YELLOW, 0.02).rotation.z = 0.5;
  b.box(0.06, 0.18, 0.04, -0.34, 0.45, 0, YELLOW, 0.02).rotation.z = -0.8;
  b.box(0.2, 0.04, 0.3, 0, 0.6, 0, RED, 0.015);
  return b.g;
}

function teddy(c: number) {
  const b = new B();
  b.sph(0.12, 0, 0.13, 0, c, 1, 1.1, 0.9);
  b.sph(0.09, 0, 0.32, 0, c);
  for (const s of [-1, 1]) {
    b.sph(0.035, s * 0.065, 0.4, 0, c);
    b.sph(0.05, s * 0.1, 0.05, 0.08, c, 1, 0.7, 1.2);
    b.sph(0.045, s * 0.13, 0.17, 0.03, c, 0.8, 1.3, 0.8);
    b.sph(0.012, s * 0.03, 0.34, 0.083, BLACK);
  }
  b.sph(0.035, 0, 0.3, 0.075, L(c, 0.4), 1, 0.8, 0.8);
  b.sph(0.012, 0, 0.31, 0.105, BLACK);
  b.torus(0.04, 0.012, 0, 0.24, 0.0, RED).rotation.x = Math.PI / 2;
  return b.g;
}

function beanBag(c: number) {
  const b = new B();
  b.sph(0.42, 0, 0.27, 0, c, 1, 0.62, 1);
  b.sph(0.3, 0, 0.45, -0.18, c, 1.1, 0.7, 0.6);
  return b.g;
}

function dollhouse(c: number) {
  const b = new B();
  b.box(0.6, 0.5, 0.3, 0, 0.25, 0, WHITE, 0.02);
  const r = b.box(0.46, 0.04, 0.34, -0.15, 0.6, 0, c, 0.01);
  r.rotation.z = 0.6;
  const r2 = b.box(0.46, 0.04, 0.34, 0.15, 0.6, 0, c, 0.01);
  r2.rotation.z = -0.6;
  b.box(0.12, 0.2, 0.02, 0, 0.1, 0.15, D(c), 0.01);
  b.box(0.12, 0.1, 0.02, -0.18, 0.32, 0.15, SKY, 0.01);
  b.box(0.12, 0.1, 0.02, 0.18, 0.32, 0.15, SKY, 0.01);
  return b.g;
}

// ---------- Elektro ----------
function tv(c: number) {
  const b = new B();
  b.box(0.35, 0.03, 0.2, 0, 0.015, 0, c, 0.01);
  b.box(0.05, 0.12, 0.05, 0, 0.08, -0.02, c, 0.01);
  b.box(1.1, 0.65, 0.06, 0, 0.47, 0, c, 0.02);
  b.tex(1.02, 0.57, 0, 0.47, 0.031, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#78d0ff');
    gr.addColorStop(1, '#bff0a0');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(W * 0.78, H * 0.28, H * 0.14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6cc04a';
    g.beginPath();
    g.ellipse(W * 0.3, H, W * 0.45, H * 0.35, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ff8fb8';
    g.beginPath();
    g.arc(W * 0.42, H * 0.55, H * 0.1, 0, Math.PI * 2);
    g.fill();
  }, { emissive: 0xffffff, emissiveIntensity: 0.35 });
  return b.g;
}

function computer(c: number) {
  const b = new B();
  b.box(0.12, 0.02, 0.12, 0, 0.01, -0.05, c, 0.008);
  b.box(0.04, 0.22, 0.03, 0, 0.12, -0.06, c, 0.01);
  b.box(0.55, 0.34, 0.04, 0, 0.36, -0.04, c, 0.015);
  b.tex(0.5, 0.29, 0, 0.36, -0.019, (g, W, H) => {
    g.fillStyle = '#3a7bd5';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ['#ffd23f', '#ff8fb8', '#7fe0c8', '#ffffff'][i];
      g.fillRect(W * 0.08 + i * W * 0.22, H * 0.15, W * 0.16, W * 0.16);
    }
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(0, H * 0.86, W, H * 0.14);
  }, { emissive: 0xffffff, emissiveIntensity: 0.35 });
  b.box(0.42, 0.02, 0.14, 0, 0.01, 0.14, c, 0.006);
  b.box(0.06, 0.02, 0.1, 0.3, 0.01, 0.14, c, 0.01);
  return b.g;
}

function washingMachine(c: number) {
  const b = new B();
  b.box(0.6, 0.85, 0.6, 0, 0.425, 0, c, 0.04);
  b.torus(0.18, 0.03, 0, 0.4, 0.3, SILVER);
  b.cyl(0.17, 0.17, 0.01, 0, 0.4, 0.3, 0x5fa8d3, 32, { transparent: true, opacity: 0.7, roughness: 0.1 }).rotation.x = Math.PI / 2;
  b.box(0.56, 0.12, 0.02, 0, 0.76, 0.3, L(c, 0.2), 0.01);
  b.cyl(0.035, 0.035, 0.03, 0.18, 0.76, 0.31, DARK, 16).rotation.x = Math.PI / 2;
  b.box(0.12, 0.04, 0.02, -0.15, 0.76, 0.315, SKY, 0.008);
  return b.g;
}

function microwave(c: number) {
  const b = new B();
  b.box(0.5, 0.3, 0.38, 0, 0.15, 0, c, 0.03);
  b.box(0.32, 0.22, 0.02, -0.06, 0.15, 0.19, BLACK, 0.01, { roughness: 0.1 });
  b.box(0.08, 0.22, 0.02, 0.18, 0.15, 0.19, DARK, 0.01);
  b.cyl(0.02, 0.02, 0.02, 0.18, 0.2, 0.2, SILVER, 12).rotation.x = Math.PI / 2;
  return b.g;
}

function floorLamp(c: number) {
  const b = new B();
  b.cyl(0.18, 0.2, 0.04, 0, 0.02, 0, DARK, 24);
  b.cyl(0.015, 0.015, 1.4, 0, 0.72, 0, SILVER, 8);
  b.cyl(0.14, 0.24, 0.3, 0, 1.5, 0, c, 24, { emissive: c, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  b.sph(0.06, 0, 1.42, 0, 0xfff6c0, 1, 1, 1, { emissive: 0xfff2a0, emissiveIntensity: 1 });
  return b.g;
}

function ceilingLamp(c: number) {
  const b = new B();
  // Ursprung: Decke, hängt nach unten
  b.cyl(0.07, 0.07, 0.03, 0, -0.015, 0, WHITE, 16);
  b.cyl(0.006, 0.006, 0.5, 0, -0.27, 0, DARK, 6);
  b.sph(0.22, 0, -0.6, 0, c, 1, 0.75, 1, { side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.25 });
  b.sph(0.08, 0, -0.68, 0, 0xfff6c0, 1, 1, 1, { emissive: 0xfff2a0, emissiveIntensity: 1 });
  return b.g;
}

function radio(c: number) {
  const b = new B();
  b.box(0.36, 0.2, 0.14, 0, 0.1, 0, c, 0.04);
  b.cyl(0.06, 0.06, 0.02, -0.09, 0.1, 0.07, DARK, 20).rotation.x = Math.PI / 2;
  b.cyl(0.06, 0.06, 0.02, 0.09, 0.1, 0.07, DARK, 20).rotation.x = Math.PI / 2;
  b.cyl(0.006, 0.006, 0.3, 0.12, 0.33, -0.03, SILVER, 6).rotation.z = -0.4;
  b.box(0.3, 0.025, 0.04, 0, 0.215, 0, D(c), 0.01);
  return b.g;
}

function coffeeMachine(c: number) {
  const b = new B();
  b.box(0.24, 0.05, 0.3, 0, 0.025, 0, DARK, 0.015);
  b.box(0.24, 0.36, 0.1, 0, 0.18, -0.1, c, 0.03);
  b.box(0.24, 0.08, 0.3, 0, 0.36, 0, c, 0.03);
  b.cyl(0.05, 0.04, 0.08, 0, 0.09, 0.05, WHITE, 16);
  b.cyl(0.04, 0.04, 0.005, 0, 0.13, 0.05, 0x6b3b1e, 16);
  return b.g;
}

function fan(c: number) {
  const b = new B();
  b.cyl(0.16, 0.18, 0.04, 0, 0.02, 0, c, 20);
  b.cyl(0.02, 0.02, 0.9, 0, 0.47, 0, SILVER, 8);
  const head = b.torus(0.22, 0.012, 0, 1.0, 0.05, c);
  void head;
  b.sph(0.05, 0, 1.0, 0.04, c);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const bl = b.box(0.2, 0.08, 0.01, Math.cos(a) * 0.11, 1.0 + Math.sin(a) * 0.11, 0.06, WHITE, 0.004);
    bl.rotation.z = a;
  }
  return b.g;
}

function gameConsole(c: number) {
  const b = new B();
  b.box(0.3, 0.06, 0.22, 0, 0.03, 0, c, 0.02);
  b.box(0.16, 0.035, 0.08, -0.1, 0.02, 0.2, DARK, 0.015);
  b.sph(0.015, -0.13, 0.04, 0.2, RED);
  b.sph(0.015, -0.07, 0.04, 0.2, SKY);
  return b.g;
}

// ---------- Deko ----------
function plant(c: number) {
  const b = new B();
  b.cyl(0.17, 0.13, 0.3, 0, 0.15, 0, c, 20);
  b.cyl(0.16, 0.16, 0.02, 0, 0.3, 0, 0x6b4a2e, 20);
  const leaf = [GREEN, LIME, 0x3d9a58];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.07 + (i % 3) * 0.05;
    b.sph(0.12, Math.cos(a) * r, 0.5 + (i % 4) * 0.12, Math.sin(a) * r, leaf[i % 3], 1, 1.3, 1);
  }
  return b.g;
}

function vase(c: number) {
  const b = new B();
  b.cyl(0.06, 0.08, 0.25, 0, 0.125, 0, c, 20, { roughness: 0.2 });
  const fl = [PINK, YELLOW, RED, VIOLET, WHITE];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * 0.06, z = Math.sin(a) * 0.06;
    const st = b.cyl(0.006, 0.006, 0.2, x * 0.5, 0.33, z * 0.5, GREEN, 6);
    st.rotation.set(z * 3, 0, -x * 3);
    b.sph(0.045, x, 0.44 + (i % 2) * 0.04, z, fl[i]);
    b.sph(0.02, x, 0.46 + (i % 2) * 0.04, z, YELLOW);
  }
  return b.g;
}

function picture(c: number) {
  const b = new B();
  b.box(0.8, 0.6, 0.04, 0, 0, 0.02, c, 0.015);
  b.tex(0.68, 0.48, 0, 0, 0.041, (g, W, H) => {
    g.fillStyle = '#bfe8ff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(W * 0.8, H * 0.25, H * 0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9b6ad8';
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(W * 0.3, H * 0.35);
    g.lineTo(W * 0.6, H);
    g.fill();
    g.fillStyle = '#7fbf5a';
    g.beginPath();
    g.moveTo(W * 0.35, H);
    g.lineTo(W * 0.65, H * 0.5);
    g.lineTo(W, H);
    g.fill();
    g.fillStyle = '#ff5d8f';
    for (const x of [0.15, 0.45, 0.85]) {
      g.beginPath();
      g.arc(W * x, H * 0.92, 6, 0, Math.PI * 2);
      g.fill();
    }
  });
  return b.g;
}

function wallClock(c: number) {
  const b = new B();
  const r = b.cyl(0.2, 0.2, 0.05, 0, 0, 0.025, c, 32);
  r.rotation.x = Math.PI / 2;
  const f = b.cyl(0.17, 0.17, 0.01, 0, 0, 0.05, WHITE, 32);
  f.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.015, 0.03, 0.005, Math.sin(a) * 0.14, Math.cos(a) * 0.14, 0.057, DARK, 0.002).rotation.z = -a;
  }
  const h1 = b.box(0.015, 0.09, 0.005, 0.0, 0.04, 0.06, DARK, 0.002);
  void h1;
  b.box(0.012, 0.12, 0.005, 0.05, 0.02, 0.062, DARK, 0.002).rotation.z = -1.2;
  return b.g;
}

function wallShelf(c: number) {
  const b = new B();
  b.box(0.9, 0.04, 0.22, 0, 0, 0.11, c, 0.015);
  b.cyl(0.04, 0.05, 0.12, -0.3, 0.08, 0.1, PINK, 16);
  b.sph(0.06, -0.3, 0.18, 0.1, GREEN);
  for (let i = 0; i < 4; i++) b.box(0.04, 0.2, 0.15, 0.05 + i * 0.05, 0.12, 0.1, [RED, BLUE, YELLOW, VIOLET][i], 0.008);
  b.sph(0.05, 0.33, 0.07, 0.1, YELLOW);
  return b.g;
}

function curtain(c: number) {
  const b = new B();
  b.cyl(0.015, 0.015, 1.7, 0, 0.95, 0.08, SILVER, 8).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) b.cyl(0.05, 0.06, 1.8, s * (0.62 + i * 0.06), 0.03, 0.08, i % 2 ? c : L(c, 0.15), 10);
  }
  return b.g;
}

function fruitBowl(c: number) {
  const b = new B();
  b.sph(0.16, 0, 0.1, 0, c, 1, 0.5, 1, { side: THREE.DoubleSide });
  b.sph(0.055, -0.05, 0.11, 0, RED);
  b.sph(0.05, 0.06, 0.11, 0.03, ORANGE);
  b.sph(0.05, 0.0, 0.12, -0.06, LIME);
  b.sph(0.03, 0.02, 0.16, 0.06, VIOLET);
  return b.g;
}

function aquarium(c: number) {
  const b = new B();
  b.box(0.6, 0.04, 0.3, 0, 0.02, 0, c, 0.01);
  b.box(0.58, 0.36, 0.28, 0, 0.22, 0, 0x7fd0f0, 0.01, { transparent: true, opacity: 0.45, roughness: 0.05 });
  b.box(0.56, 0.05, 0.26, 0, 0.065, 0, 0xf0d9a0, 0.01);
  b.sph(0.03, -0.1, 0.25, 0.02, ORANGE, 1.6, 1, 0.5);
  b.sph(0.025, 0.12, 0.18, -0.03, YELLOW, 1.6, 1, 0.5);
  for (let i = 0; i < 3; i++) b.cyl(0.01, 0.015, 0.2, -0.2 + i * 0.03, 0.18, -0.06, GREEN, 6);
  b.box(0.6, 0.03, 0.3, 0, 0.415, 0, c, 0.01);
  return b.g;
}

function books(c: number) {
  const b = new B();
  const cols = [c, BLUE, YELLOW, GREEN];
  for (let i = 0; i < 4; i++) b.box(0.24 - i * 0.02, 0.04, 0.17 - i * 0.01, (i % 2) * 0.01, 0.02 + i * 0.04, 0, cols[i], 0.01).rotation.y = i * 0.15;
  return b.g;
}

function candle(c: number) {
  const b = new B();
  b.cyl(0.07, 0.08, 0.02, 0, 0.01, 0, YELLOW, 16);
  b.cyl(0.035, 0.035, 0.16, 0, 0.1, 0, c, 16);
  b.sph(0.018, 0, 0.2, 0, 0xffc040, 1, 1.6, 1, { emissive: 0xff9020, emissiveIntensity: 1.2 });
  return b.g;
}

function cushion(c: number) {
  const b = new B();
  b.box(0.42, 0.14, 0.42, 0, 0.07, 0, c, 0.06);
  b.sph(0.02, 0, 0.14, 0, L(c, 0.4));
  return b.g;
}

// ---------- Garten ----------
function tree(c: number) {
  const b = new B();
  b.cyl(0.12, 0.16, 1.4, 0, 0.7, 0, DARKWOOD, 12);
  b.sph(0.7, 0, 1.9, 0, c, 1, 0.9, 1);
  b.sph(0.5, 0.4, 1.6, 0.2, shade(c, 0.1));
  b.sph(0.5, -0.35, 1.65, -0.2, shade(c, -0.1));
  b.sph(0.45, 0, 2.4, 0, shade(c, 0.15));
  for (let i = 0; i < 5; i++) b.sph(0.06, Math.cos(i * 1.3) * 0.6, 1.7 + (i % 3) * 0.25, Math.sin(i * 1.3) * 0.6, RED);
  return b.g;
}

function bush(c: number) {
  const b = new B();
  b.sph(0.4, 0, 0.32, 0, c, 1.2, 0.8, 1);
  b.sph(0.3, 0.3, 0.3, 0.1, shade(c, 0.1));
  b.sph(0.3, -0.3, 0.28, -0.1, shade(c, -0.1));
  for (let i = 0; i < 6; i++) b.sph(0.05, Math.cos(i) * 0.4, 0.45 + (i % 2) * 0.1, Math.sin(i) * 0.35, i % 2 ? PINK : WHITE);
  return b.g;
}

function bench(c: number) {
  const b = new B();
  for (let i = 0; i < 3; i++) b.box(1.4, 0.04, 0.12, 0, 0.45, -0.15 + i * 0.14, c, 0.015);
  for (let i = 0; i < 2; i++) b.box(1.4, 0.12, 0.04, 0, 0.62 + i * 0.16, -0.25, c, 0.015);
  for (const s of [-1, 1]) {
    b.box(0.06, 0.45, 0.06, s * 0.6, 0.22, 0.12, DARK, 0.015);
    b.box(0.06, 0.85, 0.06, s * 0.6, 0.42, -0.25, DARK, 0.015);
    b.box(0.06, 0.04, 0.45, s * 0.6, 0.6, -0.05, DARK, 0.015);
  }
  return b.g;
}

function flowerBed(c: number) {
  const b = new B();
  b.box(1.2, 0.2, 0.6, 0, 0.1, 0, DARKWOOD, 0.02);
  b.box(1.12, 0.05, 0.52, 0, 0.2, 0, 0x6b4a2e, 0.01);
  const fl = [c, YELLOW, WHITE, VIOLET];
  for (let i = 0; i < 12; i++) {
    const x = -0.45 + (i % 6) * 0.18, z = i < 6 ? -0.12 : 0.12;
    b.cyl(0.008, 0.008, 0.18, x, 0.3, z, GREEN, 6);
    b.sph(0.045, x, 0.4, z, fl[i % 4]);
  }
  return b.g;
}

function trampoline(c: number) {
  const b = new B();
  b.torus(1.1, 0.06, 0, 0.6, 0, c).rotation.x = Math.PI / 2;
  b.cyl(1.05, 1.05, 0.02, 0, 0.58, 0, DARK, 40);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.cyl(0.03, 0.03, 0.6, Math.cos(a) * 1.1, 0.3, Math.sin(a) * 1.1, SILVER, 8);
  }
  return b.g;
}

function umbrella(c: number) {
  const b = new B();
  b.cyl(0.25, 0.28, 0.08, 0, 0.04, 0, DARK, 20);
  b.cyl(0.025, 0.025, 2.2, 0, 1.1, 0, WHITE, 8);
  const top = b.cyl(0.05, 1.2, 0.35, 0, 2.15, 0, c, 8, { side: THREE.DoubleSide });
  void top;
  b.cyl(1.2, 1.2, 0.08, 0, 1.94, 0, L(c, 0.4), 8, { side: THREE.DoubleSide, transparent: false });
  return b.g;
}

function swing(c: number) {
  const b = new B();
  const wood = DARKWOOD, top = 2.05, spread = 0.65;
  // A-Gestelle links und rechts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const len = Math.hypot(top, spread);
      const leg = b.cyl(0.05, 0.055, len, sx * 0.95, top / 2, sz * spread / 2, wood, 10);
      leg.rotation.x = -sz * Math.atan2(spread, top);
    }
    b.box(0.08, 0.08, spread * 1.1, sx * 0.95, 0.7, 0, wood, 0.02); // Querstrebe
  }
  // Querbalken
  b.cyl(0.06, 0.06, 2.1, 0, top, 0, wood, 12).rotation.z = Math.PI / 2;
  // zwei Schaukeln
  for (const [x, col] of [[-0.45, c], [0.45, L(c, 0.35)]] as [number, number][]) {
    for (const dz of [-0.17, 0.17]) {
      b.cyl(0.008, 0.008, top - 0.5, x, (top + 0.5) / 2, dz, SILVER, 6, { metalness: 0.6, roughness: 0.3 });
      b.torus(0.03, 0.008, x, top - 0.04, dz, SILVER).rotation.y = Math.PI / 2;
    }
    b.box(0.22, 0.04, 0.46, x, 0.48, 0, col, 0.015);
  }
  return b.g;
}

function slide(c: number) {
  const b = new B();
  const h = 1.2, wood = WOOD;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.07, h + 0.7, 0.07, sx * 0.4, (h + 0.7) / 2, sz * 0.4 - 0.3, wood, 0.015);
  b.box(0.88, 0.06, 0.88, 0, h, -0.3, wood, 0.02);
  // Geländer oben
  for (const sx of [-1, 1]) b.box(0.04, 0.04, 0.8, sx * 0.4, h + 0.55, -0.3, wood, 0.01);
  b.box(0.8, 0.04, 0.04, 0, h + 0.55, -0.7, wood, 0.01);
  // Dach
  const roof = b.cyl(0.05, 0.75, 0.45, 0, h + 0.95, -0.3, c, 4);
  roof.rotation.y = Math.PI / 4;
  // Leiter hinten, oben am Podest angelehnt
  const lb = -1.35, lt = -0.72, ldy = h + 0.05, lang = Math.atan2(lt - lb, ldy), llen = Math.hypot(lt - lb, ldy);
  for (const sx of [-1, 1]) {
    const r = b.box(0.05, llen, 0.05, sx * 0.22, ldy / 2, (lb + lt) / 2, wood, 0.01);
    r.rotation.x = lang;
  }
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    b.cyl(0.022, 0.022, 0.44, 0, ldy * t, lb + (lt - lb) * t, wood, 8).rotation.z = Math.PI / 2;
  }
  // Rutsche nach vorn
  const run = 1.8, drop = h - 0.12, ang = Math.atan2(drop, run), len = Math.hypot(run, drop);
  const ramp = b.box(0.5, 0.04, len, 0, (h + 0.12) / 2, 0.14 + run / 2, c, 0.02);
  ramp.rotation.x = ang;
  for (const sx of [-1, 1]) {
    const rail = b.box(0.04, 0.14, len, sx * 0.27, (h + 0.12) / 2 + 0.07, 0.14 + run / 2, L(c, 0.2), 0.02);
    rail.rotation.x = ang;
  }
  b.box(0.5, 0.04, 0.3, 0, 0.12, 0.14 + run + 0.12, c, 0.02);
  return b.g;
}

function pool(c: number) {
  const b = new B();
  b.torus(0.85, 0.15, 0, 0.15, 0, c).rotation.x = Math.PI / 2;
  b.torus(0.85, 0.15, 0, 0.4, 0, L(c, 0.4)).rotation.x = Math.PI / 2;
  b.cyl(0.85, 0.85, 0.45, 0, 0.25, 0, 0x7fd8ff, 40, { transparent: true, opacity: 0.85, roughness: 0.1 });
  b.torus(0.15, 0.06, 0.3, 0.48, 0.2, YELLOW).rotation.x = Math.PI / 2;
  return b.g;
}

function gardenTable(c: number) {
  const b = new B();
  b.cyl(0.45, 0.45, 0.04, 0, 0.72, 0, c, 32);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = b.cyl(0.02, 0.02, 0.75, Math.cos(a) * 0.25, 0.36, Math.sin(a) * 0.25, WHITE, 8);
    leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
  }
  return b.g;
}

function bike(c: number) {
  const b = new B();
  const P = (x: number, y: number) => new THREE.Vector2(x, y);
  // Rohr zwischen zwei Punkten in der Seitenansicht (x/y), z = seitlicher Versatz
  const tube = (p: THREE.Vector2, q: THREE.Vector2, r: number, col: number, z = 0, o?: MatOpts) => {
    const d = q.clone().sub(p);
    const m = b.cyl(r, r, d.length(), (p.x + q.x) / 2, (p.y + q.y) / 2, z, col, 10, o);
    m.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2;
    return m;
  };
  const metal = { metalness: 0.6, roughness: 0.3 };
  const R = 0.32;
  const rear = P(-0.56, R), front = P(0.56, R), bb = P(-0.05, 0.3);
  const seat = P(-0.22, 0.8), headTop = P(0.38, 0.88), headBot = P(0.42, 0.74);
  // Räder: Reifen, Felge, Nabe, Speichen
  for (const w of [rear, front]) {
    b.torus(R, 0.035, w.x, w.y, 0, DARK);
    b.torus(R - 0.035, 0.012, w.x, w.y, 0, SILVER, Math.PI * 2, metal);
    b.cyl(0.03, 0.03, 0.1, w.x, w.y, 0, SILVER, 12, metal).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      const sp = b.cyl(0.004, 0.004, (R - 0.04) * 2, w.x, w.y, 0, SILVER, 4, metal);
      sp.rotation.z = a;
    }
  }
  // Rahmen (Damenrad mit tiefem Einstieg)
  tube(bb, seat, 0.022, c);
  tube(bb, headBot, 0.024, c);
  tube(P(-0.13, 0.52), P(0.4, 0.8), 0.02, c);
  tube(headBot, headTop, 0.028, c);
  for (const z of [-0.06, 0.06]) {
    tube(bb, rear, 0.014, c, z);
    tube(seat, rear, 0.013, c, z);
    tube(headBot, front, 0.016, c, z);
  }
  // Sattel
  tube(seat, P(-0.24, 0.9), 0.013, SILVER, 0, metal);
  b.box(0.24, 0.05, 0.13, -0.24, 0.93, 0, DARK, 0.025);
  b.sph(0.06, -0.32, 0.93, 0, DARK, 1, 0.45, 1.1);
  // Lenker
  tube(headTop, P(0.34, 0.99), 0.015, SILVER, 0, metal);
  b.cyl(0.014, 0.014, 0.5, 0.33, 0.99, 0, SILVER, 8, metal).rotation.x = Math.PI / 2;
  for (const z of [-0.24, 0.24]) {
    const g = b.cyl(0.022, 0.022, 0.1, 0.3, 0.99, z, L(c, 0.3), 10);
    g.rotation.x = Math.PI / 2;
  }
  b.sph(0.025, 0.36, 1.01, 0.18, SILVER, 1, 1, 1, metal); // Klingel
  // Körbchen vorne
  b.box(0.24, 0.17, 0.3, 0.6, 0.92, 0, L(c, 0.45), 0.03);
  b.box(0.2, 0.02, 0.26, 0.6, 1.01, 0, D(c, -0.1), 0.01);
  b.sph(0.05, 0.58, 1.03, 0.05, RED);
  b.sph(0.045, 0.64, 1.03, -0.06, YELLOW);
  tube(headTop, P(0.5, 0.86), 0.01, SILVER, 0, metal);
  // Kurbel und Pedale
  b.cyl(0.07, 0.07, 0.02, bb.x, bb.y, 0.06, SILVER, 20, metal).rotation.x = Math.PI / 2;
  for (const sgn of [-1, 1]) {
    const arm = b.box(0.03, 0.17, 0.02, bb.x + sgn * 0.035, bb.y - sgn * 0.06, sgn * 0.08, SILVER, 0.008, metal);
    arm.rotation.z = sgn * 0.6;
    b.box(0.1, 0.025, 0.07, bb.x + sgn * 0.08, bb.y - sgn * 0.12, sgn * 0.12, DARK, 0.01);
  }
  // Kettenschutz und Schutzbleche
  const guard = b.box(0.5, 0.06, 0.02, (bb.x + rear.x) / 2, (bb.y + rear.y) / 2 + 0.02, 0.07, c, 0.02);
  guard.rotation.z = Math.atan2(rear.y - bb.y, rear.x - bb.x) + Math.PI;
  for (const w of [rear, front]) {
    const mg = b.torus(R + 0.05, 0.03, w.x, w.y, 0, c, Math.PI * 0.55);
    mg.rotation.z = Math.PI * 0.22;
    mg.scale.z = 1.6;
  }
  // Ständer, damit es nicht umkippt
  const st = tube(P(-0.12, 0.29), P(-0.24, 0.0), 0.012, SILVER, -0.09, metal);
  st.rotation.x = -0.25;
  return b.g;
}

const I = (id: string, name: string, cat: string, placement: Placement, colors: number[], build: (c: number) => THREE.Group, flat = false): ItemDef =>
  ({ id, name, cat, placement, colors, build, flat });

export const ITEMS: ItemDef[] = [
  I('sofa', 'Sofa', 'wohnen', 'floor', SOFT, (c) => sofa(c, 2.0)),
  I('sessel', 'Sessel', 'wohnen', 'floor', SOFT, (c) => sofa(c, 0.95)),
  I('couchtisch', 'Couchtisch', 'wohnen', 'floor', WOODS, coffeeTable),
  I('regal', 'Bücherregal', 'wohnen', 'floor', WOODS, bookshelf),
  I('sideboard', 'Sideboard', 'wohnen', 'floor', WOODS, sideboard),
  I('teppich', 'Teppich', 'wohnen', 'floor', SOFT, (c) => rug(c), true),
  I('teppich-rund', 'Runder Teppich', 'wohnen', 'floor', SOFT, (c) => rug(c, true), true),
  I('sitzsack', 'Sitzsack', 'wohnen', 'floor', SOFT, beanBag),

  I('doppelbett', 'Doppelbett', 'schlafen', 'floor', SOFT, (c) => bed(c, 1.6)),
  I('bett', 'Einzelbett', 'schlafen', 'floor', SOFT, (c) => bed(c, 0.95)),
  I('schrank', 'Kleiderschrank', 'schlafen', 'floor', WOODS, wardrobe),
  I('nachttisch', 'Nachttisch', 'schlafen', 'floor', WOODS, nightstand),
  I('kommode', 'Kommode', 'schlafen', 'floor', WOODS, dresser),
  I('schminktisch', 'Schminktisch', 'schlafen', 'floor', [WHITE, PINK, LILAC, MINT, WOOD], vanity),

  I('kuechenschrank', 'Küchenschrank', 'kueche', 'floor', [WHITE, MINT, SKY, PINK, YELLOW, WOOD, RED], kitchenCounter),
  I('spuele', 'Spüle', 'kueche', 'floor', [WHITE, MINT, SKY, PINK, YELLOW, WOOD, RED], sinkCounter),
  I('herd', 'Herd', 'kueche', 'floor', APPL, stove),
  I('kuehlschrank', 'Kühlschrank', 'kueche', 'floor', APPL, fridge),
  I('haengeschrank', 'Hängeschrank', 'kueche', 'wall', [WHITE, MINT, SKY, PINK, YELLOW, WOOD, RED], wallCabinet),
  I('esstisch', 'Esstisch', 'kueche', 'floor', WOODS, diningTable),
  I('rundtisch', 'Runder Tisch', 'kueche', 'floor', WOODS, roundTable),
  I('stuhl', 'Stuhl', 'kueche', 'floor', [WOOD, WHITE, RED, YELLOW, SKY, PINK, MINT], chair),

  I('badewanne', 'Badewanne', 'bad', 'floor', [WHITE, PINK, SKY, MINT, YELLOW], bathtub),
  I('dusche', 'Dusche', 'bad', 'floor', [SKY, MINT, PINK, WHITE, YELLOW], shower),
  I('toilette', 'Toilette', 'bad', 'floor', [WHITE, PINK, SKY, MINT, YELLOW, BLACK], toilet),
  I('waschbecken', 'Waschbecken', 'bad', 'floor', WOODS, washbasin),
  I('spiegel', 'Spiegel', 'bad', 'wall', [WHITE, PINK, YELLOW, SKY, WOOD], mirror),
  I('handtuch', 'Handtuchhalter', 'bad', 'wall', [PINK, SKY, MINT, YELLOW, WHITE], towelRack),
  I('waeschekorb', 'Wäschekorb', 'bad', 'floor', [WHITE, LILAC, MINT, WOOD], laundryBasket),

  I('hochbett', 'Hochbett', 'kinder', 'floor', SOFT, loftBed),
  I('schreibtisch', 'Schreibtisch', 'kinder', 'floor', WOODS, desk),
  I('drehstuhl', 'Drehstuhl', 'kinder', 'floor', SOFT, deskChair),
  I('spielkiste', 'Spielzeugkiste', 'kinder', 'floor', [RED, BLUE, YELLOW, GREEN, PINK, VIOLET], toyChest),
  I('schaukelpferd', 'Schaukelpferd', 'kinder', 'floor', [WHITE, 0xb5651d, PINK, SKY, BLACK], rockingHorse),
  I('teddy', 'Teddybär', 'kinder', 'floor', [0xc9894f, PINK, WHITE, SKY, LILAC], teddy),
  I('puppenhaus', 'Puppenhaus', 'kinder', 'floor', [RED, PINK, SKY, VIOLET], dollhouse),

  I('fernseher', 'Fernseher', 'elektro', 'floor', [BLACK, WHITE, PINK, SKY], tv),
  I('computer', 'Computer', 'elektro', 'floor', [WHITE, BLACK, PINK, SKY], computer),
  I('waschmaschine', 'Waschmaschine', 'elektro', 'floor', APPL, washingMachine),
  I('mikrowelle', 'Mikrowelle', 'elektro', 'floor', APPL, microwave),
  I('kaffeemaschine', 'Kaffeemaschine', 'elektro', 'floor', [RED, BLACK, WHITE, MINT], coffeeMachine),
  I('radio', 'Radio', 'elektro', 'floor', [RED, SKY, YELLOW, MINT, PINK], radio),
  I('konsole', 'Spielkonsole', 'elektro', 'floor', [WHITE, BLACK, PINK, SKY], gameConsole),
  I('ventilator', 'Ventilator', 'elektro', 'floor', [WHITE, SKY, PINK, YELLOW], fan),
  I('stehlampe', 'Stehlampe', 'elektro', 'floor', [YELLOW, PINK, WHITE, SKY, MINT], floorLamp),
  I('deckenlampe', 'Deckenlampe', 'elektro', 'ceiling', [YELLOW, PINK, WHITE, SKY, MINT, LILAC], ceilingLamp),

  I('pflanze', 'Zimmerpflanze', 'deko', 'floor', [ORANGE, WHITE, PINK, SKY, 0xb5651d], plant),
  I('vase', 'Blumenvase', 'deko', 'floor', [SKY, PINK, WHITE, YELLOW, VIOLET], vase),
  I('bild', 'Bild', 'deko', 'wall', [WOOD, WHITE, YELLOW, PINK, BLACK], picture),
  I('uhr', 'Wanduhr', 'deko', 'wall', [RED, PINK, SKY, YELLOW, WHITE], wallClock),
  I('wandregal', 'Wandregal', 'deko', 'wall', WOODS, wallShelf),
  I('vorhang', 'Vorhang', 'deko', 'wall', SOFT, curtain),
  I('obstschale', 'Obstschale', 'deko', 'floor', [WHITE, SKY, PINK, YELLOW], fruitBowl),
  I('aquarium', 'Aquarium', 'deko', 'floor', [BLACK, WHITE, PINK, SKY], aquarium),
  I('buecher', 'Bücherstapel', 'deko', 'floor', [RED, PINK, VIOLET, SKY], books),
  I('kerze', 'Kerze', 'deko', 'floor', [WHITE, PINK, SKY, RED], candle),
  I('kissen', 'Kissen', 'deko', 'floor', SOFT, cushion),

  I('baum', 'Apfelbaum', 'garten', 'floor', [GREEN, LIME, 0x2f8a4a, PINK], tree),
  I('busch', 'Blumenbusch', 'garten', 'floor', [GREEN, LIME, 0x2f8a4a], bush),
  I('bank', 'Gartenbank', 'garten', 'floor', [WOOD, WHITE, GREEN, SKY, RED], bench),
  I('beet', 'Blumenbeet', 'garten', 'floor', [RED, PINK, ORANGE, SKY], flowerBed),
  I('trampolin', 'Trampolin', 'garten', 'floor', [BLUE, GREEN, PINK, RED], trampoline),
  I('schirm', 'Sonnenschirm', 'garten', 'floor', [RED, YELLOW, SKY, PINK, MINT], umbrella),
  I('schaukel', 'Schaukel', 'garten', 'floor', [RED, YELLOW, SKY, PINK], swing),
  I('rutsche', 'Rutsche', 'garten', 'floor', [YELLOW, RED, SKY, PINK, GREEN], slide),
  I('pool', 'Planschbecken', 'garten', 'floor', [SKY, PINK, YELLOW, MINT], pool),
  I('gartentisch', 'Gartentisch', 'garten', 'floor', [WHITE, MINT, YELLOW, WOOD], gardenTable),
  I('fahrrad', 'Fahrrad', 'garten', 'floor', [PINK, RED, SKY, MINT, VIOLET], bike),
];

void SKIN; void TEAL; void LILAC; void CREAM;

export function itemById(id: string) {
  return ITEMS.find((i) => i.id === id);
}

/** Lokale Bounding-Box (ohne Drehung) */
export interface LocalBox { cx: number; cz: number; hx: number; hz: number; y0: number; y1: number }

export function localBox(obj: THREE.Object3D): LocalBox {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj, true);
  const inv = obj.parent ? obj.position : new THREE.Vector3();
  return {
    cx: (b.min.x + b.max.x) / 2 - inv.x,
    cz: (b.min.z + b.max.z) / 2 - inv.z,
    hx: (b.max.x - b.min.x) / 2,
    hz: (b.max.z - b.min.z) / 2,
    y0: b.min.y - inv.y,
    y1: b.max.y - inv.y,
  };
}
