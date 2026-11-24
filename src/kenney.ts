import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ITEMS, type ItemDef, type Placement } from './catalog';

/**
 * Möbel aus dem „Furniture Kit“ von Kenney (www.kenney.nl), Lizenz CC0 1.0.
 * Die Modelle liegen unter assets-src/kenney/ und werden mit `npm run models` nach public/models/kenney.json gebündelt.
 */
interface KEntry { file: string; name: string; cat: string; placement?: Placement; rot?: number; flat?: boolean; tint?: boolean }

const K: KEntry[] = [
  // Wohnzimmer
  { file: 'loungeSofa', name: 'Lounge-Sofa', cat: 'wohnen' },
  { file: 'loungeSofaLong', name: 'Langes Sofa', cat: 'wohnen' },
  { file: 'loungeSofaCorner', name: 'Ecksofa', cat: 'wohnen' },
  { file: 'loungeSofaOttoman', name: 'Hocker', cat: 'wohnen' },
  { file: 'loungeDesignSofa', name: 'Designsofa', cat: 'wohnen' },
  { file: 'loungeDesignSofaCorner', name: 'Design-Ecksofa', cat: 'wohnen' },
  { file: 'loungeChair', name: 'Loungesessel', cat: 'wohnen' },
  { file: 'loungeChairRelax', name: 'Relaxsessel', cat: 'wohnen' },
  { file: 'loungeDesignChair', name: 'Designsessel', cat: 'wohnen' },
  { file: 'tableCoffee', name: 'Holz-Couchtisch', cat: 'wohnen' },
  { file: 'tableCoffeeGlass', name: 'Glastisch', cat: 'wohnen' },
  { file: 'tableCoffeeSquare', name: 'Eckiger Couchtisch', cat: 'wohnen' },
  { file: 'sideTable', name: 'Beistelltisch', cat: 'wohnen' },
  { file: 'sideTableDrawers', name: 'Beistellschrank', cat: 'wohnen' },
  { file: 'bookcaseOpen', name: 'Offenes Regal', cat: 'wohnen' },
  { file: 'bookcaseOpenLow', name: 'Niedriges Regal', cat: 'wohnen' },
  { file: 'bookcaseClosed', name: 'Bücherschrank', cat: 'wohnen' },
  { file: 'bookcaseClosedWide', name: 'Breiter Schrank', cat: 'wohnen' },
  { file: 'bookcaseClosedDoors', name: 'Vitrine', cat: 'wohnen' },
  { file: 'cabinetTelevision', name: 'TV-Bank', cat: 'wohnen' },
  { file: 'cabinetTelevisionDoors', name: 'TV-Schrank', cat: 'wohnen' },
  { file: 'rugRectangle', name: 'Läufer', cat: 'wohnen', flat: true },
  { file: 'rugRound', name: 'Rundteppich', cat: 'wohnen', flat: true },
  { file: 'rugRounded', name: 'Ovaler Teppich', cat: 'wohnen', flat: true },
  { file: 'rugSquare', name: 'Quadratteppich', cat: 'wohnen', flat: true },
  { file: 'rugDoormat', name: 'Fußmatte', cat: 'wohnen', flat: true },
  { file: 'coatRackStanding', name: 'Garderobe', cat: 'wohnen' },
  { file: 'coatRack', name: 'Wandgarderobe', cat: 'wohnen', placement: 'wall' },
  // Schlafzimmer
  { file: 'bedDouble', name: 'Großes Bett', cat: 'schlafen' },
  { file: 'bedSingle', name: 'Kleines Bett', cat: 'schlafen' },
  { file: 'bedBunk', name: 'Etagenbett', cat: 'schlafen' },
  { file: 'cabinetBed', name: 'Bettschränkchen', cat: 'schlafen' },
  { file: 'cabinetBedDrawer', name: 'Schubladenschrank', cat: 'schlafen' },
  { file: 'cabinetBedDrawerTable', name: 'Nachtkommode', cat: 'schlafen' },
  { file: 'pillow', name: 'Kopfkissen', cat: 'schlafen' },
  { file: 'pillowLong', name: 'Langes Kissen', cat: 'schlafen' },
  { file: 'pillowBlue', name: 'Blaues Kissen', cat: 'schlafen', tint: false },
  // Küche
  { file: 'kitchenCabinet', name: 'Küchenzeile', cat: 'kueche' },
  { file: 'kitchenCabinetDrawer', name: 'Schubladen-Unterschrank', cat: 'kueche' },
  { file: 'kitchenCabinetCornerInner', name: 'Eckschrank', cat: 'kueche' },
  { file: 'kitchenCabinetCornerRound', name: 'Runder Eckschrank', cat: 'kueche' },
  { file: 'kitchenSink', name: 'Küchenspüle', cat: 'kueche' },
  { file: 'kitchenStove', name: 'Gasherd', cat: 'kueche' },
  { file: 'kitchenStoveElectric', name: 'Elektroherd', cat: 'kueche' },
  { file: 'kitchenBar', name: 'Küchentheke', cat: 'kueche' },
  { file: 'kitchenBarEnd', name: 'Theken-Ende', cat: 'kueche' },
  { file: 'kitchenCabinetUpper', name: 'Oberschrank', cat: 'kueche', placement: 'wall' },
  { file: 'kitchenCabinetUpperDouble', name: 'Doppel-Oberschrank', cat: 'kueche', placement: 'wall' },
  { file: 'kitchenCabinetUpperLow', name: 'Flacher Oberschrank', cat: 'kueche', placement: 'wall' },
  { file: 'hoodModern', name: 'Dunstabzug', cat: 'kueche', placement: 'wall' },
  { file: 'kitchenFridge', name: 'Kühlschrank (groß)', cat: 'kueche' },
  { file: 'kitchenFridgeLarge', name: 'Doppel-Kühlschrank', cat: 'kueche' },
  { file: 'kitchenFridgeSmall', name: 'Mini-Kühlschrank', cat: 'kueche' },
  { file: 'table', name: 'Tisch', cat: 'kueche' },
  { file: 'tableCloth', name: 'Tisch mit Decke', cat: 'kueche' },
  { file: 'tableCross', name: 'Holztisch', cat: 'kueche' },
  { file: 'tableCrossCloth', name: 'Holztisch mit Decke', cat: 'kueche' },
  { file: 'tableRound', name: 'Bistrotisch', cat: 'kueche' },
  { file: 'tableGlass', name: 'Glas-Esstisch', cat: 'kueche' },
  { file: 'chairCushion', name: 'Polsterstuhl', cat: 'kueche' },
  { file: 'chairRounded', name: 'Runder Stuhl', cat: 'kueche' },
  { file: 'chairModernCushion', name: 'Moderner Stuhl', cat: 'kueche' },
  { file: 'chairModernFrameCushion', name: 'Schwingstuhl', cat: 'kueche' },
  { file: 'stoolBar', name: 'Barhocker', cat: 'kueche' },
  { file: 'stoolBarSquare', name: 'Eckiger Barhocker', cat: 'kueche' },
  { file: 'bench', name: 'Sitzbank', cat: 'kueche' },
  { file: 'benchCushion', name: 'Polsterbank', cat: 'kueche' },
  // Bad
  { file: 'bathtub', name: 'Wanne', cat: 'bad' },
  { file: 'shower', name: 'Duschkabine', cat: 'bad' },
  { file: 'showerRound', name: 'Runde Dusche', cat: 'bad' },
  { file: 'toilet', name: 'WC', cat: 'bad' },
  { file: 'toiletSquare', name: 'Eckiges WC', cat: 'bad' },
  { file: 'bathroomSink', name: 'Waschtisch', cat: 'bad' },
  { file: 'bathroomSinkSquare', name: 'Eckiger Waschtisch', cat: 'bad' },
  { file: 'bathroomCabinet', name: 'Badschrank', cat: 'bad', placement: 'wall' },
  { file: 'bathroomCabinetDrawer', name: 'Badkommode', cat: 'bad' },
  { file: 'bathroomMirror', name: 'Badspiegel', cat: 'bad', placement: 'wall' },
  { file: 'trashcan', name: 'Mülleimer', cat: 'bad' },
  // Kinderzimmer
  { file: 'bear', name: 'Kuschelbär', cat: 'kinder' },
  { file: 'desk', name: 'Holzschreibtisch', cat: 'kinder' },
  { file: 'deskCorner', name: 'Eckschreibtisch', cat: 'kinder' },
  { file: 'chairDesk', name: 'Bürostuhl', cat: 'kinder' },
  { file: 'chair', name: 'Holzstuhl', cat: 'kinder' },
  { file: 'cardboardBoxClosed', name: 'Umzugskarton', cat: 'kinder', tint: false },
  { file: 'cardboardBoxOpen', name: 'Offener Karton', cat: 'kinder', tint: false },
  { file: 'benchCushionLow', name: 'Kinderbank', cat: 'kinder' },
  // Elektro
  { file: 'televisionModern', name: 'Flachbild-TV', cat: 'elektro' },
  { file: 'televisionVintage', name: 'Röhrenfernseher', cat: 'elektro' },
  { file: 'televisionAntenna', name: 'TV mit Antenne', cat: 'elektro' },
  { file: 'computerScreen', name: 'Bildschirm', cat: 'elektro' },
  { file: 'computerKeyboard', name: 'Tastatur', cat: 'elektro' },
  { file: 'computerMouse', name: 'Maus', cat: 'elektro' },
  { file: 'laptop', name: 'Laptop', cat: 'elektro' },
  { file: 'speaker', name: 'Lautsprecher', cat: 'elektro' },
  { file: 'speakerSmall', name: 'Kleiner Lautsprecher', cat: 'elektro' },
  { file: 'radio', name: 'Kofferradio', cat: 'elektro' },
  { file: 'washer', name: 'Waschautomat', cat: 'elektro' },
  { file: 'dryer', name: 'Trockner', cat: 'elektro' },
  { file: 'washerDryerStacked', name: 'Wasch-Turm', cat: 'elektro' },
  { file: 'kitchenMicrowave', name: 'Mikrowellenherd', cat: 'elektro' },
  { file: 'kitchenCoffeeMachine', name: 'Espressomaschine', cat: 'elektro' },
  { file: 'kitchenBlender', name: 'Mixer', cat: 'elektro' },
  { file: 'toaster', name: 'Toaster', cat: 'elektro' },
  { file: 'lampRoundFloor', name: 'Runde Stehlampe', cat: 'elektro' },
  { file: 'lampSquareFloor', name: 'Eckige Stehlampe', cat: 'elektro' },
  { file: 'lampRoundTable', name: 'Tischlampe', cat: 'elektro' },
  { file: 'lampSquareTable', name: 'Eckige Tischlampe', cat: 'elektro' },
  { file: 'lampSquareCeiling', name: 'Hängelampe', cat: 'elektro', placement: 'ceiling' },
  { file: 'ceilingFan', name: 'Deckenventilator', cat: 'elektro', placement: 'ceiling' },
  { file: 'lampWall', name: 'Wandlampe', cat: 'elektro', placement: 'wall' },
  // Deko
  { file: 'pottedPlant', name: 'Große Pflanze', cat: 'deko', tint: false },
  { file: 'plantSmall1', name: 'Kaktus', cat: 'deko', tint: false },
  { file: 'plantSmall2', name: 'Topfblume', cat: 'deko', tint: false },
  { file: 'plantSmall3', name: 'Kleine Pflanze', cat: 'deko', tint: false },
  { file: 'books', name: 'Bücher', cat: 'deko' },
];

