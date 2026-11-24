import * as THREE from 'three';
import type { HouseDef, RoomDef, StairDef } from './houses';
import type { Rect } from './collision';
import { GRASS, RAW, plaster, roofTiles, textureFor, type Covering } from './textures';

export const H = 2.7; // Etagenhöhe
export const T = 0.2; // Wandstärke
const SLAB = 0.1;
const DOOR_H = 2.1, SILL = 0.9, WIN_TOP = 2.1;

export interface Collider { rect: Rect; level: number }

export interface HouseModel {
  def: HouseDef;
  group: THREE.Group;
  levelGroups: THREE.Group[];
  roof: THREE.Group;
  walls: THREE.Mesh[];
  floors: THREE.Mesh[];
  ceilings: THREE.Mesh[];
  ground: THREE.Mesh;
  occluders: THREE.Mesh[];
  colliders: Collider[];
  clipPlanes: THREE.Plane[];
  windows: THREE.Group[];
  levels: number;
  center: THREE.Vector3;
  size: THREE.Vector3;
  roomAt(x: number, z: number, level: number): RoomDef | undefined;
  groundY(x: number, z: number, prevY: number): number | null;
  applyCovering(key: string, cov: Covering | null): void;
  defaultCovering(key: string): Covering;
  dispose(): void;
}

function worldUV(g: THREE.BufferGeometry) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    if (ny > 0.5) uv.setXY(i, p.getX(i), -p.getZ(i));
    else if (nx > 0.5) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  uv.needsUpdate = true;
}

interface Run { horiz: boolean; c: number; a: number; b: number; pos: string; neg: string; extA: boolean; extB: boolean }

