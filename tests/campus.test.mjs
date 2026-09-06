import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { inside, extruded, rawElevation, createElevation } from '../src/geo.ts';

const data = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
const official = JSON.parse(await readFile(new URL('../public/data/official-places.json', import.meta.url), 'utf8')).items;
const architecture = JSON.parse(await readFile(new URL('../public/data/architectural-evidence.json', import.meta.url), 'utf8')).buildings;
const area = ring => Math.abs(ring.reduce((sum, a, i) => {
  const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1];
}, 0) / 2);

test('all selectable buildings have unique source-backed identifiers and usable geometry', () => {
  assert.equal(data.buildings.length, 18);
  assert.equal(new Set(data.buildings.map(b => b.id)).size, 18);
  assert.equal(new Set(data.buildings.map(b => b.code)).size, 18);
  for (const b of data.buildings) {
    assert.ok(b.ring.length >= 4, b.name);
    assert.ok(area(b.ring) > 45 && area(b.ring) < 18000, b.name + ' footprint');
    assert.ok(b.height > 5 && b.height < 80, b.name + ' height');
    assert.match(b.sourceUrl, /^https:\/\/www\.openstreetmap\.org\/(way|relation)\/\d+$/);
    for (const p of b.ring) assert.ok(p.every(Number.isFinite), b.name);
    assert.ok(b.center[0] > -480 && b.center[0] < 490 && b.center[1] > -410 && b.center[1] < 355);
  }
});

test('published floor counts agree with university or architect records', () => {
  for (const b of data.buildings.filter(b => b.floorsVerified)) {
    if (architecture[b.id]?.facts.aboveGroundFloors) {
      assert.equal(b.floors, architecture[b.id].facts.aboveGroundFloors, b.name);
      assert.equal(b.architecture.sourceUrl, architecture[b.id].sourceUrl);
      continue;
    }
    const place = official.find(p => p.orderNo === (b.id === '3' ? 4 : b.number));
    assert.ok(place, b.name);
    assert.match(place.description, new RegExp(b.floors + '층'), b.name);
  }
  assert.equal(data.buildings.find(b => b.id === '5').floors, 10);
  assert.equal(data.buildings.find(b => b.id === '23').floors, 14);
  assert.equal(data.buildings.find(b => b.id === '11').floors, 3);
});

test('Andrea uses the current narrow-wing plan, with a real circular atrium', () => {
  const b = data.buildings.find(b => b.id === '5'), model = architecture['5'].model;
  assert.equal(b.holes.length, 1);
  const c = Math.cos(data.angle), s = Math.sin(data.angle);
  const local = ring => ring.map(([x, z]) => [(x - b.center[0]) * c - (z - b.center[1]) * s, (x - b.center[0]) * s + (z - b.center[1]) * c]);
  const ring = local(b.ring), hole = local(b.holes[0]);
  assert.equal(ring.length, model.localOutline.length - 1);
  ring.forEach((p, i) => assert.ok(Math.hypot(p[0] - model.localOutline[i][0], p[1] - model.localOutline[i][1]) < .002));
  for (const p of hole) {
    assert.ok(inside(...p, ring), 'atrium is enclosed by the building outline');
    assert.ok(Math.abs(Math.hypot(p[0] - model.headCenter[0], p[1] - model.headCenter[1]) - model.atriumRadius) < .002);
  }
  assert.ok(inside(-7, 14, ring));
  assert.ok(inside(-14, -24, ring), 'narrow wing contains its circulation core');
  assert.ok(!inside(5, -24, ring), 'front pilotis terrace is outside the upper wing, unlike the old D-shaped mass');
  assert.equal(model.wingRoomBase + 7 * model.floorHeight, model.roofHeight);
  assert.equal(model.headRoomBase + 8 * model.floorHeight, model.roofHeight);
  const geometry = extruded(ring, model.roofHeight, [hole]), pos = geometry.attributes.position;
  let roofArea = 0;
  for (let i = 0; i < pos.count; i += 3) {
    const ids = [i, i + 1, i + 2];
    if (ids.every(j => Math.abs(pos.getY(j) - model.roofHeight) < .001)) roofArea += area(ids.map(j => [pos.getX(j), pos.getZ(j)]));
  }
  assert.ok(Math.abs(roofArea - area(ring) + area(hole)) < .1, 'roof triangulation does not cap the atrium');
  geometry.dispose();
});

