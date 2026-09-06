import * as THREE from 'three';
import type { CampusData, Point } from './types';

export function inside(x: number, z: number, ring: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
export function segmentDistance(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export function ringDistance(x: number, z: number, ring: Point[]) {
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) d = Math.min(d, segmentDistance(x, z, ring[i], ring[(i + 1) % ring.length]));
  return d;
}
export function bounds(ring: Point[]) {
  return {
    minX: Math.min(...ring.map(p => p[0])), maxX: Math.max(...ring.map(p => p[0])),
    minZ: Math.min(...ring.map(p => p[1])), maxZ: Math.max(...ring.map(p => p[1])),
  };
}
export function center(ring: Point[]): Point {
  return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
}
export function localRing(ring: Point[], origin: Point, angle: number): Point[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return ring.map(p => {
    const x = p[0] - origin[0], z = p[1] - origin[1];
    return [x * c - z * s, x * s + z * c];
  });
}
export function rectangle(x: number, z: number, w: number, d: number): Point[] {
  return [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]];
}
export function circular(x: number, z: number, r: number, n = 32): Point[] {
  return Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * Math.PI * 2) * r, z + Math.sin(i / n * Math.PI * 2) * r]);
}
export function samplePerimeter(ring: Point[], count: number): Point[] {
  const lengths = ring.map((p, i) => Math.hypot(p[0] - ring[(i + 1) % ring.length][0], p[1] - ring[(i + 1) % ring.length][1]));
  const total = lengths.reduce((sum, n) => sum + n, 0);
  let edge = 0, start = 0;
  return Array.from({ length: count }, (_, i) => {
    const distance = i / count * total;
    while (edge < lengths.length - 1 && distance > start + lengths[edge]) start += lengths[edge++];
    const a = ring[edge], b = ring[(edge + 1) % ring.length], t = (distance - start) / (lengths[edge] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  });
}
export function makeShape(ring: Point[], holes: Point[][] = []) {
  const shape = new THREE.Shape(ring.map(p => new THREE.Vector2(p[0], -p[1])));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(p[0], -p[1]))));
  return shape;
}
export function extruded(ring: Point[], height: number, holes: Point[][] = []) {
  const geometry = new THREE.ExtrudeGeometry(makeShape(ring, holes), { depth: height, bevelEnabled: false, curveSegments: 24, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
export function seededRandom(seed: number) {
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function rawElevation(data: CampusData, x: number, z: number) {
  const { extent: e, resolution: n, values, datum } = data.terrain;
  const u = THREE.MathUtils.clamp((x - e[0]) / (e[2] - e[0]) * (n - 1), 0, n - 1.001);
  const v = THREE.MathUtils.clamp((z - e[1]) / (e[3] - e[1]) * (n - 1), 0, n - 1.001);
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  return (values[j * n + i] * (1 - a) + values[j * n + i + 1] * a) * (1 - b)
    + (values[(j + 1) * n + i] * (1 - a) + values[(j + 1) * n + i + 1] * a) * b - datum;
}
export function createElevation(data: CampusData) {
  // Flatten built pads and sport fields; the regional DEM cannot resolve them.
  const pads = data.buildings.map(b => ({ ring: b.siteRing || b.ring, y: b.baseElevation, box: bounds(b.siteRing || b.ring) }));
  for (const b of data.buildings) if (b.annex) pads.push({ ring: b.annex, y: b.baseElevation, box: bounds(b.annex) });
  for (const g of data.grounds) { const c = center(g.ring); pads.push({ ring: g.ring, y: rawElevation(data, ...c), box: bounds(g.ring) }); }
  return (x: number, z: number) => {
    const original = rawElevation(data, x, z);
    let result = original, weight = 0;
    for (const p of pads) {
      if (x < p.box.minX - 7 || x > p.box.maxX + 7 || z < p.box.minZ - 7 || z > p.box.maxZ + 7) continue;
      if (inside(x, z, p.ring)) return p.y;
      const d = ringDistance(x, z, p.ring);
      if (d < 7) { const w = 1 - THREE.MathUtils.smoothstep(d, 0, 7); if (w > weight) { result = THREE.MathUtils.lerp(original, p.y, w); weight = w; } }
    }
    return result;
  };
}