const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildHouse(def: HouseDef): HouseModel {
  const group = new THREE.Group();
  const levels = Math.max(...def.rooms.map((r) => r.level)) + 1;
  const levelGroups: THREE.Group[] = [];
  const walls: THREE.Mesh[] = [], floors: THREE.Mesh[] = [], ceilings: THREE.Mesh[] = [];
  const colliders: Collider[] = [];
  const clipPlanes: THREE.Plane[] = [];
  const windows: THREE.Group[] = [];
  const disposables: { dispose(): void }[] = [];
  const stairs = def.stairs ?? [];

  // ---------- Materialverwaltung ----------
  const registry = new Map<string, THREE.MeshStandardMaterial[]>();
  const current = new Map<string, Covering>();
  const outside = plaster(def.wallColor);
  const defaultCovering = (key: string): Covering => {
    if (key === 'wall:outside') return outside;
    return RAW[key.split(':')[0]] ?? RAW.wall;
  };
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const getMat = (key: string, clip: THREE.Plane | null) => {
    const ck = key + '|' + (clip ? clipPlanes.indexOf(clip) : 'n');
    const cached = matCache.get(ck);
    if (cached) return cached;
    const cov = defaultCovering(key);
    const m = new THREE.MeshStandardMaterial({ map: textureFor(cov), roughness: 0.85, side: clip ? THREE.DoubleSide : THREE.FrontSide, shadowSide: THREE.BackSide });
    if (clip) {
      m.clippingPlanes = [clip];
      m.clipShadows = true;
    }
    if (!registry.has(key)) registry.set(key, []);
    registry.get(key)!.push(m);
    disposables.push(m);
    matCache.set(ck, m);
    return m;
  };
  const concrete: THREE.MeshStandardMaterial[] = [];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xc98b52, roughness: 0.6 });
  disposables.push(glassMat, frameMat, woodMat);

  const holesOn = (level: number) =>
    stairs.filter((s) => s.level + 1 === level).map((s) => ({ x: s.x, z: s.z, w: s.w, d: s.d }));
  const holesUnder = (level: number) => stairs.filter((s) => s.level === level).map((s) => ({ x: s.x, z: s.z, w: s.w, d: s.d }));

  const roomsOn = (level: number) => def.rooms.filter((r) => r.level === level);
  const roomAt = (x: number, z: number, level: number, eps = 0) =>
    roomsOn(level).find((r) => x >= r.x - eps && x <= r.x + r.w + eps && z >= r.z - eps && z <= r.z + r.d + eps);
  const roomStrict = (x: number, z: number, level: number) =>
    roomsOn(level).find((r) => x > r.x && x < r.x + r.w && z > r.z && z < r.z + r.d);

  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mats: THREE.Material | THREE.Material[], parent: THREE.Object3D) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    worldUV(g);
    disposables.push(g);
    const m = new THREE.Mesh(g, mats);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  for (let L = 0; L < levels; L++) {
    const lg = new THREE.Group();
    lg.name = 'level' + L;
    levelGroups.push(lg);
    group.add(lg);
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
    clipPlanes.push(plane);
    const conc = new THREE.MeshStandardMaterial({ color: 0xcfcbc4, roughness: 0.9, side: THREE.DoubleSide, shadowSide: THREE.BackSide, clippingPlanes: [plane], clipShadows: true });
    concrete.push(conc);
    disposables.push(conc);
    const y0 = L * H, y1 = y0 + H;
    const rooms = roomsOn(L);

    // ---------- Wandlinien sammeln ----------
    const runs: Run[] = [];
    for (const horiz of [true, false]) {
      const lines = new Map<number, { iv: [number, number][]; bps: Set<number> }>();
      for (const r of rooms) {
        const cs = horiz ? [r.z, r.z + r.d] : [r.x, r.x + r.w];
        const a = horiz ? r.x : r.z, b = horiz ? r.x + r.w : r.z + r.d;
        for (const c of cs) {
          const k = r2(c);
          if (!lines.has(k)) lines.set(k, { iv: [], bps: new Set() });
          const l = lines.get(k)!;
          l.iv.push([a, b]);
          l.bps.add(r2(a));
          l.bps.add(r2(b));
        }
      }
      for (const [c, l] of lines) {
        l.iv.sort((p, q) => p[0] - q[0]);
        const unions: [number, number][] = [];
        for (const iv of l.iv) {
          const last = unions[unions.length - 1];
          if (last && iv[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], iv[1]);
          else unions.push([iv[0], iv[1]]);
        }
        for (const [u0, u1] of unions) {
          const pts = [...l.bps].filter((p) => p > u0 + 1e-6 && p < u1 - 1e-6).sort((p, q) => p - q);
          const cuts = [u0, ...pts, u1];
          let cur: Run | null = null;
          for (let i = 0; i < cuts.length - 1; i++) {
            const m = (cuts[i] + cuts[i + 1]) / 2;
            const side = (o: number) => {
              const rr = horiz ? roomStrict(m, c + o, L) : roomStrict(c + o, m, L);
              return rr ? rr.id : 'outside';
            };
            const pos = side(0.15), neg = side(-0.15);
            if (pos === neg) { cur = null; continue; }
            if (cur && cur.pos === pos && cur.neg === neg && Math.abs(cur.b - cuts[i]) < 1e-6) cur.b = cuts[i + 1];
            else {
              cur = { horiz, c, a: cuts[i], b: cuts[i + 1], pos, neg, extA: false, extB: false };
              runs.push(cur);
            }
          }
        }
        for (const run of runs) {
          if (run.horiz !== horiz || run.c !== c) continue;
          run.extA = unions.some((u) => Math.abs(u[0] - run.a) < 1e-6);
          run.extB = unions.some((u) => Math.abs(u[1] - run.b) < 1e-6);
        }
      }
    }

    // ---------- Wände bauen ----------
    for (const run of runs) {
      const keyP = run.pos === 'outside' ? 'wall:outside' : 'wall:' + run.pos;
      const keyN = run.neg === 'outside' ? 'wall:outside' : 'wall:' + run.neg;
      const mP = getMat(keyP, plane), mN = getMat(keyN, plane);
      const s0 = run.a + T / 2, s1 = run.b - T / 2;
      // Material-Indizes: px, nx, py, ny, pz, nz
      const mats = run.horiz ? [conc, conc, conc, conc, mP, mN] : [mP, mN, conc, conc, conc, conc];
      const keys = run.horiz ? ['', '', '', '', keyP, keyN] : [keyP, keyN, '', '', '', ''];
      const ops = def.openings
        .filter((o) => o.level === L && Math.abs((run.horiz ? o.z : o.x) - run.c) < 0.05)
        .map((o) => ({ type: o.type, s: run.horiz ? o.x : o.z, w: o.w ?? (o.type === 'door' ? 0.9 : 1.2) }))
        .filter((o) => o.s > run.a && o.s < run.b)
        .sort((p, q) => p.s - q.s);
      const piece = (a: number, b: number, ya: number, yb: number) => {
        if (b - a < 0.005 || yb - ya < 0.005) return;
        const m = run.horiz
          ? box(a, b, ya, yb, run.c - T / 2, run.c + T / 2, mats, lg)
          : box(run.c - T / 2, run.c + T / 2, ya, yb, a, b, mats, lg);
        m.userData = { kind: 'wall', keys, level: L };
        walls.push(m);
        const rect: Rect = run.horiz
          ? { cx: (a + b) / 2, cz: run.c, hx: (b - a) / 2, hz: T / 2, rot: 0, y0: ya, y1: yb }
          : { cx: run.c, cz: (a + b) / 2, hx: T / 2, hz: (b - a) / 2, rot: 0, y0: ya, y1: yb };
        colliders.push({ rect, level: L });
      };
      let s = s0;
      for (const o of ops) {
        const oa = o.s - o.w / 2, ob = o.s + o.w / 2;
        piece(s, oa, y0, y1);
        if (o.type === 'door') piece(oa, ob, y0 + DOOR_H, y1);
        else {
          piece(oa, ob, y0, y0 + SILL);
          piece(oa, ob, y0 + WIN_TOP, y1);
          // Fensterscheibe + Rahmen
          const fg = new THREE.Group();
          const len = ob - oa, hh = WIN_TOP - SILL;
          const pane = new THREE.Mesh(new THREE.BoxGeometry(len, hh, 0.02), glassMat);
          disposables.push(pane.geometry);
          fg.add(pane);
          const fr = (w: number, h: number, x: number, y: number) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), frameMat);
            disposables.push(m.geometry);
            m.position.set(x, y, 0);
            m.castShadow = true;
            fg.add(m);
          };
          fr(len, 0.06, 0, hh / 2 - 0.03);
          fr(len, 0.06, 0, -hh / 2 + 0.03);
          fr(0.06, hh, -len / 2 + 0.03, 0);
          fr(0.06, hh, len / 2 - 0.03, 0);
          fr(0.05, hh, 0, 0);
          fg.position.set(run.horiz ? o.s : run.c, y0 + SILL + hh / 2, run.horiz ? run.c : o.s);
          if (!run.horiz) fg.rotation.y = Math.PI / 2;
          fg.userData.noRaycast = true;
          windows.push(fg);
          lg.add(fg);
        }
        s = ob;
      }
      piece(s, s1, y0, y1);
    }

    // ---------- Eckpfeiler an allen Knoten ----------
    const nodes = new Map<string, [number, number]>();
    for (const run of runs)
      for (const s of [run.a, run.b]) {
        const x = run.horiz ? s : run.c, z = run.horiz ? run.c : s;
        nodes.set(r2(x) + ',' + r2(z), [x, z]);
      }
    const attached = (x: number, z: number, horiz: boolean, s: number) =>
      runs.some((r) => r.horiz === horiz && Math.abs(r.c - (horiz ? z : x)) < 1e-6 && s > r.a && s < r.b);
    for (const [x, z] of nodes.values()) {
      const faceKey = (dx: number, dz: number) => {
        const rr = roomStrict(x + dx * 0.15 + dz * 0.05, z + dz * 0.15 + dx * 0.05, L);
        return rr ? 'wall:' + rr.id : 'wall:outside';
      };
      const dirs: [number, number, boolean][] = [[1, 0, attached(x, z, true, x + 0.15)], [-1, 0, attached(x, z, true, x - 0.15)], [0, 0, true], [0, 0, true], [0, 1, attached(x, z, false, z + 0.15)], [0, -1, attached(x, z, false, z - 0.15)]];
      const keys = dirs.map(([dx, dz, att]) => (att ? '' : faceKey(dx, dz)));
      const mats = keys.map((k) => (k ? getMat(k, plane) : conc));
      const m = box(x - T / 2, x + T / 2, y0, y1, z - T / 2, z + T / 2, mats, lg);
      m.userData = { kind: 'wall', keys, level: L };
      walls.push(m);
      colliders.push({ rect: { cx: x, cz: z, hx: T / 2, hz: T / 2, rot: 0, y0, y1 }, level: L });
    }

    // ---------- Böden & Decken ----------
    const sub = (r: { x: number; z: number; w: number; d: number }, holes: { x: number; z: number; w: number; d: number }[]) => {
      let parts = [{ x0: r.x, x1: r.x + r.w, z0: r.z, z1: r.z + r.d }];
      for (const h of holes) {
        const next: typeof parts = [];
        for (const p of parts) {
          const hx0 = Math.max(p.x0, h.x), hx1 = Math.min(p.x1, h.x + h.w);
          const hz0 = Math.max(p.z0, h.z), hz1 = Math.min(p.z1, h.z + h.d);
          if (hx0 >= hx1 || hz0 >= hz1) { next.push(p); continue; }
          if (p.z0 < hz0) next.push({ x0: p.x0, x1: p.x1, z0: p.z0, z1: hz0 });
          if (hz1 < p.z1) next.push({ x0: p.x0, x1: p.x1, z0: hz1, z1: p.z1 });
          if (p.x0 < hx0) next.push({ x0: p.x0, x1: hx0, z0: hz0, z1: hz1 });
          if (hx1 < p.x1) next.push({ x0: hx1, x1: p.x1, z0: hz0, z1: hz1 });
        }
        parts = next;
      }
      return parts;
    };
    for (const r of rooms) {
      const fm = getMat('floor:' + r.id, null);
      for (const p of sub(r, holesOn(L))) {
        const g = new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0);
        g.rotateX(-Math.PI / 2);
        g.translate((p.x0 + p.x1) / 2, y0 + (L === 0 ? 0.015 : 0.002), (p.z0 + p.z1) / 2);
        worldUV(g);
        disposables.push(g);
        const m = new THREE.Mesh(g, fm);
        m.receiveShadow = true;
        m.userData = { kind: 'floor', key: 'floor:' + r.id, level: L, room: r.id };
        lg.add(m);
        floors.push(m);
      }
      const cm = getMat('ceil:' + r.id, null);
      for (const p of sub(r, holesUnder(L))) {
        const g = new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0);
        g.rotateX(Math.PI / 2);
        g.translate((p.x0 + p.x1) / 2, y1 - SLAB, (p.z0 + p.z1) / 2);
        worldUV(g);
        disposables.push(g);
        const m = new THREE.Mesh(g, cm);
        m.userData = { kind: 'ceil', key: 'ceil:' + r.id, level: L, room: r.id };
        lg.add(m);
        ceilings.push(m);
      }
    }
    // Fundament
    if (L === 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const r of rooms) {
        const fm = new THREE.Mesh(new THREE.BoxGeometry(r.w + T, 0.12, r.d + T), concrete[0]);
        disposables.push(fm.geometry);
        fm.position.set(r.x + r.w / 2, -0.05, r.z + r.d / 2);
        fm.receiveShadow = true;
        lg.add(fm);
        minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.w); minZ = Math.min(minZ, r.z); maxZ = Math.max(maxZ, r.z + r.d);
      }
    }
  }

  // ---------- Treppen ----------
  for (const st of stairs) {
    const lg = levelGroups[st.level];
    const N = 14, y0 = st.level * H;
    const along = st.dir[0] === 'x' ? st.w : st.d;
    const stepLen = along / N;
    for (let i = 0; i < N; i++) {
      const h = ((i + 1) * H) / N;
      // i = 0 ist unterste Stufe (am Startende)
      let x0 = st.x, x1 = st.x + st.w, z0 = st.z, z1 = st.z + st.d;
      if (st.dir === 'z-') { z1 = st.z + st.d - i * stepLen; z0 = z1 - stepLen; }
      if (st.dir === 'z+') { z0 = st.z + i * stepLen; z1 = z0 + stepLen; }
      if (st.dir === 'x-') { x1 = st.x + st.w - i * stepLen; x0 = x1 - stepLen; }
      if (st.dir === 'x+') { x0 = st.x + i * stepLen; x1 = x0 + stepLen; }
      const m = box(x0, x1, y0 + Math.max(0, h - 0.5), y0 + h, z0, z1, woodMat, lg);
      m.userData = { kind: 'stair' };
    }
    // Geländer oben um das Treppenloch (Ausgangsseite offen)
    const up = levelGroups[st.level + 1];
    const yb = (st.level + 1) * H, rt = 0.06, rh = 1.0;
    const sides: { a: [number, number]; b: [number, number]; side: string }[] = [
      { a: [st.x, st.z], b: [st.x + st.w, st.z], side: 'z-' },
      { a: [st.x, st.z + st.d], b: [st.x + st.w, st.z + st.d], side: 'z+' },
      { a: [st.x, st.z], b: [st.x, st.z + st.d], side: 'x-' },
      { a: [st.x + st.w, st.z], b: [st.x + st.w, st.z + st.d], side: 'x+' },
    ];
    for (const sd of sides) {
      if (sd.side === st.dir) continue;
      const hz = sd.a[1] === sd.b[1];
      const x0 = hz ? sd.a[0] : sd.a[0] - rt / 2, x1 = hz ? sd.b[0] : sd.a[0] + rt / 2;
      const z0 = hz ? sd.a[1] - rt / 2 : sd.a[1], z1 = hz ? sd.a[1] + rt / 2 : sd.b[1];
      const m = box(x0, x1, yb + rh - 0.08, yb + rh, z0, z1, woodMat, up);
      m.userData = { kind: 'stair' };
      const len = hz ? x1 - x0 : z1 - z0;
      const n = Math.max(2, Math.round(len / 0.25));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = hz ? x0 + (x1 - x0) * t : (x0 + x1) / 2, pz = hz ? (z0 + z1) / 2 : z0 + (z1 - z0) * t;
        const b = box(px - 0.025, px + 0.025, yb, yb + rh - 0.08, pz - 0.025, pz + 0.025, woodMat, up);
        b.userData = { kind: 'stair' };
      }
      colliders.push({ rect: { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: 0, y0: yb, y1: yb + rh }, level: st.level + 1 });
    }
  }

  // ---------- Dach ----------
  const roof = new THREE.Group();
  roof.name = 'roof';
  const roofCov = roofTiles(def.roofColor);
  const roofMat = new THREE.MeshStandardMaterial({ map: textureFor(roofCov), roughness: 0.7 });
  const gableMat = getMat('wall:outside', null);
  disposables.push(roofMat);
  const top = roomsOn(levels - 1);
  const topY = levels * H;
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const r of def.rooms) {
    bx0 = Math.min(bx0, r.x); bx1 = Math.max(bx1, r.x + r.w); bz0 = Math.min(bz0, r.z); bz1 = Math.max(bz1, r.z + r.d);
  }
  if (def.roof === 'gable') {
    const ov = 0.45;
    const x0 = bx0 - T / 2, x1 = bx1 + T / 2, z0 = bz0 - T / 2, z1 = bz1 + T / 2;
    const alongX = x1 - x0 >= z1 - z0;
    const span = alongX ? z1 - z0 : x1 - x0;
    const len = (alongX ? x1 - x0 : z1 - z0) + ov * 2;
    const half = span / 2 + ov;
    const rise = (span / 2) * 0.8;
    const ang = Math.atan2(rise, span / 2);
    const slope = half / Math.cos(ang);
    const th = 0.16;
    for (const sgn of [-1, 1]) {
      const sl = alongX ? new THREE.BoxGeometry(len, th, slope) : new THREE.BoxGeometry(slope, th, len);
      worldUV(sl);
      disposables.push(sl);
      const m = new THREE.Mesh(sl, roofMat);
      m.castShadow = true;
      m.receiveShadow = true;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const y = topY + rise - Math.tan(ang) * (half / 2) + th / 2;
      if (alongX) {
        m.position.set(cx, y, cz + sgn * (half / 2));
        m.rotation.x = sgn * ang;
      } else {
        m.position.set(cx + sgn * (half / 2), y, cz);
        m.rotation.z = -sgn * ang;
      }
      roof.add(m);
    }
    // Giebeldreiecke
    const shape = new THREE.Shape();
    shape.moveTo(-span / 2, 0);
    shape.lineTo(span / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    for (const end of [0, 1]) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
      g.translate(0, 0, -T / 2);
      if (alongX) g.rotateY(Math.PI / 2);
      const px = alongX ? (end ? x1 - T / 2 : x0 + T / 2) : (x0 + x1) / 2;
      const pz = alongX ? (z0 + z1) / 2 : (end ? z1 - T / 2 : z0 + T / 2);
      g.translate(px, topY, pz);
      g.computeVertexNormals();
      worldUV(g);
      disposables.push(g);
      const m = new THREE.Mesh(g, gableMat);
      m.castShadow = true;
      roof.add(m);
    }
  } else {
    for (const r of top) {
      const g = new THREE.BoxGeometry(r.w + T + 0.4, 0.25, r.d + T + 0.4);
      g.translate(r.x + r.w / 2, topY + 0.125, r.z + r.d / 2);
      worldUV(g);
      disposables.push(g);
      const m = new THREE.Mesh(g, roofMat);
      m.castShadow = true;
      m.receiveShadow = true;
      roof.add(m);
    }
  }
  group.add(roof);

  // ---------- Boden draußen ----------
  const gGeo = new THREE.PlaneGeometry(90, 90);
  gGeo.rotateX(-Math.PI / 2);
  gGeo.translate((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2);
  worldUV(gGeo);
  disposables.push(gGeo);
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ roughness: 1, map: textureFor(GRASS) }));
  ground.receiveShadow = true;
  ground.userData = { kind: 'ground', level: 0 };
  group.add(ground);

  const occluders = [...walls, ...floors, ...ceilings];

  const center = new THREE.Vector3((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2);
  const size = new THREE.Vector3(bx1 - bx0, levels * H, bz1 - bz0);

  const groundY = (x: number, z: number, prevY: number): number | null => {
    const cands = [0];
    for (let L = 1; L < levels; L++) {
      if (!roomAt(x, z, L, 0.12)) continue;
      const inHole = holesOn(L).some((h) => x > h.x && x < h.x + h.w && z > h.z && z < h.z + h.d);
      if (!inHole) cands.push(L * H);
    }
    for (const st of stairs) {
      if (x < st.x || x > st.x + st.w || z < st.z || z > st.z + st.d) continue;
      let t = 0;
      if (st.dir === 'z-') t = (st.z + st.d - z) / st.d;
      if (st.dir === 'z+') t = (z - st.z) / st.d;
      if (st.dir === 'x-') t = (st.x + st.w - x) / st.w;
      if (st.dir === 'x+') t = (x - st.x) / st.w;
      const y = st.level * H + Math.min(1, Math.max(0, t)) * H;
      if (y > prevY + 0.45 && prevY < y - 0.45 && prevY < st.level * H + H - 0.3) {
        // seitlich gegen die Treppe gelaufen
        if (Math.abs(prevY - st.level * H) < 0.3) return null;
      }
      cands.push(y);
    }
    let best = -Infinity;
    for (const c of cands) if (c <= prevY + 0.45 && c > best) best = c;
    return best === -Infinity ? null : best;
  };

  const model: HouseModel = {
    def, group, levelGroups, roof, windows, walls, floors, ceilings, ground, occluders, colliders, clipPlanes, levels, center, size,
    roomAt: (x, z, level) => roomAt(x, z, level, 0.1),
    groundY,
    defaultCovering,
    applyCovering(key, cov) {
      const list = registry.get(key);
      if (!list) return;
      const c = cov ?? defaultCovering(key);
      current.set(key, c);
      for (const m of list) {
        m.map = textureFor(c);
        m.needsUpdate = true;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
      ground.material instanceof THREE.Material && ground.material.dispose();
    },
  };
  return model;
}

export type { StairDef };