test('official photo assets and plan are present; no invented photo fallback', async () => {
  for (const b of data.buildings) {
    if (b.photo) {
      await access(new URL('../public' + b.photo, import.meta.url));
      assert.ok(b.photoSource.startsWith('https://www.catholic.ac.kr/'));
    } else {
      assert.equal(b.photoSource, null);
      assert.match(b.sourceNote, /미검증/);
    }
  }
  await access(new URL('../public/reference/campus-plan.png', import.meta.url));
});

test('Dasol courtyard remains an actual opening in the roof geometry', () => {
  const b = data.buildings.find(b => b.id === '9');
  assert.equal(b.holes.length, 1);
  for (const p of b.holes[0]) assert.ok(inside(p[0], p[1], b.ring));
  const geometry = extruded(b.ring, b.height, b.holes), pos = geometry.attributes.position;
  let roofArea = 0;
  for (let i = 0; i < pos.count; i += 3) {
    const ids = [i, i + 1, i + 2];
    if (ids.every(j => Math.abs(pos.getY(j) - b.height) < .001)) {
      roofArea += area(ids.map(j => [pos.getX(j), pos.getZ(j)]));
    }
  }
  assert.ok(Math.abs(roofArea - (area(b.ring) - area(b.holes[0]))) < .1);
  geometry.dispose();
});

test('geographic positions preserve metres, orientation, and the official gate reference', () => {
  const origin = data.origin, gate = data.landmarks.find(p => p.number === 1);
  const source = official.find(p => p.orderNo === 1);
  const longitude = origin.longitude + gate.position[0] / origin.metersPerLongitude;
  const latitude = origin.latitude - gate.position[1] / origin.metersPerLatitude;
  assert.ok(Math.abs(longitude - source.longitude) < 1e-7);
  assert.ok(Math.abs(latitude - source.latitude) < 1e-7);
  const library = data.buildings.find(b => b.id === '15');
  const kim = data.buildings.find(b => b.id === '3');
  assert.ok(library.center[0] < kim.center[0] && library.center[1] < kim.center[1], 'library is northwest of Kim Hall');
});

test('terrain stays finite at borders and building pads meet the model bases', () => {
  assert.equal(data.terrain.values.length, data.terrain.resolution ** 2);
  assert.ok(data.terrain.values.every(v => Number.isFinite(v) && v > 0 && v < 180));
  const elevation = createElevation(data), e = data.terrain.extent;
  for (const x of [e[0] - 10, e[0], 0, e[2], e[2] + 10]) {
    for (const z of [e[1] - 10, e[1], 0, e[3], e[3] + 10]) assert.ok(Number.isFinite(rawElevation(data, x, z)));
  }
  for (const b of data.buildings) {
    const p = b.ring[0], point = [p[0] * .99 + b.center[0] * .01, p[1] * .99 + b.center[1] * .01];
    if (inside(...point, b.ring)) assert.ok(Math.abs(elevation(...point) - b.baseElevation) < .001, b.name);
  }
});

test('the chapel court stays level beside both side rooms', () => {
  const b = data.buildings.find(b => b.id === '22'), elevation = createElevation(data);
  const c = Math.cos(data.angle), s = Math.sin(data.angle);
  for (const u of [-18, 18]) for (const v of [-6, 6]) {
    const x = b.center[0] + u * c + v * s, z = b.center[1] - u * s + v * c;
    assert.ok(!inside(x, z, b.ring), 'this point is in the court beyond the church footprint');
    assert.ok(Math.abs(elevation(x, z) - b.baseElevation) < .001, 'court terrain must not bury the side rooms');
  }
});
