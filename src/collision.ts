/** Gedrehtes Rechteck in der XZ-Ebene mit Höhenbereich */
export interface Rect {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  rot: number;
  y0: number;
  y1: number;
}

/**
 * Separating-Axis-Test zweier gedrehter Rechtecke.
 * Liefert den minimalen Verschiebungsvektor, der `a` aus `b` herausschiebt, oder null.
 */
export function overlap(a: Rect, b: Rect): { x: number; z: number } | null {
  if (a.y0 >= b.y1 || b.y0 >= a.y1) return null;
  const axes: [number, number][] = [];
  for (const r of [a, b]) {
    const c = Math.cos(r.rot), s = Math.sin(r.rot);
    axes.push([c, -s], [s, c]);
  }
  const dx = b.cx - a.cx, dz = b.cz - a.cz;
  let best = Infinity, bx = 0, bz = 0;
  for (const [nx, nz] of axes) {
    const ra = radius(a, nx, nz), rb = radius(b, nx, nz);
    const d = dx * nx + dz * nz;
    const o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (o < best) {
      best = o;
      const sg = d > 0 ? -1 : 1;
      bx = nx * o * sg;
      bz = nz * o * sg;
    }
  }
  return { x: bx, z: bz };
}

function radius(r: Rect, nx: number, nz: number) {
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  return r.hx * Math.abs(c * nx - s * nz) + r.hz * Math.abs(s * nx + c * nz);
}

export function pointInRect(r: Rect, x: number, z: number) {
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  const dx = x - r.cx, dz = z - r.cz;
  const lx = dx * c - dz * s; // Projektion auf lokale x-Achse (c,-s)
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= r.hx && Math.abs(lz) <= r.hz;
}
