import * as THREE from 'three';
import type { Building, CampusData, Point } from './types';
import { bounds, circular, extruded, localRing, rectangle, samplePerimeter, seededRandom } from './geo';

type Batch = { material: THREE.Material; matrices: THREE.Matrix4[] };
const cube = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();

function brickTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!, rng = seededRandom(718);
  c.fillStyle = '#d6d4cf'; c.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) {
    const shade = Math.round(233 + rng() * 22);
    c.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
    c.fillRect(col * 32 + row % 2 * 16 + 1, row * 16 + 1, 30, 14);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(.65, .65);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
function masonryUV(material: THREE.MeshStandardMaterial) {
  // Metre-scaled masonry also on instanced piers; box scaling must not stretch bricks.
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vMasonryPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 masonryPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        masonryPosition = instanceMatrix * masonryPosition;
      #endif
      vMasonryPosition = masonryPosition.xyz;
      #include <project_vertex>`);
    shader.fragmentShader = 'varying vec3 vMasonryPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 masonryNormal = abs(normalize(cross(dFdx(vMasonryPosition), dFdy(vMasonryPosition))));
      vec2 masonryUV = masonryNormal.y > .7 ? vMasonryPosition.xz :
        masonryNormal.x > masonryNormal.z ? vMasonryPosition.zy : vMasonryPosition.xy;
      diffuseColor *= texture2D(map, masonryUV * vec2(.58, .94));`);
  };
  material.customProgramCacheKey = () => 'metre-masonry-v1';
}
const materials = {
  stone: new THREE.MeshStandardMaterial({ color: '#dad5c8', roughness: .8 }),
  white: new THREE.MeshStandardMaterial({ color: '#e4e3d9', roughness: .72 }),
  roof: new THREE.MeshStandardMaterial({ color: '#c7cac2', roughness: .86 }),
  greenRoof: new THREE.MeshStandardMaterial({ color: '#64756a', metalness: .2, roughness: .6 }),
  darkRoof: new THREE.MeshStandardMaterial({ color: '#687573', roughness: .78 }),
  glass: new THREE.MeshStandardMaterial({ color: '#4d737b', metalness: .4, roughness: .27 }),
  darkGlass: new THREE.MeshStandardMaterial({ color: '#293d41', metalness: .35, roughness: .32 }),
  blueGlass: new THREE.MeshStandardMaterial({ color: '#377a91', metalness: .45, roughness: .24 }),
  steel: new THREE.MeshStandardMaterial({ color: '#909e9d', metalness: .6, roughness: .43 }),
  dark: new THREE.MeshStandardMaterial({ color: '#303b3b', roughness: .7 }),
  wood: new THREE.MeshStandardMaterial({ color: '#79513b', roughness: .85 }),
  blue: new THREE.MeshStandardMaterial({ color: '#164b8e', roughness: .62 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#c5c3bb', roughness: .92 }),
  recess: new THREE.MeshStandardMaterial({ color: '#b5a28b', roughness: .85 }),
};

class Model {
  readonly group = new THREE.Group();
  batches = new Map<string, Batch>();
  rng: () => number;
  wall: THREE.MeshStandardMaterial;
  constructor(public building: Building, texture: THREE.Texture) {
    this.group.name = building.name; this.group.userData.buildingId = building.id;
    this.rng = seededRandom(building.osmId);
    this.wall = new THREE.MeshStandardMaterial({ color: building.color, roughness: .87, map: texture });
    masonryUV(this.wall);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, rotation = 0) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.rotation.set(0, rotation, 0); dummy.updateMatrix();
    let batch = this.batches.get(material.uuid);
    if (!batch) { batch = { material, matrices: [] }; this.batches.set(material.uuid, batch); }
    batch.matrices.push(dummy.matrix.clone());
  }
  prism(ring: Point[], y: number, h: number, material: THREE.Material, holes: Point[][] = []) {
    const mesh = new THREE.Mesh(extruded(ring, h, holes), material);
    mesh.position.y = y; mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh); return mesh;
  }
  roof(ring: Point[], y: number, holes: Point[][] = [], material = materials.roof) {
    this.prism(ring, y, .42, material, holes);
    this.edge(ring, y + .28, .42, .42, materials.stone);
    for (const hole of holes) this.edge(hole, y + .28, .4, .45, materials.stone);
  }
  edge(ring: Point[], y: number, w: number, h: number, material: THREE.Material) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1];
      this.box((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.hypot(dx, dz), h, w, material, -Math.atan2(dz, dx));
    }
  }
  facade(ring: Point[], y: number, h: number, floors: number, options: { spacing?: number; width?: number; wh?: number; frame?: THREE.Material; glass?: THREE.Material; band?: boolean; blue?: boolean; transoms?: number } = {}) {
    let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sign = area >= 0 ? 1 : -1;
    const spacing = options.spacing || 3.2, width = options.width || 1.75, wh = options.wh || 1.85;
    const floorHeight = h / floors;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1.1) continue;
      const nx = sign * (b[1] - a[1]) / length, nz = -sign * (b[0] - a[0]) / length, angle = Math.atan2(nx, nz);
      const count = Math.max(1, Math.floor((length - 1.1) / spacing));
      const ww = Math.min(width, (length - (length < 3 ? .25 : 1.2)) / count - .15);
      for (let row = 0; row < floors; row++) for (let col = 0; col < count; col++) {
        const t = (col + .5) / count, x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[1], b[1], t);
        const yy = y + floorHeight * (row + .52);
        this.box(x + nx * .075, yy, z + nz * .075, ww + .18, wh + .18, .16, options.frame || materials.stone, angle);
        const glass = options.glass || (options.blue ? materials.blueGlass : this.rng() < .2 ? materials.darkGlass : materials.glass);
        this.box(x + nx * .172, yy, z + nz * .172, ww, wh, .055, glass, angle);
        this.box(x + nx * .21, yy, z + nz * .21, .055, wh, .065, materials.steel, angle);
        for (let part = 1; part <= (options.transoms || 0); part++) this.box(x + nx * .21, yy - wh / 2 + wh * part / ((options.transoms || 0) + 1), z + nz * .21, ww, .055, .065, materials.steel, angle);
        if (ww > 2) this.box(x + nx * .21, yy - wh * .23, z + nz * .21, ww, .055, .065, materials.steel, angle);
      }
    }
    if (options.band) for (let i = 1; i <= floors; i++) this.edge(ring, y + i * floorHeight - .15, .46, .48, materials.white);
  }
  block(ring: Point[], y: number, h: number, floors: number, options: Parameters<Model['facade']>[4] = {}, holes: Point[][] = []) {
    this.prism(ring, y, h, this.wall, holes); this.facade(ring, y, h, floors, options); this.roof(ring, y + h, holes);
    for (const hole of holes) this.facade([...hole].reverse(), y, h, floors, options);
  }
  curtain(x: number, y: number, z: number, w: number, h: number, angle = 0, glass = materials.glass) {
    this.box(x, y, z, w, h, .22, glass, angle);
    const n = Math.ceil(w / 2.6);
    for (let i = 0; i <= n; i++) {
      const u = -w / 2 + w * i / n;
      this.box(x + u * Math.cos(angle), y, z - u * Math.sin(angle), .095, h + .1, .3, materials.steel, angle);
    }
    const rows = Math.ceil(h / 2.8);
    for (let i = 0; i <= rows; i++) this.box(x, y - h / 2 + i / rows * h, z, w, .09, .3, materials.steel, angle);
  }
  beam(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, material: THREE.Material) {
    dummy.position.copy(a).add(b).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    dummy.scale.set(w, a.distanceTo(b), d); dummy.updateMatrix();
    let batch = this.batches.get(material.uuid);
    if (!batch) { batch = { material, matrices: [] }; this.batches.set(material.uuid, batch); }
    batch.matrices.push(dummy.matrix.clone());
  }
  sign(text: string, x: number, y: number, z: number, w: number, h: number, angle = 0, color = '#f1f0e8') {
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.font = '600 84px sans-serif'; canvas.width = Math.ceil(c.measureText(text).width + 18);
    c.font = '600 84px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color;
    c.fillText(text, canvas.width / 2, 68);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: .15, roughness: .6, depthWrite: false }));
    mesh.position.set(x, y, z); mesh.rotation.y = angle; this.group.add(mesh);
  }
  slopedRoof(outer: Point[], inner: Point[], bottom: number, top: number, material: THREE.Material) {
    const vertices: number[] = [];
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length, a = outer[i], b = outer[j], c = inner[i], d = inner[j];
      vertices.push(a[0], bottom, a[1], c[0], top, c[1], b[0], bottom, b[1], b[0], bottom, b[1], c[0], top, c[1], d[0], top, d[1]);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
    this.prism(inner, top - .12, .12, material);
  }
  // A real opening with a deep sill and glazing behind the outer masonry plane.
  windowBay(a: Point, b: Point, y: number, floorHeight: number, ww: number, wh: number, material = this.wall) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const nx = dz / length, nz = -dx / length, angle = -Math.atan2(dz, dx);
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    const windowWidth = Math.min(ww, length - .48), sill = (floorHeight - wh) * .46;
    this.box(x, y + sill / 2, z, length + .07, sill, .44, material, angle);
    this.box(x, y + sill + wh + (floorHeight - sill - wh) / 2, z, length + .07, floorHeight - sill - wh, .44, material, angle);
    const side = (length - windowWidth) / 2;
    for (const sign of [-1, 1]) {
      const shift = sign * (windowWidth + side) / 2;
      this.box(x + shift * dx / length, y + sill + wh / 2, z + shift * dz / length, side + .05, wh, .44, material, angle);
    }
    this.box(x - nx * .67, y + sill + wh / 2, z - nz * .67, windowWidth, wh, .1, materials.darkGlass, angle);
    this.box(x - nx * .3, y + sill + .06, z - nz * .3, windowWidth, .12, .9, materials.recess, angle);
    for (const sign of [-1, 1]) {
      const shift = sign * (windowWidth / 2 - .04);
      this.box(x + shift * dx / length - nx * .3, y + sill + wh / 2, z + shift * dz / length - nz * .3, .08, wh, .85, materials.recess, angle);
    }
    this.box(x - nx * .59, y + sill + wh / 2, z - nz * .59, .065, wh, .1, materials.dark, angle);
    if (windowWidth > 1.8) this.box(x - nx * .53 + dx / length * windowWidth * .21, y + sill + wh * .27, z - nz * .53 + dz / length * windowWidth * .21, windowWidth * .42, wh * .46, .08, materials.recess, angle);
  }
  finish() {
    for (const batch of this.batches.values()) {
      const instanced = new THREE.InstancedMesh(cube, batch.material, batch.matrices.length);
      batch.matrices.forEach((m, i) => instanced.setMatrixAt(i, m));
      instanced.castShadow = instanced.receiveShadow = true; instanced.computeBoundingSphere(); this.group.add(instanced);
    }
    return this.group;
  }
}

export function createBuildings(data: CampusData) {
  const root = new THREE.Group(), groups = new Map<string, THREE.Group>(), texture = brickTexture();
  const panelCanvas = document.createElement('canvas'); panelCanvas.width = panelCanvas.height = 256;
  const panelContext = panelCanvas.getContext('2d')!;
  panelContext.fillStyle = '#f0efec'; panelContext.fillRect(0, 0, 256, 256);
  panelContext.strokeStyle = '#c6c6c0'; panelContext.lineWidth = 1.2;
  for (let y = 0; y < 256; y += 128) for (let x = 0; x < 256; x += 128) panelContext.strokeRect(x, y, 128, 128);
  const panelMap = new THREE.CanvasTexture(panelCanvas); panelMap.wrapS = panelMap.wrapT = THREE.RepeatWrapping; panelMap.colorSpace = THREE.SRGBColorSpace; panelMap.anisotropy = 8;
  materials.stone.map = panelMap; masonryUV(materials.stone);
  for (const b of data.buildings) {
    const m = new Model(b, texture), ring = localRing(b.ring, b.center, data.angle);
    const holes = b.holes.map(h => localRing(h, b.center, data.angle));
    const box = bounds(ring), w = box.maxX - box.minX, d = box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    if (b.kind === 'kim') {
      const courtyards = [rectangle(-6, -4, 16, 17), rectangle(-7, 15, 13, 11)];
      m.block(ring, 0, 11.8, 3, { spacing: 3.2, width: 2.3, band: true }, courtyards);
      // The tower's narrow end faces the gate (Junglim project description).
      // Its long axis runs east–west in the campus building grid.
      const tower = rectangle(-11, -23, 58, 30);
      const terracotta = new THREE.MeshStandardMaterial({ color: '#bd704b', roughness: .75 });
      m.prism(tower, 11.8, 41.8, terracotta);
      for (let floor = 0; floor < 11; floor++) {
        const y = 13.8 + floor * 3.65;
        for (const u of [-40.12, 18.12]) m.curtain(u, y, -23, 26.5, 1.65, Math.PI / 2, materials.glass);
        for (const v of [-38.12, -7.88]) m.curtain(-11, y, v, 53, 1.65);
        for (const u of [-40.26, 18.26]) m.box(u, y - .28, -23, .09, .065, 26.5, materials.stone);
        for (const v of [-38.26, -7.74]) m.box(-11, y - .28, v, 53, .065, .09, materials.stone);
        m.edge(tower, y + 1.45, .14, .075, materials.steel);
      }
      m.roof(tower, 53.6);
      m.block(rectangle(-31, 9, 19, 48), 11.8, 22.6, 6, { spacing: 3.8, width: 2.6, band: true });
      m.block(rectangle(-6, 24, 35, 13), 11.8, 22.6, 6, { spacing: 3.8, width: 2.6, band: true });
      // The east edge is a terrace over the podium, visible below the tower in the official photo.
      for (let v = -28; v <= 32; v += 6) {
        m.box(29, 13.35, v, .42, 3.1, .42, materials.stone);
        m.box(24, 14.95, v, 11, .25, .42, materials.steel);
      }
      m.box(29, 14.95, 2, .48, .42, 61, materials.steel);
      m.box(29, 12.35, 2, .15, 1.0, 61, materials.glass);
      // Recessed balconies, horizontal slab edges and fine metal balustrades.
      for (let floor = 0; floor < 6; floor++) {
        const y = 12.1 + floor * (22.6 / 6);
        for (let v = -7; v < 30; v += 5.2) {
          m.box(-20.9, y, v, 2.2, .2, 4.8, materials.stone);
          m.box(-19.9, y + .7, v, .07, 1.1, 4.8, materials.steel);
          for (let off = -2; off < 2.2; off += .45) m.box(-19.84, y + .7, v + off, .06, 1.1, .045, materials.steel);
        }
      }
      m.curtain(18.5, 28.7, -35.8, 6.6, 57.4, Math.PI / 2, materials.blueGlass);
      m.curtain(14.7, 28.7, -39.2, 7.5, 57.4, 0, materials.blueGlass);
      m.box(18.5, 41, -12.4, 2.1, 7.2, 7.5, materials.blueGlass);
      m.curtain(19.6, 41, -12.4, 7.5, 7.2, Math.PI / 2, materials.blueGlass);
      m.sign('가톨릭대학교', 18.31, 52.55, -23.1, 17.5, 1.35, Math.PI / 2);
      m.sign('THE CATHOLIC UNIVERSITY OF KOREA', 18.3, 51.5, -23.1, 17.5, .6, Math.PI / 2);
      const topStorey = rectangle(-14, -23, 47, 25);
      m.prism(topStorey, 53.6, 3.6, terracotta);
      m.curtain(-14, 55.6, -35.65, 44, 2.7, 0, materials.blueGlass);
      m.roof(topStorey, 57.2);
      for (let u = -39; u <= 10; u += 7) {
        m.box(u, 55.65, -37.6, .42, 4.1, .42, materials.steel);
        m.box(u, 55.65, -8.4, .42, 4.1, .42, materials.steel);
        m.box(u, 57.7, -23, .42, .35, 32, materials.steel);
      }
      m.box(17.8, 54.0, -23, 3.8, .35, 34, materials.steel);
      if (b.annex) {
        const annex = localRing(b.annex, b.center, data.angle), a = bounds(annex);
        const acx = (a.minX + a.maxX) / 2, acz = (a.minZ + a.maxZ) / 2;
        const ground = annex.map(([u, v]): Point => [acx + (u - acx) * .83, acz + (v - acz) * .83]);
        const glass = new THREE.MeshStandardMaterial({ color: '#809c9f', metalness: .62, roughness: .22 });
        m.prism(ground, 0, 3.9, materials.darkGlass);
        m.prism(annex, 3.9, 10.8, glass);
        for (let i = 0; i < annex.length; i++) {
          const p = annex[i], q = annex[(i + 1) % annex.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
          const nx = dz / len, nz = -dx / len;
          m.curtain((p[0] + q[0]) / 2 + nx * .13, 9.3, (p[1] + q[1]) / 2 + nz * .13, len, 10.8, Math.atan2(nx, nz), glass);
        }
        for (const [u, v] of samplePerimeter(annex, 13)) {
          const column = new THREE.Mesh(new THREE.CylinderGeometry(.43, .48, 3.9, 16), materials.white);
          column.position.set(u, 1.95, v); column.castShadow = true; m.group.add(column);
        }
        m.roof(annex, 14.7, [], materials.darkRoof);
        const roofMat = new THREE.MeshStandardMaterial({ color: '#9ca8a4', metalness: .55, roughness: .53, side: THREE.DoubleSide });
        const vertices: number[] = [], steps = 48;
        for (let i = 0; i < steps; i++) {
          const x1 = -5 + i / steps * 38, x2 = -5 + (i + 1) / steps * 38;
          const y1 = 14.9 + Math.sin(i / steps * Math.PI) * 4.2, y2 = 14.9 + Math.sin((i + 1) / steps * Math.PI) * 4.2;
          vertices.push(x1, y1, -79, x1, y1, -46, x2, y2, -79, x2, y2, -79, x1, y1, -46, x2, y2, -46);
          if (i % 2 === 0) m.box(x1, y1 + .05, -62.5, .045, .06, 33, materials.steel);
        }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
        const roof = new THREE.Mesh(geometry, roofMat); roof.castShadow = roof.receiveShadow = true; m.group.add(roof);
        for (let i = 0; i < 14; i++) m.box(-10, .14 + i * .16, -39 + i * .48, 8.2, .28 + i * .32, .56, materials.stone);
        m.curtain(-15, 7.7, -36, 10, 2.5, 0, materials.glass);
      }
    } else if (b.kind === 'andrea') {
      const plan = b.architecture!.model!;
      const [hu, hv] = plan.headCenter, radius = plan.headRadius, atrium = circular(hu, hv, plan.atriumRadius, 64);
      m.wall.color.set('#b47b66');
      const outline = plan.localOutline.slice(0, -1);
      // Different floor levels at the circular head and the raised, narrow wing.
      const bays = samplePerimeter(outline, 59);
      for (let i = 0; i < bays.length; i++) {
        const a = bays[i], end = bays[(i + 1) % bays.length];
        const u = (a[0] + end[0]) / 2, v = (a[1] + end[1]) / 2;
        const head = Math.hypot(u - hu, v - hv) < radius + .3;
        const base = head ? plan.headRoomBase : plan.wingRoomBase;
        const rows = head ? 8 : 7;
        for (let floor = 0; floor < rows; floor++) {
          const wide = (i + (floor % 2)) % 2 === 0;
          m.windowBay(a, end, base + floor * plan.floorHeight, plan.floorHeight, wide ? 2.25 : 1.05, 1.42);
        }
      }
      const head = circular(hu, hv, radius, 96);
      m.prism(head, 0, 3.15, materials.concrete, [atrium]);
      const lowerBays = samplePerimeter(head, 31);
      for (let i = 0; i < lowerBays.length; i++) m.windowBay(lowerBays[i], lowerBays[(i + 1) % lowerBays.length], 3.15, 4.45, 3.1, 3.8, materials.concrete);
      m.prism(head, plan.headRoomBase, .22, materials.concrete, [atrium]);
      // Slabs and the annular atrium remain open all the way to the skylight.
      for (let floor = 0; floor <= 7; floor++) m.prism(outline, plan.wingRoomBase + floor * plan.floorHeight, .22, materials.concrete, [atrium]);
      for (let floor = 0; floor < 11; floor++) {
        const y = -.8 + floor * 3.4;
        m.prism(circular(hu, hv, 8.2, 64), y, .24, materials.white, [atrium]);
        m.prism(circular(hu, hv, plan.atriumRadius + .18, 64), y + .24, 1.02, materials.white, [atrium]);
      }
      // The stair core supports the curved north end of the wing.
      const tail: Point[] = [[-24.5, -35.68], ...outline.filter(p => p[1] < -35.68), [-4.57, -35.68]];
      m.prism(tail, 0, plan.wingRoomBase, m.wall);
      m.facade(tail, 0, plan.wingRoomBase, 3, { spacing: 3.6, width: .95, wh: 1.4, frame: m.wall, glass: materials.darkGlass });
      for (const v of [-28, -17, -6]) {
        m.box(-6.2, 5.5, v, 1.2, 11, 1.2, materials.concrete);
        m.beam(new THREE.Vector3(-20, 0, v), new THREE.Vector3(-20, 11, v - 3.7), 1.25, 1.25, materials.concrete);
        m.beam(new THREE.Vector3(-20, 0, v), new THREE.Vector3(-20, 11, v + 3.7), 1.25, 1.25, materials.concrete);
      }
      m.prism(rectangle(-3.5, -12, 42, 53), -.2, .2, materials.concrete);
      m.box(17.3, -1.8, -12, .35, 3.6, 53, materials.concrete);
      m.prism(outline, plan.roofHeight, .28, materials.roof, [atrium]);
      m.edge(outline, plan.roofHeight + .55, .4, .9, m.wall);
      m.edge(outline, plan.roofHeight + 1.03, .5, .09, materials.dark);
      const skylight = new THREE.Mesh(new THREE.CircleGeometry(plan.atriumRadius, 64), new THREE.MeshPhysicalMaterial({ color: '#8ca7ac', transparent: true, opacity: .45, roughness: .14, metalness: .25, side: THREE.DoubleSide, depthWrite: false }));
      skylight.rotation.x = -Math.PI / 2; skylight.position.set(hu, plan.roofHeight + .35, hv); m.group.add(skylight);
      for (let offset = -5.6; offset <= 5.6; offset += 1.4) {
        const length = Math.sqrt(plan.atriumRadius ** 2 - offset ** 2) * 2;
        m.box(hu + offset, plan.roofHeight + .41, hv, .075, .12, length, materials.steel);
        m.box(hu, plan.roofHeight + .43, hv + offset, length, .12, .075, materials.steel);
      }
      m.prism(rectangle(-2, -1, 5.5, 6), plan.roofHeight, 2.4, m.wall);
      m.box(-16, plan.roofHeight + 2.1, -25, 5.2, 4.2, 4.5, materials.white);
      for (let h = 0; h < 5; h++) m.box(-13.34, plan.roofHeight + .7 + h * .55, -25, .1, .08, 4.6, materials.steel);
      m.sign('가톨릭대학교', -4.29, 35.1, -21, 8.8, 1.55, Math.PI / 2);
      // Lettering follows the curved facade, as in the university's current photo.
      const text = 'THE CATHOLIC UNIVERSITY OF KOREA', startAngle = 1.25;
      [...text].forEach((letter, i) => {
        if (letter === ' ') return;
        const angle = startAngle - i * .049;
        m.sign(letter, hu + (radius + .3) * Math.cos(angle), 35.15, hv + (radius + .3) * Math.sin(angle), .77, 2.0, Math.PI / 2 - angle);
      });
      m.box(hu + radius - 1.1, 1.75, hv, .15, 3.5, 4.2, materials.darkGlass);
    } else if (b.kind === 'student') {
      // The current university photo retains the architect's angular entrance and ribbon windows.
      const main: Point[] = [[1.7, -38], [23.14, -38], ...ring.slice(5, 26)];
      m.prism(main, 0, 12.6, m.wall); m.roof(main, 12.6, [], materials.darkRoof);
      for (let i = 0; i < main.length; i++) {
        const a = main[i], end = main[(i + 1) % main.length], dx = end[0] - a[0], dz = end[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 10) continue;
        const nx = dz / len, nz = -dx / len, angle = Math.atan2(nx, nz);
        for (const y of [2.25, 6.55, 10.65]) m.curtain((a[0] + end[0]) / 2 + nx * .2, y, (a[1] + end[1]) / 2 + nz * .2, len - 2.4, 1.55, angle);
      }
      const fin = new THREE.Shape([new THREE.Vector2(-51.3, 0), new THREE.Vector2(-25, 0), new THREE.Vector2(-25, 12.6), new THREE.Vector2(-51.3, 18.3)]);
      const finOpening = new THREE.Path(); finOpening.moveTo(-44, 5); finOpening.lineTo(-36, 5); finOpening.lineTo(-36, 13.4); finOpening.lineTo(-44, 13.4); finOpening.closePath(); fin.holes.push(finOpening);
      const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: 1.35, bevelEnabled: false });
      finGeometry.translate(0, 0, -.675); finGeometry.rotateY(-Math.PI / 2);
      const finMesh = new THREE.Mesh(finGeometry, m.wall); finMesh.position.x = 25.2; finMesh.castShadow = finMesh.receiveShadow = true; m.group.add(finMesh);
      m.curtain(25.2, 9.2, -40, 8, 8.4, Math.PI / 2);
      m.beam(new THREE.Vector3(25.2, 18.35, -51.4), new THREE.Vector3(25.2, 12.68, -25), .15, 1.5, materials.darkRoof);
      const entranceWing: Point[] = [[-.44, -47.85], [4.9, -42.3], [4.9, -47.7]];
      m.block(entranceWing, 0, 12.8, 3, { spacing: 3.4, width: 2.7, wh: 1.9, transoms: 1 });
      m.prism([[3.4, -48.4], [25.4, -47.8], [23.1, -43.8], [3.4, -43.8]], 12.0, 1.65, m.wall);
      for (const [a, end] of [[[5, -39], [14, -47]], [[14, -47], [22, -39]]] as [Point, Point][]) {
        const dx = end[0] - a[0], dz = end[1] - a[1], len = Math.hypot(dx, dz);
        m.curtain((a[0] + end[0]) / 2, 8.65, (a[1] + end[1]) / 2, len, 6.3, -Math.atan2(dz, dx));
      }
      const canopy: Point[] = [[5, -38], [4, -44], [14, -48], [23, -44], [22, -38]];
      m.prism(canopy, 4.55, 1.5, m.wall); m.edge(canopy, 6.09, .2, .12, materials.darkRoof);
      for (const u of [6.8, 20.7]) m.box(u, 2.28, -44, .6, 4.55, .6, materials.concrete);
      m.box(14, 2.1, -38.2, 12, 4.2, .18, materials.dark);
      m.curtain(14, 1.7, -38.4, 4.2, 3.4, Math.PI);
      m.sign('학생미래인재관', 14, 5.3, -48.12, 7.5, 1.65, Math.PI);
      for (let i = 0; i < 4; i++) m.box(14, -.35 + i * .1, -50.5 + i * .45, 22, .2, .6, materials.concrete);
      // The southwest wing has a terrace and a tall glazed stair opening.
      m.box(-4, 12.9, 33, 15, .3, 14, materials.darkRoof);
      m.edge(rectangle(-4, 33, 15, 14), 13.5, .35, 1.1, m.wall);
      m.curtain(-2.5, 7.1, 49.7, 3.4, 12.5);
    } else if (b.kind === 'michael') {
      const recessed: Point[] = ring.map(([u, v]) => [u > 19 ? u - 5 : u, v]);
      m.prism(recessed, 0, 10.8, materials.stone);
      m.facade(recessed, 0, 10.8, 3, { spacing: 4.2, width: 1.3, wh: 2.2 });
      m.prism(ring, 10.8, 3.8, materials.stone);
      m.facade(ring, 10.8, 3.8, 1, { spacing: 4.3, width: 3.5, wh: 1.65, frame: materials.dark });
      m.roof(ring, 14.6);
      for (let v = -36; v <= 20; v += 8) {
        m.box(20.4, 5.4, v, 1.65, 10.8, 1.3, materials.stone);
        m.box(18.5, 6.7, v, 4.8, .5, 1.3, materials.stone);
      }
      const tower: Point[] = [[-18.1, 14], [1.2, -4.5], [19.5, 14.8], [1.2, 33]];
      const courtyard: Point[] = [[-5.5, 14], [1.2, 7.2], [8, 14], [1.2, 20.8]];
      m.prism(tower, 0, 32.6, materials.stone, [courtyard]);
      m.facade(tower, 0, 32.6, 7, { width: 1.4, spacing: 3.9, wh: 2.45 });
      m.roof(tower, 32.6, [courtyard]);
      for (let i = 0; i < tower.length; i++) {
        const a = tower[i], c = tower[(i + 1) % tower.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
        const nx = dz / len, nz = -dx / len, angle = Math.atan2(nx, nz);
        m.curtain((a[0] + c[0]) / 2 + nx * .27, 20.2, (a[1] + c[1]) / 2 + nz * .27, 9.2, 12.2, angle, materials.blueGlass);
      }
      for (const u of [-12, 12]) for (const v of [2, 27]) m.box(u, 34.1, v, .6, 2.9, .6, materials.stone);
      m.box(1, 35.5, 14, 29.5, .45, 29.5, materials.roof, Math.PI / 4);
      m.sign('13 미카엘관', 20.8, 14, -29, 7, .9, Math.PI / 2, '#124d85');
      m.box(-8, 16.1, -22, 5.2, 2.5, 6, materials.white);
      for (let y = 15.3; y < 17.5; y += .35) m.box(-5.3, y, -22, .14, .1, 6.1, materials.steel);
    } else if (b.kind === 'francisco') {
      m.prism(ring,0,b.height,materials.white);
      m.facade(ring,0,b.height,14,{spacing:3.5,width:1.35,wh:1.9,frame:materials.white});
      m.roof(ring,b.height);
      m.box(cx,b.height/2,box.maxZ+.17,w*.36,b.height,.18,materials.roof);
      m.box(cx,b.height+1.4,cz,w*.76,2.3,d*.77,materials.white);
      for(let i=0;i<14;i++)m.box(cx+(i%2?1.4:-1.4),i*3+1.5,box.maxZ+.3,1.4,1.35,.1,materials.darkGlass);
    } else if (b.kind === 'chapel') {
      // The OSM church outline is clockwise; outward windows and roof faces need the opposite winding.
      const chapelRing = THREE.ShapeUtils.isClockWise(ring.map(p => new THREE.Vector2(...p))) ? [...ring].reverse() : ring;
      const chapelWall = new THREE.MeshStandardMaterial({ color: '#d1c1a4', roughness: .9, map: texture }); masonryUV(chapelWall);
      const copper = new THREE.MeshStandardMaterial({ color: '#b3ad8c', metalness: .2, roughness: .7 });
      m.prism(chapelRing, 0, 4.9, chapelWall);
      const upper: Point[] = chapelRing.map(([u, v]) => [u * .24, v * .24]);
      m.slopedRoof(chapelRing, upper, 5.15, 7.3, copper);
      m.prism(upper, 7.3, .56, materials.darkGlass);
      m.edge(upper, 7.35, .18, .12, copper); m.edge(upper, 7.82, .2, .12, copper);
      m.slopedRoof(upper.map(([u, v]): Point => [u * 1.12, v * 1.12]), upper.map(([u, v]): Point => [u * .12, v * .12]), 7.95, 8.65, copper);
      m.edge(chapelRing, 5.02, .7, .35, materials.greenRoof);
      const arch = new THREE.Shape(); arch.moveTo(-.36, 0); arch.lineTo(.36, 0); arch.lineTo(.36, 1.8); arch.absarc(0, 1.8, .36, 0, Math.PI, false); arch.closePath();
      const archGeometry = new THREE.ShapeGeometry(arch);
      for (let i = 0; i < chapelRing.length; i++) {
        const a = chapelRing[i], end = chapelRing[(i + 1) % chapelRing.length], dx = end[0] - a[0], dz = end[1] - a[1], len = Math.hypot(dx, dz);
        const nx = dz / len, nz = -dx / len;
        if ((a[1] + end[1]) / 2 > box.maxZ - 1) continue;
        for (const t of [.27, .5, .73]) {
          const pane = new THREE.Mesh(archGeometry, materials.darkGlass);
          pane.position.set(a[0] + dx * t + nx * .06, 1.1, a[1] + dz * t + nz * .06); pane.rotation.y = Math.atan2(nx, nz); m.group.add(pane);
        }
      }
      m.box(0, 2.1, box.maxZ + .22, 3.3, 4.1, .5, materials.wood);
      for (const u of [-.8, .8]) for (let y = .8; y < 3.8; y += .72) m.box(u, y, box.maxZ + .49, .59, .5, .06, materials.darkGlass);
      for (const u of [-2.15, 2.15]) m.box(u, 2.35, box.maxZ + .6, .65, 4.7, 1.1, chapelWall);
      m.box(0, 4.7, box.maxZ + .6, 4.95, .65, 1.1, chapelWall);
      m.box(0, 4.2, box.maxZ + .8, 3.75, .25, 1.2, copper);
      for (const u of [-6.8, 6.8]) m.box(u, 6.55, 7.3, .65, 1.3, .65, copper);
      for (let i = 0; i < 3; i++) m.box(0, .08 + .13 * i, box.maxZ + 2.1 - .38 * i, 6.2, .16 + .26 * i, .6, materials.stone);
      m.box(0, 9.45, 0, .2, 2.0, .2, materials.greenRoof); m.box(0, 9.8, 0, 1.4, .2, .2, materials.greenRoof);
      // Low rooms enclose the sunken church court in the official exterior photograph.
      for (const side of [-1, 1]) {
        m.prism(rectangle(side * (w / 2 + 6), -3, 4.5, d + 12), 0, 4.3, chapelWall);
        const u = side * (w / 2 + 3.68);
        for (let v = -d / 2; v <= d / 2; v += 6.5) m.curtain(u, 1.8, v, 1.55, 3.5, Math.PI / 2);
        for (let v = -d / 2 - 5; v <= d / 2 + 2; v += 3) m.box(u, 4.8, v, .13, 1.0, .13, materials.wood);
        for (const y of [4.55, 4.95]) m.box(u, y, -3, .12, .14, d + 12, materials.wood);
      }
    } else if (b.kind === 'library') {
      const libraryGlass = new THREE.MeshStandardMaterial({ color: '#7b9995', metalness: .22, roughness: .32 });
      m.prism(ring, -4.4, 4.4, materials.stone);
      m.facade(ring, -4.4, 4.4, 1, { spacing: 3.8, width: 1.7, wh: 2.4 });
      m.prism(ring, 0, 14.2, materials.stone);
      m.facade(ring, 0, 14.2, 3, { spacing: 3.8, width: 1.7, wh: 2.5, frame: materials.dark, glass: libraryGlass, transoms: 2 });
      const clerestory = rectangle(cx, cz, w - 1.5, d - 1.5);
      m.prism(clerestory, 14.2, 3.25, materials.darkGlass);
      m.facade(clerestory, 14.2, 3.25, 1, { spacing: 3.5, width: 3.1, wh: 2.75, frame: materials.dark, glass: materials.glass });
      const eaves = rectangle(cx, cz, w + 3.8, d + 3.8), upper = rectangle(cx, cz, w - 2.2, d - 2.2);
      m.slopedRoof(eaves, upper, 17.6, 19.8, materials.greenRoof);
      m.edge(eaves, 17.53, .24, .28, materials.greenRoof);
      for (let v = -d / 2; v <= d / 2; v += 1.3) for (const side of [-1, 1]) {
        m.beam(new THREE.Vector3(cx + side * (w / 2 + 1.9), 17.66, v), new THREE.Vector3(cx + side * (w / 2 - 1.1), 19.86, v), .055, .055, materials.greenRoof);
        if (Math.round(v * 10) % 2 === 0) m.box(cx + side * (w / 2 + .55), 17.22, v, 2.4, .38, .42, materials.stone);
      }
      m.box(box.maxX + .18, 6.4, 0, .25, 12.8, 10.3, materials.dark);
      for (const y of [2.3, 6.8, 11.4]) m.curtain(box.maxX + .35, y, 0, 9.9, 2.9, Math.PI / 2, libraryGlass);
      const entry: Point[] = [[box.maxX - .2, -5.4]];
      for (let i = 0; i <= 32; i++) { const t = -Math.PI / 2 + i / 32 * Math.PI; entry.push([box.maxX + Math.cos(t) * 4.3, Math.sin(t) * 5.4]); }
      entry.push([box.maxX - .2, 5.4]);
      m.prism(entry, 0, 3.7, materials.darkGlass); m.edge(entry, 3.5, .22, .3, materials.steel);
      m.prism(entry, 3.7, .65, materials.steel);
      m.edge(entry, 4.35, .28, .35, materials.white);
      m.curtain(box.maxX + 4.36, 1.7, 0, 3.5, 3.3, Math.PI / 2);
      for (let i = 0; i < 12; i++) m.box(box.maxX + 10 - i * .52, -.95 + i * .085, 0, .65, .18, 11.8, materials.stone);
      m.box(cx - 3, 21, -17, 7, 2.4, 8, materials.white);
      m.box(cx - 3, 21, 16, 7, 2.4, 8, materials.white);
      m.box(cx - 3, 23, -17, 3.4, 2.2, 2.8, materials.steel);
      m.sign('15 베리타스관', box.maxX + .35, 13.2, 22, 7.4, 1.2, Math.PI / 2, '#124d85');
    } else if (b.kind === 'songsim') {
      const high = rectangle(8, 0, 36.4, 17.2), low = rectangle(-18, 0, 16.4, 17.2);
      m.prism(high, 0, 20.6, m.wall); m.prism(low, 0, 11.6, m.wall);
      m.facade(low, 0, 11.6, 3, { spacing: 3.1, width: 1.35, wh: 2.0 });
      for (const v of [-8.68, 8.68]) for (const u of [-6.5, .3, 7.1, 13.9, 20.7]) {
        for (let row = 0; row < 5; row++) m.curtain(u, 2.05 + row * 4.1, v, 1.75, 1.65);
        m.box(u - 1.3, 10.3, v, .19, 20.3, .2, materials.stone);
      }
      m.curtain(23.4, 10.2, 8.74, .95, 18.7);
      for (const y of [2.5, 6.6, 10.7]) m.curtain(26.28, y, 0, 1.35, 2.3, Math.PI / 2);
      const arched = new THREE.Shape(); arched.moveTo(-1.05, 0); arched.lineTo(1.05, 0); arched.lineTo(1.05, 2.2); arched.absarc(0, 2.2, 1.05, 0, Math.PI, false); arched.closePath();
      const archedWindow = new THREE.Mesh(new THREE.ShapeGeometry(arched), materials.darkGlass); archedWindow.rotation.y = Math.PI / 2; archedWindow.position.set(26.31, 15.9, 0); m.group.add(archedWindow);
      m.box(26.35, 17.25, 0, .08, 2.7, .07, materials.steel);
      for (const y of [16.7, 17.5, 18.1]) m.box(26.35, y, 0, .08, .065, 2.05, materials.steel);
      m.prism(high, 20.6, .55, materials.darkGlass);
      m.slopedRoof(rectangle(8, 0, 38.3, 19.2), rectangle(8, 0, 35.8, 16.7), 21.2, 22.05, materials.darkRoof);
      m.edge(rectangle(8, 0, 38.3, 19.2), 21.13, .4, .35, materials.white);
      m.slopedRoof(rectangle(-18, 0, 18, 19.2), rectangle(-18, 0, 16, 17), 11.85, 12.65, materials.darkRoof);
      m.edge(rectangle(-18, 0, 18, 19.2), 11.75, .4, .35, materials.white);
      m.prism(rectangle(-4.5, -1.5, 7.5, 7), 21.3, 3.4, m.wall);
      for (const u of [-3, 6, 15]) {
        const duct = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, 19, 16), materials.steel); duct.position.set(u, 9.5, 9.3); duct.castShadow = true; m.group.add(duct);
        const bend = new THREE.Mesh(new THREE.TorusGeometry(.8, .31, 8, 16, Math.PI / 2), materials.steel); bend.rotation.y = -Math.PI / 2; bend.position.set(u, 19, 8.5); m.group.add(bend);
      }
      m.sign('16 성심관', 26.37, 18.9, 4.8, 5.5, 1.1, Math.PI / 2);
    } else if (b.kind === 'pharmacy') {
      m.block(ring, 0, b.height, 5, { spacing: 3.7, width: 1.6, wh: 3.5, blue: true });
      m.curtain(box.maxX + .2, 3.6, cz, d - 2, 6, Math.PI / 2, materials.blueGlass);
      for (let v = box.minZ + 2; v < box.maxZ; v += 3.7) m.box(box.maxX + .28, 14.2, v, .38, 18.3, .32, materials.stone);
    } else if (b.kind === 'concert') {
      m.block(ring, 0, 10.2, 2, { spacing: 3.4, width: 2.8, wh: 2.1 });
      const roofRing: Point[] = ring.map(p => [cx + (p[0] - cx) * .72, cz + (p[1] - cz) * .72]);
      m.prism(roofRing, 10.2, 3.3, materials.darkRoof); m.roof(roofRing, 13.5, [], materials.darkRoof);
      m.curtain(cx, 7, box.maxZ + .17, w * .68, 2.6);
      m.box(cx, 3.7, box.maxZ + 2, 12, .55, 5, materials.stone);
      for (const u of [-5, 5]) m.box(cx + u, 1.85, box.maxZ + 3.8, .6, 3.7, .6, materials.stone);
    } else {
      const band = ['incubator', 'virtus'].includes(b.kind);
      m.block(ring, 0, b.height, b.floors, {
        spacing: b.kind === 'student' ? 4.4 : 3.35, width: b.kind === 'student' ? 2.8 : 2,
        wh: b.kind === 'bambino' ? 1.6 : 1.9, band,
        frame: b.kind === 'nicholls' ? materials.white : materials.stone,
      }, holes);
      if (b.kind === 'nicholls') {
        for (let floor = 1; floor <= 4; floor++) m.edge(ring, floor * b.height / 4 - .4, .65, 1.2, materials.white);
        m.edge(ring, .5, .55, .45, materials.white);
        m.roof(ring, b.height + .1, holes, materials.greenRoof);
        m.sign('7 니콜스관', box.maxX + .3, b.height - .1, cz, Math.min(d - 3, 8), 1.0, Math.PI / 2, '#124d85');
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], bb = ring[(i + 1) % ring.length], length = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
          const n = Math.floor(length / 6.8);
          for (let j = 0; j <= n; j++) { const t = j / Math.max(1, n); m.box(THREE.MathUtils.lerp(a[0],bb[0],t), b.height / 2, THREE.MathUtils.lerp(a[1],bb[1],t), .32, b.height, .32, materials.white); }
        }
      }
      if (b.kind === 'maria') {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], end = ring[(i + 1) % ring.length];
          if ((a[0] + end[0]) / 2 > cx) continue;
          for (let floor = 1; floor <= b.floors; floor++) m.edge([a, end], floor * b.height / b.floors - .4, .5, 1.0, materials.white);
        }
        m.prism(rectangle(box.maxX - 1, box.maxZ - 9, 6, 10), 0, b.height + 3.8, m.wall);
        m.curtain(box.maxX + 2.2, 10.2, box.maxZ - 9, 4.8, 19.4, Math.PI / 2);
        m.sign('6 마리아관', box.maxX + 2.28, b.height + 2.1, box.maxZ - 9, 5.8, 1.05, Math.PI / 2);
        m.roof(ring, b.height + .1, holes, materials.greenRoof);
      }
      if (b.kind === 'dasol') {
        m.curtain(box.maxX + .15, 13.5, cz, 6.2, 22, Math.PI / 2);
        m.box(cx - 5, b.height + 1.4, box.minZ + 5, 9, 2.4, 5, m.wall);
      }
      if (b.kind === 'bambino') m.box(box.maxX + .18, 4, cz, .3, 7.5, 6, materials.blue);
      if (b.kind === 'international' || b.kind === 'paul') m.roof(ring, b.height + .1, holes, materials.greenRoof);
    }
    const group = m.finish();
    group.position.set(b.center[0], b.baseElevation + .14, b.center[1]); group.rotation.y = data.angle;
    groups.set(b.id, group); root.add(group);
  }
  return { root, groups };
}

export function createGate(data: CampusData, elevation: (x: number, z: number) => number) {
  const landmark = data.landmarks.find(p => p.number === 1)!, group = new THREE.Group();
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(cube, mat); mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  for (const z of [-8,8]) {
    box(0,4.6,z,1.2,9.2,2.2,materials.stone);
    box(.63,4.8,z,.12,8.5,1.45,materials.blue);
    box(0,9.3,z,1.9,.32,2.8,materials.white);
  }
  box(0,1.8,13,1.8,3.6,1.8,materials.blue);
  group.position.set(landmark.position[0],elevation(...landmark.position),landmark.position[1]); group.rotation.y = data.angle;
  group.name = '정문'; return group;
}
