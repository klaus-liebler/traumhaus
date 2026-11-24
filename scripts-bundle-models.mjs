// Packt alle Kenney-GLB-Modelle in eine JSON-Datei (Base64), damit sie als eine Datei ausgeliefert werden
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
const src = 'assets-src/kenney';
const out = {};
for (const f of readdirSync(src)) if (f.endsWith('.glb')) out[f.replace('.glb', '')] = readFileSync(`${src}/${f}`).toString('base64');
mkdirSync('public/models', { recursive: true });
writeFileSync('public/models/kenney.json', JSON.stringify(out));
copyFileSync(`${src}/LICENSE-Kenney-Furniture-Kit.txt`, 'public/models/LICENSE-Kenney-Furniture-Kit.txt');
console.log(Object.keys(out).length, 'Kenney-Modelle gebündelt');
// Schaukel & Wal-Rutsche (LaWouattebete, Cults3D, CC BY) als STL
const cs = 'assets-src/cults-schaukel';
const cults = {};
for (const f of readdirSync(cs)) if (f.endsWith('.stl')) cults[f.replace('.stl', '')] = readFileSync(`${cs}/${f}`).toString('base64');
writeFileSync('public/models/cults.json', JSON.stringify(cults));
copyFileSync(`${cs}/LICENSE.txt`, 'public/models/LICENSE-Schaukel-Rutsche.txt');
console.log(Object.keys(cults).length, 'Cults3D-Teile gebündelt');
