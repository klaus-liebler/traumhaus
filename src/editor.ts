import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { buildHouse, H, type HouseModel } from './houseBuilder';
import type { HouseDef } from './houses';
import { ITEMS, itemById, localBox, type ItemDef, type LocalBox } from './catalog';
import { coveringById, type Covering } from './textures';
import { overlap, pointInRect, type Rect } from './collision';
import { Figure } from './figure';

export type Mode = 'drone' | 'ego' | 'third';
export type Entry = { kind: 'item'; def: ItemDef } | { kind: 'cover'; cov: Covering };

interface ItemData {
  def: ItemDef;
  colorIdx: number;
  local: LocalBox;
  model: THREE.Group;
  helper?: THREE.Object3D;
  colliding?: boolean;
}
type Item = THREE.Group & { userData: ItemData };

interface Hit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  kind: 'floor' | 'ground' | 'wall' | 'ceil' | 'item';
  object: THREE.Mesh;
  item?: Item;
  matIndex: number;
}

interface SaveState {
  covers: Record<string, string>;
  items: { t: string; c: number; p: [number, number, number]; r: number }[];
}

const STORE = 'traumhaus:';
const levelOfY = (y: number) => Math.max(0, Math.floor((y + 0.25) / H));

export class Editor extends EventTarget {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  gizmo: TransformControls;
  house: HouseModel | null = null;
  items: Item[] = [];
  selected: Item | null = null;
  mode: Mode = 'drone';
  roofOn = false;
  lowWalls = false;
  activeTop = 0;
  autoTour = false;
  gizmoMode: 'translate' | 'rotate' = 'translate';
  covers: Record<string, string> = {};

  private figure = new Figure();
  fig = { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.12, camPitch: -0.35 };
  private keys = new Set<string>();
  private vkeys = { fwd: false, back: false, left: false, right: false };
  private ray = new THREE.Raycaster();
  private clock = new THREE.Timer();
  private container: HTMLElement;
  private preview: { entry: Entry; obj?: Item; hoverKey?: string; prevCover?: string | null } | null = null;
  private drag: { item: Item; offset: THREE.Vector3; started: boolean; sx: number; sy: number; stack: Item[]; last: THREE.Vector3 } | null = null;
  private down: { x: number; y: number; moved: boolean; look: boolean } | null = null;
  private lastValid = { pos: new THREE.Vector3(), rot: 0 };
  private gizmoStack: { item: Item; offset: THREE.Vector3 }[] = [];
  private droneView = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  private saveTimer = 0;
  private camPos = new THREE.Vector3();

  constructor(container: HTMLElement) {
    super();
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.localClippingEnabled = true;
    container.appendChild(r.domElement);
    r.domElement.style.touchAction = 'none';
    r.domElement.style.display = 'block';

    this.scene.background = new THREE.Color(0xa9ddff);
    this.scene.fog = new THREE.Fog(0xa9ddff, 45, 90);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);

