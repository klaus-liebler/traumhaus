export interface RoomDef { id: string; name: string; level: number; x: number; z: number; w: number; d: number }
export interface OpeningDef { type: 'door' | 'window'; level: number; x: number; z: number; w?: number }
/** Treppe: Rechteck auf `level`, steigt in Richtung `dir` an und endet auf level+1 */
export interface StairDef { level: number; x: number; z: number; w: number; d: number; dir: 'x+' | 'x-' | 'z+' | 'z-' }

export interface HouseDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  roof: 'gable' | 'flat' | 'castle';
  facade?: 'stone';
  towers?: { x: number; z: number; r: number; h: number }[];
  oriels?: { level: number; x: number; z: number; side: 'x-' | 'x+' | 'z-' | 'z+' }[];
  gate?: { x: number; z: number; w: number };
  towerRoofColor?: number;
  wallColor: number;
  roofColor: number;
  rooms: RoomDef[];
  openings: OpeningDef[];
  stairs?: StairDef[];
  spawn: { x: number; z: number; yaw: number };
}

const R = (id: string, name: string, level: number, x: number, z: number, w: number, d: number): RoomDef => ({ id, name, level, x, z, w, d });
const door = (level: number, x: number, z: number, w = 0.9): OpeningDef => ({ type: 'door', level, x, z, w });
const win = (level: number, x: number, z: number, w = 1.2): OpeningDef => ({ type: 'window', level, x, z, w });