const TINTS = [0xffffff, 0xff8fb8, 0x6cc4ff, 0x7fe0c8, 0xffd23f, 0x9b6ad8, 0xff9f40];
const SCALE = 2.0;
const cache = new Map<string, { root: THREE.Group; main: THREE.Material | null }>();

function prepare(scene: THREE.Group, e: KEntry) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(scene);
  inner.scale.setScalar(SCALE);
  inner.rotation.y = e.rot ?? 0;
  root.add(inner);
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  const placement = e.placement ?? 'floor';
  // Ursprung je nach Platzierung setzen
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  if (placement === 'wall') inner.position.set(-cx, -(b.min.y + b.max.y) / 2, -b.min.z);
  else if (placement === 'ceiling') inner.position.set(-cx, -b.max.y, -cz);
  else inner.position.set(-cx, -b.min.y, -cz);
  // Hauptmaterial = das, das die meisten Dreiecke bedeckt
  const area = new Map<THREE.Material, number>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const n = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
    if (m.geometry.groups.length && Array.isArray(m.material))
      for (const g of m.geometry.groups) area.set(mats[g.materialIndex ?? 0], (area.get(mats[g.materialIndex ?? 0]) ?? 0) + g.count);
    else area.set(mats[0], (area.get(mats[0]) ?? 0) + n);
  });
  let main: THREE.Material | null = null, best = 0;
  for (const [m, n] of area) if (n > best) { best = n; main = m; }
  return { root, main };
}