    const hemi = new THREE.HemisphereLight(0xeaf6ff, 0xe6dccb, 1.7);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff6e6, 2.2);
    sun.position.set(14, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -20;
    sc.right = sc.top = 20;
    sc.near = 1;
    sc.far = 70;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    // Reihenfolge der Listener: Gizmo → Editor → Orbit
    this.gizmo = new TransformControls(this.camera, r.domElement);
    this.gizmo.size = 0.9;
    this.gizmo.setRotationSnap(THREE.MathUtils.degToRad(15));
    this.scene.add(this.gizmo.getHelper());
    this.gizmo.addEventListener('dragging-changed', (e) => this.onGizmoDragging(!!(e as unknown as { value: boolean }).value));
    this.gizmo.addEventListener('objectChange', () => this.onGizmoChange());

    r.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));

    this.orbit = new OrbitControls(this.camera, r.domElement);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI * 0.49;
    this.orbit.minDistance = 1.5;
    this.orbit.maxDistance = 45;
    this.orbit.autoRotateSpeed = 1.2;
    this.orbit.listenToKeyEvents(window);
    this.orbit.keyPanSpeed = 20;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());

    this.scene.add(this.figure.group);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    r.setAnimationLoop(() => this.tick());
  }

  private sun: THREE.DirectionalLight;

  // ================= Haus =================
  loadHouse(def: HouseDef) {
    this.select(null);
    for (const it of this.items) this.disposeItem(it);
    this.items = [];
    if (this.house) {
      this.scene.remove(this.house.group);
      this.house.dispose();
    }
    this.setFaded(new Set());
    this.fadeCache.forEach((m) => m.dispose());
    this.fadeCache.clear();
    const h = (this.house = buildHouse(def));
    this.scene.add(h.group);
    this.covers = {};
    this.activeTop = h.levels - 1;
    this.roofOn = false;
    this.lowWalls = false;
    this.applyVisibility();
    this.sun.target.position.copy(h.center);
    this.sun.position.copy(h.center).add(new THREE.Vector3(14, 22, 12));

    // Gespeicherten Stand laden
    const st = this.readSave(def.id);
    if (st) {
      for (const [k, v] of Object.entries(st.covers)) {
        const c = coveringById(v);
        if (c) {
          h.applyCovering(k, c);
          this.covers[k] = v;
        }
      }
      for (const s of st.items) {
        const d = itemById(s.t);
        if (!d) continue;
        const it = this.createItem(d, s.c);
        it.position.set(...s.p);
        it.rotation.y = s.r;
      }
      this.updateOverlaps();
    }

    this.fig.x = def.spawn.x;
    this.fig.z = def.spawn.z;
    this.fig.y = 0;
    this.fig.yaw = def.spawn.yaw;
    this.updateFigure(0, 0);

    const c = h.center;
    const aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    const dist = (Math.max(h.size.x, h.size.z) * 1.35 + 4) * Math.max(1, 1.2 / aspect);
    this.droneView.target.set(c.x, 1, c.z);
    this.droneView.pos.set(c.x + dist * 0.45, dist * 0.85, c.z + dist * 0.85);
    this.setMode('drone');
    this.emit('change');
  }

  hasSave(id: string) {
    return !!this.readSave(id);
  }

  private readSave(id: string): SaveState | null {
    try {
      const raw = localStorage.getItem(STORE + id);
      return raw ? (JSON.parse(raw) as SaveState) : null;
    } catch {
      return null;
    }
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 400);
  }

  save() {
    if (!this.house) return;
    const st: SaveState = {
      covers: this.covers,
      items: this.items.map((i) => ({
        t: i.userData.def.id,
        c: i.userData.colorIdx,
        p: [+i.position.x.toFixed(3), +i.position.y.toFixed(3), +i.position.z.toFixed(3)],
        r: +i.rotation.y.toFixed(4),
      })),
    };
    try {
      localStorage.setItem(STORE + this.house.def.id, JSON.stringify(st));
    } catch {
      /* Speichern nicht möglich – egal */
    }
  }

  clearAll() {
    if (!this.house) return;
    this.select(null);
    for (const it of this.items) this.disposeItem(it);
    this.items = [];
    for (const k of Object.keys(this.covers)) this.house.applyCovering(k, null);
    this.covers = {};
    this.save();
    this.emit('change');
  }

  // ================= Ansicht =================
  setMode(m: Mode) {
    if (this.mode === 'drone' && m !== 'drone') {
      this.droneView.pos.copy(this.camera.position);
      this.droneView.target.copy(this.orbit.target);
    }
    this.mode = m;
    this.setFaded(new Set());
    this.orbit.enabled = m === 'drone';
    if (m === 'drone') {
      this.camera.position.copy(this.droneView.pos);
      this.orbit.target.copy(this.droneView.target);
      this.orbit.update();
    } else {
      this.autoTour = false;
      this.orbit.autoRotate = false;
      if (this.lowWalls) this.setLowWalls(false);
      if (this.house && this.activeTop < this.house.levels - 1) this.setActiveTop(this.house.levels - 1);
      this.camPos.set(NaN, 0, 0);
    }
    this.figure.group.visible = m !== 'ego';
    this.emit('change');
  }

  setRoof(on: boolean) {
    this.roofOn = on;
    this.applyVisibility();
    this.emit('change');
  }
  setLowWalls(on: boolean) {
    this.lowWalls = on;
    this.applyVisibility();
    this.emit('change');
  }
  setActiveTop(l: number) {
    this.activeTop = l;
    if (this.selected && this.levelOf(this.selected) > l) this.select(null);
    this.applyVisibility();
    this.emit('change');
  }
  setAutoTour(on: boolean) {
    if (on && this.mode !== 'drone') this.setMode('drone');
    this.autoTour = on;
    this.orbit.autoRotate = on;
    this.emit('change');
  }

  private applyVisibility() {
    const h = this.house;
    if (!h) return;
    h.levelGroups.forEach((g, i) => (g.visible = i <= this.activeTop));
    h.roof.visible = this.roofOn && this.activeTop === h.levels - 1;
    h.clipPlanes.forEach((p, i) => (p.constant = this.lowWalls ? i * H + 1.15 : 1000));
    h.windows.forEach((w) => (w.visible = !this.lowWalls));
    const full = this.activeTop === h.levels - 1;
    h.decorClip.constant = this.lowWalls ? 1.15 + this.activeTop * H : full ? 1000 : (this.activeTop + 1) * H;
    h.decorTop.visible = !this.lowWalls && full;
    for (const it of this.items) it.visible = this.levelOf(it) <= this.activeTop;
  }

  private levelOf(it: THREE.Object3D) {
    return levelOfY(it.position.y);
  }

  // ================= Gegenstände =================
  private createItem(def: ItemDef, colorIdx = 0): Item {
    const it = new THREE.Group() as Item;
    const model = def.build(def.colors[colorIdx % def.colors.length]);
    const local = localBox(model);
    it.userData = { def, colorIdx, local, model };
    it.add(model);
    model.traverse((o) => (o.userData.item = it));
    this.scene.add(it);
    this.items.push(it);
    return it;
  }

  private disposeItem(it: Item) {
    this.scene.remove(it);
    it.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((x) => {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        });
      }
    });
  }

  private rectOf(it: Item, shrink = 0): Rect {
    const l = it.userData.local, r = it.rotation.y;
    const c = Math.cos(r), s = Math.sin(r);
    return {
      cx: it.position.x + c * l.cx + s * l.cz,
      cz: it.position.z - s * l.cx + c * l.cz,
      hx: Math.max(0.01, l.hx - shrink),
      hz: Math.max(0.01, l.hz - shrink),
      rot: r,
      y0: it.position.y + l.y0 + shrink,
      y1: it.position.y + l.y1 - shrink,
    };
  }

  private wallHits(it: Item) {
    if (!this.house) return false;
    const r = this.rectOf(it, 0.015);
    return this.house.colliders.some((c) => overlap(r, c.rect));
  }

  /** Schiebt einen Gegenstand aus Wänden heraus. false = geht nicht */
  private resolveWalls(it: Item): boolean {
    if (!this.house || it.userData.def.placement === 'wall') return true;
    for (let k = 0; k < 6; k++) {
      const r = this.rectOf(it, 0.015);
      let moved = false;
      for (const c of this.house.colliders) {
        const m = overlap(r, c.rect);
        if (m) {
          it.position.x += m.x * 1.02;
          it.position.z += m.z * 1.02;
          moved = true;
          break;
        }
      }
      if (!moved) return true;
    }
    return !this.wallHits(it);
  }

  /** Bewegt `it` von `from` Richtung `to`, bleibt aber vor Wänden stehen (gleitet entlang) */
  private sweep(it: Item, from: THREE.Vector3, to: THREE.Vector3) {
    if (it.userData.def.placement === 'wall') {
      it.position.copy(to);
      return;
    }
    const y = to.y;
    const cur = from.clone();
    cur.y = y;
    it.position.copy(cur);
    if (this.wallHits(it)) {
      // schon in einer Wand (z. B. nach dem Drehen) – frei herausschieben lassen
      it.position.copy(to);
      this.resolveWalls(it);
      return;
    }
    const d = new THREE.Vector3(to.x - cur.x, 0, to.z - cur.z);
    const n = Math.max(1, Math.ceil(d.length() / 0.04));
    const st = d.divideScalar(n);
    for (let i = 0; i < n; i++) {
      let moved = false;
      for (const [mx, mz] of [[st.x, st.z], [st.x, 0], [0, st.z]]) {
        if (!mx && !mz) continue;
        it.position.set(cur.x + mx, y, cur.z + mz);
        if (!this.wallHits(it)) {
          cur.set(cur.x + mx, y, cur.z + mz);
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    it.position.copy(cur);
  }

  updateOverlaps() {
    const list = this.items.filter((i) => !i.userData.def.flat);
    const rects = list.map((i) => this.rectOf(i, 0.02));
    const col = new Set<Item>();
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++)
        if (overlap(rects[a], rects[b])) {
          col.add(list[a]);
          col.add(list[b]);
        }
    for (const it of this.items) {
      const c = col.has(it);
      if (!!it.userData.colliding === c) continue;
      it.userData.colliding = c;
      it.userData.model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mt = m.material as THREE.MeshStandardMaterial;
        if (!mt.emissive) return;
        if (mt.userData.em === undefined) mt.userData.em = [mt.emissive.getHex(), mt.emissiveIntensity];
        if (c) {
          mt.emissive.setHex(0xff1a1a);
          mt.emissiveIntensity = 0.55;
        } else {
          mt.emissive.setHex(mt.userData.em[0]);
          mt.emissiveIntensity = mt.userData.em[1];
        }
      });
    }
    this.emit('overlaps');
  }

  get collidingCount() {
    return this.items.filter((i) => i.userData.colliding).length;
  }

  select(it: Item | null) {
    if (this.selected === it) return;
    if (this.selected?.userData.helper) {
      this.selected.remove(this.selected.userData.helper);
      (this.selected.userData.helper as THREE.Box3Helper).geometry.dispose();
      this.selected.userData.helper = undefined;
    }
    this.selected = it;
    if (it) {
      const l = it.userData.local;
      const box = new THREE.Box3(new THREE.Vector3(l.cx - l.hx, l.y0, l.cz - l.hz), new THREE.Vector3(l.cx + l.hx, l.y1, l.cz + l.hz));
      const helper = new THREE.Box3Helper(box, 0xffc400);
      helper.raycast = () => {};
      it.add(helper);
      it.userData.helper = helper;
      this.gizmo.attach(it);
      this.configureGizmo();
    } else this.gizmo.detach();
    this.emit('selection');
  }

  setGizmoMode(m: 'translate' | 'rotate') {
    this.gizmoMode = m;
    this.configureGizmo();
    this.emit('selection');
  }

  private configureGizmo() {
    const it = this.selected;
    if (!it) return;
    const g = this.gizmo;
    g.setMode(this.gizmoMode);
    const wall = it.userData.def.placement === 'wall';
    if (this.gizmoMode === 'rotate') {
      g.setSpace('local');
      g.showX = false;
      g.showZ = false;
      g.showY = !wall;
      if (wall) this.setGizmoMode('translate');
    } else if (wall) {
      g.setSpace('local');
      g.showX = true;
      g.showY = true;
      g.showZ = false;
    } else {
      g.setSpace('world');
      g.showX = true;
      g.showZ = true;
      g.showY = false;
    }
  }

  rotateSelected(deg: number) {
    const it = this.selected;
    if (!it || it.userData.def.placement === 'wall') return;
    const old = it.rotation.y, oldPos = it.position.clone();
    it.rotation.y += THREE.MathUtils.degToRad(deg);
    if (!this.resolveWalls(it)) {
      it.rotation.y = old;
      it.position.copy(oldPos);
      this.toast('Da ist eine Wand im Weg!');
    }
    this.afterChange();
  }

  deleteSelected() {
    const it = this.selected;
    if (!it) return;
    this.select(null);
    this.items = this.items.filter((i) => i !== it);
    this.disposeItem(it);
    this.afterChange();
  }

  duplicateSelected() {
    const it = this.selected;
    if (!it) return;
    const n = this.createItem(it.userData.def, it.userData.colorIdx);
    n.rotation.y = it.rotation.y;
    const step = it.userData.def.placement === 'wall' ? new THREE.Vector3(Math.cos(it.rotation.y), 0, -Math.sin(it.rotation.y)).multiplyScalar(it.userData.local.hx * 2 + 0.1) : new THREE.Vector3(0.5, 0, 0.5);
    n.position.copy(it.position).add(step);
    this.resolveWalls(n);
    this.select(n);
    this.afterChange();
  }

  recolorSelected() {
    const it = this.selected;
    if (!it) return;
    const d = it.userData.def;
    it.userData.colorIdx = (it.userData.colorIdx + 1) % d.colors.length;
    it.remove(it.userData.model);
    it.userData.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    const model = d.build(d.colors[it.userData.colorIdx]);
    model.traverse((o) => (o.userData.item = it));
    it.userData.model = model;
    it.userData.colliding = false;
    it.add(model);
    this.afterChange();
  }

  private afterChange() {
    this.updateOverlaps();
    this.scheduleSave();
    this.emit('change');
  }

  // ================= Raycasting =================
  private ndc(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  private shown(o: THREE.Object3D | null): boolean {
    while (o) {
      if (!o.visible) return false;
      o = o.parent;
    }
    return true;
  }

  private hitScene(x: number, y: number, opt: { items?: boolean; exclude?: Set<THREE.Object3D>; ceilings?: boolean } = {}): Hit | null {
    if (!this.house) return null;
    this.ray.setFromCamera(this.ndc(x, y), this.camera);
    return this.castRay(opt);
  }

  private castRay(opt: { items?: boolean; exclude?: Set<THREE.Object3D>; ceilings?: boolean; noWalls?: boolean; maxLevel?: number }): Hit | null {
    const h = this.house!;
    const targets: THREE.Object3D[] = [...h.floors, h.ground];
    if (!opt.noWalls) targets.push(...h.walls);
    if (opt.ceilings) targets.push(...h.ceilings);
    if (opt.items !== false)
      for (const it of this.items) {
        if (opt.exclude?.has(it)) continue;
        it.userData.model.traverse((o) => (o as THREE.Mesh).isMesh && targets.push(o));
      }
    const hits = this.ray.intersectObjects(targets, false);
    for (const hh of hits) {
      const o = hh.object as THREE.Mesh;
      if (!this.shown(o)) continue;
      const ud = o.userData;
      const kind: Hit['kind'] = ud.item ? 'item' : ud.kind;
      if (opt.maxLevel !== undefined && kind !== 'ground' && levelOfY(hh.point.y) > opt.maxLevel) continue;
      if (kind === 'wall' && this.lowWalls && hh.point.y > ud.level * H + 1.15) continue;
      const n = hh.face ? hh.face.normal.clone().transformDirection(o.matrixWorld) : new THREE.Vector3(0, 1, 0);
      return { point: hh.point.clone(), normal: n, kind, object: o, item: ud.item, matIndex: hh.face?.materialIndex ?? 0 };
    }
    return null;
  }

  /** Höhe, auf der ein Gegenstand bei (x,z) stehen würde – von `fromY` nach unten gesucht */
  private supportY(x: number, z: number, fromY: number, exclude: Set<THREE.Object3D>) {
    this.ray.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
    const hit = this.castRay({ exclude, noWalls: true });
    return hit ? hit.point.y : 0;
  }

  // ================= Platzieren =================
  /** Setzt `it` an die Bildschirmposition. Liefert false, wenn es dort nicht hinpasst. */
  private placeAt(it: Item, x: number, y: number, offset?: THREE.Vector3, exclude?: Set<THREE.Object3D>): boolean {
    const def = it.userData.def;
    const ex = exclude ?? new Set<THREE.Object3D>([it]);
    const hit = this.hitScene(x, y, { exclude: ex, ceilings: def.placement === 'ceiling' });
    if (!hit) return false;
    const lvl = levelOfY(hit.point.y + (hit.kind === 'ceil' ? -1 : 0));
    if (def.placement === 'wall') return this.placeOnWall(it, hit);
    if (def.placement === 'ceiling') {
      const room = this.house!.roomAt(hit.point.x, hit.point.z, lvl);
      if (!room) {
        this.hint('Lampen gehören an die Decke im Haus.');
        return false;
      }
      it.position.set(hit.point.x, lvl * H + H - 0.1, hit.point.z);
      return this.resolveWalls(it);
    }
    let baseY: number;
    if (hit.kind === 'item' && hit.normal.y > 0.6) baseY = hit.point.y;
    else if (hit.kind === 'item') baseY = hit.item!.position.y;
    else if (hit.kind === 'wall') baseY = this.supportY(hit.point.x, hit.point.z, hit.point.y + 0.1, ex);
    else baseY = hit.point.y;
    it.position.set(hit.point.x + (offset?.x ?? 0), baseY, hit.point.z + (offset?.z ?? 0));
    if (hit.kind === 'wall') it.position.addScaledVector(new THREE.Vector3(hit.normal.x, 0, hit.normal.z), 0.05);
    return this.resolveWalls(it);
  }

  private placeOnWall(it: Item, hit: Hit): boolean {
    const h = this.house!;
    let p = hit.point, n = hit.normal;
    if (hit.kind !== 'wall' || Math.abs(n.y) > 0.3) {
      // nächstgelegene Wand suchen
      const lvl = levelOfY(p.y);
      let best: Hit | null = null, bestD = 2.2;
      const origin = new THREE.Vector3(p.x, lvl * H + 1.5, p.z);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.ray.set(origin, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
        this.ray.far = bestD;
        const hh = this.ray.intersectObjects(h.walls.filter((w) => this.shown(w)), false)[0];
        this.ray.far = Infinity;
        if (hh && hh.distance < bestD && hh.face) {
          bestD = hh.distance;
          best = { point: hh.point.clone(), normal: hh.face.normal.clone(), kind: 'wall', object: hh.object as THREE.Mesh, matIndex: 0 };
        }
      }
      if (!best) {
        this.hint('Das gehört an eine Wand – zieh es an eine Wand!');
        return false;
      }
      p = best.point;
      p.y = levelOfY(hit.point.y) * H + 1.5;
      n = best.normal;
    }
    const lvl = levelOfY(p.y);
    const l = it.userData.local;
    const half = (l.y1 - l.y0) / 2;
    const ymin = lvl * H + 0.15 - l.y0, ymax = lvl * H + H - 0.15 - l.y1;
    it.rotation.y = Math.atan2(n.x, n.z);
    it.position.set(p.x + n.x * 0.002, THREE.MathUtils.clamp(p.y, ymin, Math.max(ymin, ymax)), p.z + n.z * 0.002);
    void half;
    return true;
  }

  private faceCamera(it: Item) {
    if (it.userData.def.placement !== 'floor' && it.userData.def.placement !== 'ceiling') return;
    const dx = this.camera.position.x - it.position.x, dz = this.camera.position.z - it.position.z;
    const a = Math.atan2(dx, dz);
    it.rotation.y = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  }

  // ---------- Katalog-Drag ----------
  beginCatalogDrag(entry: Entry) {
    this.cancelPreview();
    this.preview = { entry };
    if (entry.kind === 'item') {
      const it = this.createItem(entry.def);
      it.visible = false;
      this.preview.obj = it;
    }
  }

  updateCatalogDrag(x: number, y: number, over: boolean) {
    const pv = this.preview;
    if (!pv) return;
    if (pv.obj) {
      if (!over) {
        pv.obj.visible = false;
        return;
      }
      const ok = this.placeAt(pv.obj, x, y);
      if (ok && pv.obj.position.lengthSq() > 0) this.faceCameraOnce(pv.obj);
      pv.obj.visible = ok;
      this.updateOverlaps();
    } else if (pv.entry.kind === 'cover') {
      const key = over ? this.coverKeyAt(pv.entry.cov, x, y) : undefined;
      if (key !== pv.hoverKey) {
        if (pv.hoverKey) this.house!.applyCovering(pv.hoverKey, coveringById(pv.prevCover ?? '') ?? null);
        pv.hoverKey = key;
        if (key) {
          pv.prevCover = this.covers[key] ?? null;
          this.house!.applyCovering(key, pv.entry.cov);
        }
      }
    }
  }

  private faced = new WeakSet<Item>();
  private faceCameraOnce(it: Item) {
    if (it.userData.def.placement === 'wall') return;
    this.faceCamera(it);
    if (!this.resolveWalls(it)) it.visible = false;
  }

  endCatalogDrag(x: number, y: number, over: boolean) {
    const pv = this.preview;
    if (!pv) return;
    this.preview = null;
    if (pv.obj) {
      const ok = over && this.placeAt(pv.obj, x, y);
      if (ok) {
        this.faceCameraOnce(pv.obj);
        pv.obj.visible = this.levelOf(pv.obj) <= this.activeTop;
        this.select(pv.obj);
        this.afterChange();
        this.toast(`${pv.entry.kind === 'item' ? pv.entry.def.name : ''} hingestellt!`);
      } else {
        this.items = this.items.filter((i) => i !== pv.obj);
        this.disposeItem(pv.obj);
        this.updateOverlaps();
      }
    } else if (pv.entry.kind === 'cover') {
      if (pv.hoverKey) {
        this.covers[pv.hoverKey] = pv.entry.cov.id;
        this.house!.applyCovering(pv.hoverKey, pv.entry.cov);
        this.scheduleSave();
        this.toast(`${pv.entry.cov.name} – sieht toll aus!`);
      } else if (over) this.hint(this.coverHint(pv.entry.cov));
    }
  }

  cancelPreview() {
    const pv = this.preview;
    if (!pv) return;
    this.preview = null;
    if (pv.obj) {
      this.items = this.items.filter((i) => i !== pv.obj);
      this.disposeItem(pv.obj);
    }
    if (pv.hoverKey) this.house!.applyCovering(pv.hoverKey, coveringById(pv.prevCover ?? '') ?? null);
  }

  /** Klick auf einen Katalogeintrag ohne Ziehen: in die Bildmitte setzen */
  placeAtCenter(entry: Entry) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const x = r.left + r.width * 0.55, y = r.top + r.height * 0.55;
    this.beginCatalogDrag(entry);
    this.updateCatalogDrag(x, y, true);
    this.endCatalogDrag(x, y, true);
  }

  private coverHint(c: Covering) {
    return c.surface === 'floor' ? 'Zieh den Boden in ein Zimmer.' : c.surface === 'wall' ? 'Zieh die Tapete auf eine Wand.' : 'Zieh die Decke in ein Zimmer.';
  }

  private coverKeyAt(c: Covering, x: number, y: number): string | undefined {
    const hit = this.hitScene(x, y, { ceilings: true });
    if (!hit || !this.house) return;
    const h = this.house;
    if (c.surface === 'wall' && hit.kind === 'wall') {
      const k = (hit.object.userData.keys as string[])[hit.matIndex];
      if (k) return k;
    }
    if (hit.kind === 'ceil' && c.surface === 'ceil') return hit.object.userData.key;
    if (hit.kind === 'floor' && c.surface === 'floor') return hit.object.userData.key;
    let lvl = levelOfY(hit.point.y);
    if (hit.kind === 'ceil') lvl = hit.object.userData.level;
    // Punkt etwas in Blickrichtung zurückversetzen, damit Wandtreffer im richtigen Zimmer landen
    const p = hit.point.clone().addScaledVector(hit.normal, 0.2);
    const room = h.roomAt(p.x, p.z, lvl);
    if (!room) return c.surface === 'wall' && hit.kind === 'ground' ? undefined : undefined;
    return (c.surface === 'floor' ? 'floor:' : c.surface === 'wall' ? 'wall:' : 'ceil:') + room.id;
  }

  // ================= Zeiger =================
  private onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.gizmo.dragging) return;
    const hit = this.hitScene(e.clientX, e.clientY);
    if (hit?.item && hit.item !== this.preview?.obj) {
      const it = hit.item;
      this.select(it);
      this.orbit.enabled = false;
      const offset = it.position.clone().sub(hit.point);
      offset.y = 0;
      this.drag = { item: it, offset, started: false, sx: e.clientX, sy: e.clientY, stack: this.stackOn(it), last: it.position.clone() };
      this.lastValid.pos.copy(it.position);
      this.lastValid.rot = it.rotation.y;
      return;
    }
    this.down = { x: e.clientX, y: e.clientY, moved: false, look: this.mode !== 'drone' };
  }

  private stackOn(it: Item): Item[] {
    const top = it.position.y + it.userData.local.y1;
    const r = this.rectOf(it);
    return this.items.filter((o) => o !== it && Math.abs(o.position.y - top) < 0.05 && pointInRect(r, o.position.x, o.position.z));
  }

  private onPointerMove(e: PointerEvent) {
    const d = this.drag;
    if (d) {
      if (!d.started && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      d.started = true;
      const it = d.item;
      const before = it.position.clone();
      const ex = new Set<THREE.Object3D>([it, ...d.stack]);
      const ok = this.placeAt(it, e.clientX, e.clientY, it.userData.def.placement === 'floor' ? d.offset : undefined, ex);
      if (!ok) it.position.copy(before);
      else if (it.userData.def.placement !== 'wall') {
        const target = it.position.clone();
        this.sweep(it, before, target);
        if (it.position.distanceToSquared(target) > 0.01) this.hint('Da ist eine Wand im Weg!');
      }
      const delta = it.position.clone().sub(d.last);
      for (const s of d.stack) s.position.add(delta);
      d.last.copy(it.position);
      this.updateOverlaps();
      return;
    }
    const dn = this.down;
    if (dn) {
      const dx = e.clientX - dn.x, dy = e.clientY - dn.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) dn.moved = true;
      if (dn.look && dn.moved) {
        this.fig.yaw -= e.movementX * 0.006;
        if (this.mode === 'ego') this.fig.pitch = THREE.MathUtils.clamp(this.fig.pitch - e.movementY * 0.005, -1.2, 1.2);
        else this.fig.camPitch = THREE.MathUtils.clamp(this.fig.camPitch - e.movementY * 0.005, -1.2, 0.3);
      }
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      this.orbit.enabled = this.mode === 'drone';
      if (d.started) this.afterChange();
      return;
    }
    const dn = this.down;
    this.down = null;
    if (dn && !dn.moved && e.target === this.renderer.domElement && !this.gizmo.dragging) this.select(null);
  }

  private onGizmoDragging(on: boolean) {
    this.orbit.enabled = !on && this.mode === 'drone';
    const it = this.selected;
    if (on && it) {
      this.lastValid.pos.copy(it.position);
      this.lastValid.rot = it.rotation.y;
      this.gizmoStack = this.stackOn(it).map((s) => ({ item: s, offset: s.position.clone().sub(it.position) }));
    }
    if (!on) {
      this.gizmoStack = [];
      this.afterChange();
    }
  }

  private onGizmoChange() {
    const it = this.selected;
    if (!it || !this.gizmo.dragging) return;
    const def = it.userData.def;
    if (this.gizmoMode === 'translate' && def.placement === 'floor') {
      const ex = new Set<THREE.Object3D>([it, ...this.gizmoStack.map((s) => s.item)]);
      it.position.y = this.supportY(it.position.x, it.position.z, it.position.y + 0.5, ex);
    }
    if (def.placement === 'wall') {
      const l = it.userData.local, lvl = levelOfY(this.lastValid.pos.y);
      it.position.y = THREE.MathUtils.clamp(it.position.y, lvl * H + 0.15 - l.y0, lvl * H + H - 0.15 - l.y1);
    }
    let ok: boolean;
    if (this.gizmoMode === 'rotate') ok = !this.wallHits(it) || def.placement === 'wall';
    else {
      const target = it.position.clone();
      this.sweep(it, this.lastValid.pos, target);
      if (it.position.distanceToSquared(target) > 0.01) this.hint('Da ist eine Wand im Weg!');
      ok = true;
    }
    if (!ok) {
      it.position.copy(this.lastValid.pos);
      it.rotation.y = this.lastValid.rot;
      this.hint('Da ist eine Wand im Weg!');
    } else {
      this.lastValid.pos.copy(it.position);
      this.lastValid.rot = it.rotation.y;
    }
    // Mitbewegen, was obendrauf steht
    for (const s of this.gizmoStack) {
      const off = s.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      s.item.position.set(it.position.x + off.x, s.item.position.y, it.position.z + off.z);
      s.item.position.y = it.position.y + it.userData.local.y1;
    }
    this.updateOverlaps();
  }

  // ================= Tastatur & Laufen =================
  private onKey(e: KeyboardEvent, down: boolean) {
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    if (!down) return;
    if ((e.code === 'Delete' || e.code === 'Backspace') && this.selected) this.deleteSelected();
    if (e.code === 'KeyR' && this.selected && this.mode === 'drone') this.rotateSelected(90);
    if (e.code === 'Escape') this.select(null);
  }

  setVirtualKey(k: keyof Editor['vkeys'], on: boolean) {
    this.vkeys[k] = on;
  }

  private tick() {
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.mode === 'drone') {
      this.orbit.update();
      this.figure.animate(dt, 0);
    } else this.walk(dt);
    const pulse = 0.45 + 0.35 * Math.sin(performance.now() / 160);
    for (const it of this.items) {
      if (!it.userData.colliding) continue;
      it.userData.model.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.emissive) m.emissiveIntensity = pulse;
      });
    }
    const w = this.renderer.domElement.width;
    if (w > 0) this.renderer.render(this.scene, this.camera);
  }

  private walk(dt: number) {
    const k = this.keys, v = this.vkeys;
    const f = (k.has('KeyW') || k.has('ArrowUp') || v.fwd ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') || v.back ? 1 : 0);
    const t = (k.has('KeyA') || k.has('ArrowLeft') || v.left ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') || v.right ? 1 : 0);
    this.fig.yaw += t * 2.0 * dt;
    const run = k.has('ShiftLeft') || k.has('ShiftRight') ? 1.8 : 1;
    const speed = f * 2.3 * run;
    let moved = 0;
    if (speed !== 0) {
      const dx = Math.sin(this.fig.yaw) * speed * dt, dz = Math.cos(this.fig.yaw) * speed * dt;
      for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
        const ny = this.tryMove(this.fig.x + mx, this.fig.z + mz);
        if (ny !== null) {
          this.fig.x += mx;
          this.fig.z += mz;
          this.fig.y = ny;
          moved = Math.hypot(mx, mz) / dt;
          break;
        }
      }
    }
    this.updateFigure(dt, moved / 2.3);
  }

  private tryMove(x: number, z: number): number | null {
    const h = this.house;
    if (!h) return null;
    const c = h.center;
    if (Math.abs(x - c.x) > 32 || Math.abs(z - c.z) > 32) return null;
    const y = h.groundY(x, z, this.fig.y);
    if (y === null) return null;
    const r: Rect = { cx: x, cz: z, hx: 0.22, hz: 0.22, rot: 0, y0: y + 0.3, y1: y + 1.6 };
    if (h.colliders.some((cc) => overlap(r, cc.rect))) return null;
    for (const it of this.items) {
      if (it.userData.def.flat) continue;
      const ir = this.rectOf(it, 0.03);
      if (ir.y1 < y + 0.35) continue; // kleine Dinge kann man übersteigen
      if (overlap(r, ir)) return null;
    }
    return y;
  }

  private updateFigure(dt: number, speed: number) {
    const f = this.fig;
    this.figure.group.position.set(f.x, f.y, f.z);
    this.figure.group.rotation.y = f.yaw;
    this.figure.animate(dt, speed);
    if (this.mode === 'ego') {
      const eye = new THREE.Vector3(f.x, f.y + 1.5, f.z);
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.clone().add(new THREE.Vector3(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch))));
    } else if (this.mode === 'third') {
      const target = new THREE.Vector3(f.x, f.y + 1.35, f.z);
      const dir = new THREE.Vector3(Math.sin(f.yaw) * Math.cos(f.camPitch), Math.sin(f.camPitch), Math.cos(f.yaw) * Math.cos(f.camPitch));
      let dist = 3.4;
      const fade = new Set<THREE.Mesh>();
      if (this.house) {
        // Böden und Decken holen die Kamera näher heran ...
        this.ray.set(target, dir.clone().negate());
        this.ray.far = dist;
        const slabs = [...this.house.floors, ...this.house.ceilings].filter((o) => this.shown(o));
        const occ = this.ray.intersectObjects(slabs, false)[0];
        if (occ) dist = Math.max(0.6, occ.distance - 0.2);
        // ... Wände und Möbel dazwischen werden durchsichtig
        const cam = target.clone().addScaledVector(dir, -dist);
        const walls = this.house.walls.filter((o) => this.shown(o));
        const furn: THREE.Object3D[] = [];
        for (const it of this.items) if (it.visible) it.userData.model.traverse((o) => (o as THREE.Mesh).isMesh && furn.push(o));
        for (const h of [0.15, 0.8, 1.35, 1.7]) {
          const from = new THREE.Vector3(f.x, f.y + h, f.z);
          const to = cam.clone().sub(from);
          const len = to.length();
          this.ray.set(from, to.normalize());
          this.ray.far = len + 0.3;
          for (const hit of this.ray.intersectObjects([...walls, ...furn], false)) {
            const m = hit.object as THREE.Mesh;
            const it = m.userData.item as Item | undefined;
            if (it) it.userData.model.traverse((o) => (o as THREE.Mesh).isMesh && fade.add(o as THREE.Mesh));
            else fade.add(m);
          }
        }
        this.ray.far = Infinity;
      }
      this.setFaded(fade);
      const want = target.clone().addScaledVector(dir, -dist);
      if (Number.isNaN(this.camPos.x)) this.camPos.copy(want);
      else this.camPos.lerp(want, Math.min(1, dt * 10));
      if (this.camPos.distanceTo(target) > dist + 0.05) this.camPos.copy(want);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(target);
    }
  }

  private faded = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private fadeCache = new Map<THREE.Material, THREE.Material>();
  /** Macht genau die übergebenen Meshes durchsichtig, alle anderen wieder normal */
  private setFaded(set: Set<THREE.Mesh>) {
    for (const [m, orig] of this.faded)
      if (!set.has(m)) {
        m.material = orig;
        this.faded.delete(m);
      }
    const ghost = (mt: THREE.Material) => {
      let g = this.fadeCache.get(mt);
      if (!g) {
        g = mt.clone();
        g.transparent = true;
        g.opacity = 0.18;
        g.depthWrite = false;
        this.fadeCache.set(mt, g);
      }
      const src = mt as THREE.MeshStandardMaterial, dst = g as THREE.MeshStandardMaterial;
      if (dst.map !== src.map) {
        dst.map = src.map;
        dst.needsUpdate = true;
      }
      if (src.emissive) {
        dst.emissive.copy(src.emissive);
        dst.emissiveIntensity = src.emissiveIntensity;
      }
      return g;
    };
    for (const m of set) {
      if (this.faded.has(m)) continue;
      this.faded.set(m, m.material);
      m.material = Array.isArray(m.material) ? m.material.map(ghost) : ghost(m.material);
    }
  }

  private insets = { left: 0, bottom: 0 };
  /** Platz, den Bedienfelder verdecken – das Bild wird entsprechend verschoben */
  setInsets(left: number, bottom: number) {
    if (left === this.insets.left && bottom === this.insets.bottom) return;
    this.insets = { left, bottom };
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, -this.insets.left / 2, this.insets.bottom / 2, w, h);
    this.camera.updateProjectionMatrix();
  }

  // ================= Meldungen =================
  private lastHint = 0;
  private hint(msg: string) {
    const now = performance.now();
    if (now - this.lastHint < 1500) return;
    this.lastHint = now;
    this.toast(msg);
  }
  private toast(msg: string) {
    this.dispatchEvent(new CustomEvent('toast', { detail: msg }));
  }
  private emit(type: string) {
    this.dispatchEvent(new Event(type));
  }

  /** Für Tests/Automatisierung: Weltpunkt → Bildschirm */
  screenOf(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** Für Tests/Automatisierung */
  get stats() {
    return { items: this.items.length, colliding: this.collidingCount, mode: this.mode, covers: Object.keys(this.covers).length, fig: { ...this.fig } };
  }
}

export { ITEMS };
