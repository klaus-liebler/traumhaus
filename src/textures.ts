import * as THREE from 'three';

export type SurfaceKind = 'floor' | 'wall' | 'ceil';

export interface Covering {
  id: string;
  name: string;
  surface: SurfaceKind;
  /** Meter pro Texturkachel */
  scale: number;
  draw: (g: CanvasRenderingContext2D, s: number) => void;
}

const S = 256;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export function shade(c: number, f: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

function noise(g: CanvasRenderingContext2D, s: number, amount: number, seed = 1) {
  const r = rng(seed);
  for (let i = 0; i < s * s * 0.05; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${amount * r()})`;
    g.fillRect(Math.floor(r() * s), Math.floor(r() * s), 2, 2);
  }
}

const solid = (c: number, n = 0.05) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = hex(c);
  g.fillRect(0, 0, s, s);
  if (n) noise(g, s, n, c);
};

const stripes = (a: number, b: number, n: number) => (g: CanvasRenderingContext2D, s: number) => {
  const w = s / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = hex(i % 2 ? b : a);
    g.fillRect(i * w, 0, w, s);
  }
};

const dots = (bg: number, fg: number, n: number, r: number) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, s, s);
  g.fillStyle = hex(fg);
  const st = s / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.beginPath();
      g.arc(x * st + st / 2 + (y % 2 ? st / 2 : 0), y * st + st / 2, r * st, 0, Math.PI * 2);
      g.fill();
      if (y % 2) {
        g.beginPath();
        g.arc(x * st + st / 2 - st / 2, y * st + st / 2, r * st, 0, Math.PI * 2);
        g.fill();
      }
    }
};

const planks = (base: number, rows: number, seed: number) => (g: CanvasRenderingContext2D, s: number) => {
  const r = rng(seed);
  const h = s / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * s * 0.5;
    while (x < s) {
      const len = s * (0.35 + r() * 0.4);
      g.fillStyle = hex(shade(base, (r() - 0.5) * 0.25));
      g.fillRect(x, i * h, len, h);
      g.strokeStyle = 'rgba(60,30,10,0.35)';
      g.lineWidth = 2;
      g.strokeRect(x, i * h, len, h);
      // Maserung
      g.strokeStyle = 'rgba(80,40,10,0.12)';
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const yy = i * h + h * (0.25 + 0.25 * k) + (r() - 0.5) * 3;
        g.beginPath();
        g.moveTo(x + 4, yy);
        g.bezierCurveTo(x + len * 0.3, yy + 3, x + len * 0.6, yy - 3, x + len - 4, yy);
        g.stroke();
      }
      x += len;
    }
  }
};

const tiles = (a: number, b: number, n: number, grout = 0xdddddd) => (g: CanvasRenderingContext2D, s: number) => {
  const w = s / n;
  g.fillStyle = hex(grout);
  g.fillRect(0, 0, s, s);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = hex((x + y) % 2 ? b : a);
      g.fillRect(x * w + 1.5, y * w + 1.5, w - 3, w - 3);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x * w + 3, y * w + 3, w * 0.4, 3);
    }
};

const bricks = (c: number, mortar: number) => (g: CanvasRenderingContext2D, s: number) => {
  const r = rng(7);
  g.fillStyle = hex(mortar);
  g.fillRect(0, 0, s, s);
  const rows = 8, h = s / rows, w = s / 4;
  for (let y = 0; y < rows; y++)
    for (let x = -1; x < 5; x++) {
      g.fillStyle = hex(shade(c, (r() - 0.5) * 0.25));
      const ox = y % 2 ? w / 2 : 0;
      g.fillRect(x * w + ox + 2, y * h + 2, w - 4, h - 4);
    }
};

function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, mid: string) {
  g.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.beginPath();
    g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = mid;
  g.beginPath();
  g.arc(x, y, r * 0.6, 0, Math.PI * 2);
  g.fill();
}

const flowers = (bg: number, cols: number[]) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, s, s);
  const r = rng(11);
  const pts = [[0.25, 0.25], [0.75, 0.25], [0.5, 0.6], [0, 0.6], [1, 0.6], [0.25, 0.95], [0.75, 0.95], [0.25, -0.05], [0.75, -0.05]];
  pts.forEach(([x, y], i) => {
    flower(g, x * s, y * s, s * 0.05, hex(cols[i % cols.length]), '#ffd23f');
    g.fillStyle = '#7bc96f';
    g.beginPath();
    g.ellipse(x * s + s * 0.09, y * s + s * 0.06, s * 0.035, s * 0.015, 0.6 + r() * 0.3, 0, Math.PI * 2);
    g.fill();
  });
};

function heartPath(g: CanvasRenderingContext2D, x: number, y: number, sz: number) {
  g.beginPath();
  g.moveTo(x, y + sz * 0.3);
  g.bezierCurveTo(x, y, x - sz * 0.5, y, x - sz * 0.5, y + sz * 0.3);
  g.bezierCurveTo(x - sz * 0.5, y + sz * 0.6, x, y + sz * 0.8, x, y + sz);
  g.bezierCurveTo(x, y + sz * 0.8, x + sz * 0.5, y + sz * 0.6, x + sz * 0.5, y + sz * 0.3);
  g.bezierCurveTo(x + sz * 0.5, y, x, y, x, y + sz * 0.3);
  g.fill();
}

const hearts = (bg: number, fg: number) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, s, s);
  g.fillStyle = hex(fg);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) heartPath(g, (x + (y % 2 ? 0.5 : 0)) * (s / 4) + s / 8, y * (s / 4) + s / 32, s / 8);
};

function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

const stars = (bg: number, fg: number, n: number, seed: number) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, s, s);
  const r = rng(seed);
  g.fillStyle = hex(fg);
  for (let i = 0; i < n; i++) starPath(g, r() * s, r() * s, s * (0.012 + r() * 0.03));
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < n * 3; i++) g.fillRect(r() * s, r() * s, 2, 2);
};

const clouds = (g: CanvasRenderingContext2D, s: number) => {
  const gr = g.createLinearGradient(0, 0, 0, s);
  gr.addColorStop(0, '#8fd3ff');
  gr.addColorStop(1, '#bfe8ff');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  const c = (x: number, y: number, k: number) => {
    for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.1, 0.8], [-0.9, 0.15, 0.75], [0.4, -0.5, 0.8], [-0.4, -0.4, 0.7]])
      for (const ox of [-s, 0, s]) {
        g.beginPath();
        g.arc(x + dx * k + ox, y + dy * k, r * k, 0, Math.PI * 2);
        g.fill();
      }
  };
  c(s * 0.3, s * 0.3, s * 0.08);
  c(s * 0.75, s * 0.7, s * 0.1);
};

const carpet = (c: number, seed: number) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = hex(c);
  g.fillRect(0, 0, s, s);
  const r = rng(seed);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = hex(shade(c, (r() - 0.5) * 0.3));
    g.fillRect(r() * s, r() * s, 1.5, 1.5);
  }
};

const marble = (g: CanvasRenderingContext2D, s: number) => {
  tiles(0xf4f1ec, 0xe9e4dc, 2, 0xcfc8bd)(g, s);
  const r = rng(5);
  g.strokeStyle = 'rgba(150,140,130,0.35)';
  for (let i = 0; i < 10; i++) {
    g.lineWidth = 0.5 + r() * 1.5;
    g.beginPath();
    let x = r() * s, y = r() * s;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.3) * 50;
      y += (r() - 0.5) * 50;
      g.lineTo(x, y);
    }
    g.stroke();
  }
};

const rainbow = (g: CanvasRenderingContext2D, s: number) => {
  const cols = [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x9775fa];
  const h = s / cols.length;
  cols.forEach((c, i) => {
    g.fillStyle = hex(c);
    g.fillRect(0, i * h, s, h);
  });
};

const wainscot = (wood: number, top: number) => (g: CanvasRenderingContext2D, s: number) => {
  g.fillStyle = hex(top);
  g.fillRect(0, 0, s, s);
  const w = s / 4;
  for (let i = 0; i < 4; i++) {
    g.fillStyle = hex(shade(wood, i % 2 ? 0.08 : 0));
    g.fillRect(i * w, 0, w, s);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(i * w, 0, 2, s);
  }
};

export const COVERINGS: Covering[] = [
  // Böden
  { id: 'f-parkett', name: 'Parkett', surface: 'floor', scale: 1.2, draw: planks(0xc98b52, 6, 3) },
  { id: 'f-hell', name: 'Helles Holz', surface: 'floor', scale: 1.2, draw: planks(0xe8c99a, 5, 4) },
  { id: 'f-dunkel', name: 'Dunkles Holz', surface: 'floor', scale: 1.2, draw: planks(0x8a5a33, 6, 8) },
  { id: 'f-schach', name: 'Schachbrett', surface: 'floor', scale: 1.0, draw: tiles(0xffffff, 0x333a45, 4, 0x888888) },
  { id: 'f-fliesen', name: 'Weiße Fliesen', surface: 'floor', scale: 0.8, draw: tiles(0xf4f4f4, 0xeaeaea, 4, 0xbfc4c8) },
  { id: 'f-blaufliesen', name: 'Blaue Fliesen', surface: 'floor', scale: 0.8, draw: tiles(0x8fd0f0, 0x6cb8e6, 4, 0xe8f6ff) },
  { id: 'f-marmor', name: 'Marmor', surface: 'floor', scale: 1.6, draw: marble },
  { id: 'f-teppich-rosa', name: 'Teppich Rosa', surface: 'floor', scale: 1.0, draw: carpet(0xf7a8c8, 2) },
  { id: 'f-teppich-blau', name: 'Teppich Blau', surface: 'floor', scale: 1.0, draw: carpet(0x7fb2ef, 3) },
  { id: 'f-teppich-mint', name: 'Teppich Mint', surface: 'floor', scale: 1.0, draw: carpet(0x9fe3cf, 4) },
  { id: 'f-teppich-lila', name: 'Teppich Lila', surface: 'floor', scale: 1.0, draw: carpet(0xc4a6ef, 5) },
  { id: 'f-sterne', name: 'Sternenteppich', surface: 'floor', scale: 1.5, draw: stars(0x34407a, 0xffd23f, 12, 9) },
  // Wände
  { id: 'w-weiss', name: 'Weiß', surface: 'wall', scale: 1, draw: solid(0xfbf8f2, 0.02) },
  { id: 'w-rosa', name: 'Rosa', surface: 'wall', scale: 1, draw: solid(0xffc7dc, 0.02) },
  { id: 'w-mint', name: 'Mint', surface: 'wall', scale: 1, draw: solid(0xbdf0e0, 0.02) },
  { id: 'w-blau', name: 'Himmelblau', surface: 'wall', scale: 1, draw: solid(0xbfe3ff, 0.02) },
  { id: 'w-gelb', name: 'Sonnengelb', surface: 'wall', scale: 1, draw: solid(0xffeaa0, 0.02) },
  { id: 'w-lila', name: 'Flieder', surface: 'wall', scale: 1, draw: solid(0xdccbf7, 0.02) },
  { id: 'w-pfirsich', name: 'Pfirsich', surface: 'wall', scale: 1, draw: solid(0xffd2b3, 0.02) },
  { id: 'w-streifen', name: 'Streifen Rosa', surface: 'wall', scale: 1, draw: stripes(0xffffff, 0xffc7dc, 8) },
  { id: 'w-streifen-blau', name: 'Streifen Blau', surface: 'wall', scale: 1, draw: stripes(0xffffff, 0xbfe3ff, 6) },
  { id: 'w-punkte', name: 'Punkte', surface: 'wall', scale: 0.8, draw: dots(0xfff6e0, 0xff8fb8, 4, 0.16) },
  { id: 'w-blumen', name: 'Blumentapete', surface: 'wall', scale: 0.9, draw: flowers(0xfffaf0, [0xff8fb8, 0x9b6ad8, 0x6cc4ff, 0xff9f40]) },
  { id: 'w-herzen', name: 'Herzchen', surface: 'wall', scale: 0.8, draw: hearts(0xffeef5, 0xff6b9d) },
  { id: 'w-sterne', name: 'Sterne', surface: 'wall', scale: 1, draw: stars(0x3d4c8a, 0xffe066, 10, 4) },
  { id: 'w-ziegel', name: 'Ziegelstein', surface: 'wall', scale: 1.2, draw: bricks(0xc8613d, 0xe9dccb) },
  { id: 'w-holz', name: 'Holzpaneel', surface: 'wall', scale: 1.2, draw: wainscot(0xd9a46a, 0xf3e6c8) },
  { id: 'w-fliesen', name: 'Badfliesen', surface: 'wall', scale: 0.6, draw: tiles(0xffffff, 0xd6f1ff, 4, 0xbfd0d8) },
  { id: 'w-regenbogen', name: 'Regenbogen', surface: 'wall', scale: 2.6, draw: rainbow },
  // Decken
  { id: 'c-weiss', name: 'Weiß', surface: 'ceil', scale: 1, draw: solid(0xffffff, 0.02) },
  { id: 'c-sternenhimmel', name: 'Sternenhimmel', surface: 'ceil', scale: 2, draw: stars(0x1d2357, 0xfff3a0, 16, 21) },
  { id: 'c-wolken', name: 'Wolkenhimmel', surface: 'ceil', scale: 3, draw: clouds },
  { id: 'c-holz', name: 'Holzdecke', surface: 'ceil', scale: 1.2, draw: planks(0xd9a46a, 4, 12) },
  { id: 'c-rosa', name: 'Rosa', surface: 'ceil', scale: 1, draw: solid(0xffdce9, 0.02) },
  { id: 'c-gelb', name: 'Sonnengelb', surface: 'ceil', scale: 1, draw: solid(0xfff0b8, 0.02) },
];

export const RAW: Record<string, Covering> = {
  floor: { id: 'raw-floor', name: 'Estrich', surface: 'floor', scale: 2, draw: solid(0xc4c0b8, 0.12) },
  wall: { id: 'raw-wall', name: 'Rohbau', surface: 'wall', scale: 2, draw: solid(0xd6d3cd, 0.1) },
  ceil: { id: 'raw-ceil', name: 'Rohbau', surface: 'ceil', scale: 2, draw: solid(0xe0ddd7, 0.08) },
};

export function plaster(color: number): Covering {
  return { id: 'plaster-' + color.toString(16), name: 'Putz', surface: 'wall', scale: 1.5, draw: solid(color, 0.06) };
}

export const GRASS: Covering = {
  id: 'grass', name: 'Rasen', surface: 'floor', scale: 3,
  draw: (g, s) => {
    g.fillStyle = '#8fd16a';
    g.fillRect(0, 0, s, s);
    const r = rng(42);
    for (let i = 0; i < 2500; i++) {
      g.strokeStyle = hex(shade(0x7cc457, (r() - 0.5) * 0.35));
      const x = r() * s, y = r() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - 4 - r() * 4);
      g.stroke();
    }
  },
};

export function roofTiles(color: number): Covering {
  return {
    id: 'roof-' + color.toString(16), name: 'Dach', surface: 'wall', scale: 1.2,
    draw: (g, s) => {
      g.fillStyle = hex(shade(color, -0.25));
      g.fillRect(0, 0, s, s);
      const rows = 6, h = s / rows, n = 6, w = s / n;
      for (let y = 0; y < rows; y++)
        for (let x = -1; x <= n; x++) {
          const ox = y % 2 ? w / 2 : 0;
          g.fillStyle = hex(shade(color, ((x * 7 + y * 3) % 5) * 0.03));
          g.beginPath();
          g.ellipse(x * w + ox + w / 2, y * h + h * 0.55, w * 0.48, h * 0.6, 0, 0, Math.PI);
          g.fill();
        }
    },
  };
}

const texCache = new Map<string, THREE.CanvasTexture>();
const canvasCache = new Map<string, HTMLCanvasElement>();

function canvasFor(c: Covering) {
  let cv = canvasCache.get(c.id);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = S;
    c.draw(cv.getContext('2d')!, S);
    canvasCache.set(c.id, cv);
  }
  return cv;
}

export function textureFor(c: Covering): THREE.CanvasTexture {
  let t = texCache.get(c.id);
  if (!t) {
    t = new THREE.CanvasTexture(canvasFor(c));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.repeat.set(1 / c.scale, 1 / c.scale);
    texCache.set(c.id, t);
  }
  return t;
}

export function coveringThumb(c: Covering): string {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  const g = cv.getContext('2d')!;
  g.drawImage(canvasFor(c), 0, 0, 96, 96);
  return cv.toDataURL();
}

export function coveringById(id: string): Covering | undefined {
  return COVERINGS.find((c) => c.id === id);
}