function makeBuild(e: KEntry) {
  return (c: number) => {
    const src = cache.get(e.file)!;
    const g = src.root.clone(true);
    const map = new Map<THREE.Material, THREE.Material>();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const conv = (mt: THREE.Material) => {
        let n = map.get(mt);
        if (!n) {
          n = mt.clone();
          if (mt === src.main && c !== 0xffffff && e.tint !== false) (n as THREE.MeshStandardMaterial).color.setHex(c);
          map.set(mt, n);
        }
        return n;
      };
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
    });
    return g;
  };
}

/** Lädt alle Kenney-Modelle und hängt sie an den Katalog an */
export async function loadKenney(url = 'models/kenney.json'): Promise<number> {
  const loader = new GLTFLoader();
  const bundle = (await (await fetch(url)).json()) as Record<string, string>;
  const toBuf = (b64: string) => {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  };
  const results = await Promise.allSettled(
    K.filter((e) => bundle[e.file]).map((e) => loader.parseAsync(toBuf(bundle[e.file]), '').then((g) => [e, g] as const)),
  );
  const defs: ItemDef[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const [e, gltf] = r.value;
    cache.set(e.file, prepare(gltf.scene, e));
    defs.push({
      id: 'k-' + e.file,
      name: e.name,
      cat: e.cat,
      placement: e.placement ?? 'floor',
      colors: e.tint === false ? [0xffffff] : TINTS,
      flat: e.flat,
      build: makeBuild(e),
    });
  }
  ITEMS.push(...defs);
  return defs.length;
}