export const HOUSES: HouseDef[] = [
  {
    id: 'sonnenhaus',
    name: 'Sonnenhaus',
    description: 'Gemütliches Einfamilienhaus mit sechs Räumen auf einer Etage.',
    emoji: '🌞',
    roof: 'gable',
    wallColor: 0xfff0cf,
    roofColor: 0xd9534f,
    rooms: [
      R('wohnen', 'Wohnzimmer', 0, 0, 3, 4, 5),
      R('schlafen', 'Schlafzimmer', 0, 0, 0, 4, 3),
      R('flur', 'Flur', 0, 4, 2, 2, 6),
      R('bad', 'Bad', 0, 4, 0, 2, 2),
      R('kueche', 'Küche', 0, 6, 4, 5, 4),
      R('kinder', 'Kinderzimmer', 0, 6, 0, 5, 4),
    ],
    openings: [
      door(0, 5, 8, 1.0), door(0, 4, 5.5), door(0, 4, 2.5, 0.8), door(0, 5, 2, 0.8), door(0, 6, 6), door(0, 6, 3),
      win(0, 2, 8, 1.6), win(0, 0, 5.5), win(0, 0, 1.5), win(0, 2, 0), win(0, 5, 0, 0.7),
      win(0, 8.5, 8, 1.6), win(0, 11, 6), win(0, 8.5, 0, 1.6), win(0, 11, 2),
    ],
    spawn: { x: 5, z: 10.5, yaw: Math.PI },
  },
  {
    id: 'villa',
    name: 'Villa Sternschnuppe',
    description: 'Großes Haus mit zwei Etagen, Treppe und vielen Kinderzimmern.',
    emoji: '⭐',
    roof: 'gable',
    wallColor: 0xdff0ff,
    roofColor: 0x4a6fa5,
    rooms: [
      R('flur', 'Flur', 0, 4, 0, 3, 8),
      R('wohnen', 'Wohnzimmer', 0, 0, 3, 4, 5),
      R('kueche', 'Küche', 0, 0, 0, 4, 3),
      R('essen', 'Esszimmer', 0, 7, 3, 5, 5),
      R('wc', 'Gäste-WC', 0, 7, 0, 2, 3),
      R('wasch', 'Waschküche', 0, 9, 0, 3, 3),
      R('flur1', 'Flur oben', 1, 4, 0, 3, 8),
      R('eltern', 'Elternzimmer', 1, 0, 3, 4, 5),
      R('bad1', 'Badezimmer', 1, 0, 0, 4, 3),
      R('kind1', 'Kinderzimmer', 1, 7, 3, 5, 5),
      R('spiel', 'Spielzimmer', 1, 7, 0, 5, 3),
    ],
    openings: [
      door(0, 5.2, 8, 1.0), door(0, 4, 6), door(0, 4, 1.5), door(0, 7, 6.5), door(0, 7, 0.5, 0.8), door(0, 10.5, 3), door(0, 2, 3),
      win(0, 2, 8, 1.6), win(0, 0, 5.5), win(0, 2, 0), win(0, 0, 1.5), win(0, 9.5, 8, 1.6), win(0, 12, 5.5), win(0, 8, 0, 0.6), win(0, 10.5, 0),
      door(1, 4, 6), door(1, 4, 1.5), door(1, 7, 6.5), door(1, 7, 0.5, 0.8),
      win(1, 2, 8, 1.6), win(1, 0, 5.5), win(1, 2, 0), win(1, 9.5, 8, 1.6), win(1, 12, 5.5), win(1, 9.5, 0), win(1, 12, 1.5), win(1, 5.5, 8),
    ],
    stairs: [{ level: 0, x: 6, z: 1, w: 1, d: 4, dir: 'z-' }],
    spawn: { x: 5.2, z: 10.5, yaw: Math.PI },
  },
  {
    id: 'strandhaus',
    name: 'Strandhaus Muschel',
    description: 'Flacher Bungalow in L-Form mit großer Wohnküche und Terrassentür.',
    emoji: '🐚',
    roof: 'flat',
    wallColor: 0xffffff,
    roofColor: 0x7fc8c8,
    rooms: [
      R('wohnkueche', 'Wohnküche', 0, 0, 0, 6, 5),
      R('schlafen', 'Schlafzimmer', 0, 6, 0, 4, 3),
      R('bad', 'Bad', 0, 6, 3, 4, 2),
      R('flur', 'Flur', 0, 0, 5, 4, 2),
      R('kinder', 'Kinderzimmer', 0, 0, 7, 4, 4),
    ],
    openings: [
      door(0, 4, 6, 1.0), door(0, 2, 5), door(0, 2, 7), door(0, 6, 1.5), door(0, 6, 4, 0.8), door(0, 5, 5, 1.2),
      win(0, 1.5, 0), win(0, 4.5, 0), win(0, 0, 2.5, 1.6), win(0, 8, 0, 1.6), win(0, 10, 1.5), win(0, 10, 4, 0.8),
      win(0, 0, 9), win(0, 2, 11, 1.6), win(0, 4, 9),
    ],
    spawn: { x: 6.5, z: 6.5, yaw: -Math.PI / 2 },
  },
  {
    id: 'schloss',
    name: 'Märchenschloss',
    description: 'Schloss mit vier Türmchen, Zinnen, Erkern, Thronsaal und Prinzessinnenzimmer.',
    emoji: '🏰',
    roof: 'castle',
    facade: 'stone',
    wallColor: 0xf6e3ee,
    roofColor: 0xd9cfe0,
    towerRoofColor: 0xe0609c,
    rooms: [
      R('halle', 'Thronsaal', 0, 4, 3, 6, 7),
      R('galerie', 'Galerie', 0, 4, 0, 6, 3),
      R('kueche', 'Schlossküche', 0, 0, 0, 4, 5),
      R('speise', 'Speisesaal', 0, 0, 5, 4, 5),
      R('bibliothek', 'Bibliothek', 0, 10, 0, 4, 5),
      R('musik', 'Musikzimmer', 0, 10, 5, 4, 5),
      R('galerie1', 'Galerie oben', 1, 4, 0, 6, 3),
      R('prinz', 'Prinzessinnenzimmer', 1, 4, 3, 6, 7),
      R('ankleide', 'Ankleidezimmer', 1, 0, 5, 4, 5),
      R('bad1', 'Königliches Bad', 1, 0, 0, 4, 5),
      R('gast', 'Gästezimmer', 1, 10, 0, 4, 5),
      R('spiel', 'Spielzimmer', 1, 10, 5, 4, 5),
    ],
    openings: [
      door(0, 7, 10, 1.6), door(0, 6.5, 3, 1.2), door(0, 4, 7.5), door(0, 2, 5), door(0, 4, 1.5), door(0, 10, 7.5), door(0, 10, 1.5), door(0, 12, 5),
      win(0, 2, 0), win(0, 0, 2.5), win(0, 0, 7.5), win(0, 2, 10), win(0, 12, 0), win(0, 14, 2.5), win(0, 14, 7.5), win(0, 12, 10),
      win(0, 5, 10, 1.0), win(0, 9, 10, 1.0),
      door(1, 6.5, 3, 1.2), door(1, 4, 7.5), door(1, 2, 5), door(1, 4, 1.5), door(1, 10, 1.5), door(1, 10, 7.5), door(1, 12, 5),
      win(1, 2, 0), win(1, 0, 7.5), win(1, 2, 10), win(1, 12, 0), win(1, 14, 7.5), win(1, 12, 10),
      win(1, 5.5, 10), win(1, 8.5, 10),
    ],
    stairs: [{ level: 0, x: 5, z: 1, w: 4, d: 1, dir: 'x+' }],
    towers: [
      { x: -0.9, z: -0.9, r: 1.25, h: 7.6 },
      { x: 14.9, z: -0.9, r: 1.25, h: 7.6 },
      { x: -0.9, z: 10.9, r: 1.25, h: 7.6 },
      { x: 14.9, z: 10.9, r: 1.25, h: 7.6 },
      { x: 7, z: -1.2, r: 1.0, h: 9.2 },
    ],
    oriels: [
      { level: 1, x: 0, z: 2.5, side: 'x-' },
      { level: 1, x: 14, z: 2.5, side: 'x+' },
    ],
    gate: { x: 7, z: 10, w: 1.6 },
    spawn: { x: 7, z: 13, yaw: Math.PI },
  },
];
