import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBuildings, createGate } from './buildings';
import { createLandscape } from './landscape';
import type { Building, CampusData } from './types';

type Flight = { start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; target: THREE.Vector3 };
export class CampusViewer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 1, 3500);
  private controls: OrbitControls;
  private models: ReturnType<typeof createBuildings>;
  private landscape: ReturnType<typeof createLandscape>;
  private flight?: Flight;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private selected: string | null = null;
  private comparing = false;
  private comparisonFloor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ color: '#253a2c', opacity: .17 }));
  private comparisonGround = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({ color: '#dfe6e3', toneMapped: false }));
  private sun = new THREE.DirectionalLight('#fff4e3', 2.65);
  private gate: THREE.Group;
  private labels: { node: HTMLButtonElement; position: THREE.Vector3; id: string; priority: number }[] = [];
  private showLabels = true;
  private outline = new THREE.Group();
  private homeTarget = new THREE.Vector3(-25, 26, -22);
  private homePosition = new THREE.Vector3(570, 490, 505);
  private observer: ResizeObserver;
  private dragging = false;
  private pointerStart = [0, 0];
  private vector = new THREE.Vector3();
  private lastFrame = 0;
  private dirtyFrames = 2;
  private raf = 0;
  private frameScale = 1;
  onOrientation?: (degrees: number) => void;
  onUserMove?: () => void;

  constructor(private host: HTMLElement, private data: CampusData, private onSelect: (id: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .94;
    this.renderer.setClearColor('#dfe6e3');
    this.renderer.domElement.setAttribute('aria-label', '성심교정 3D 지도. 마우스로 회전하고 스크롤로 확대할 수 있습니다. 건물은 왼쪽 목록으로도 선택할 수 있습니다.');
    this.renderer.domElement.setAttribute('role', 'img');
    host.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color('#dfe6e3');
    this.scene.fog = new THREE.Fog('#dfe6e3', 1050, 2200);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environmentMap = pmrem.fromScene(environment, .025);
    this.scene.environment = environmentMap.texture;
    this.scene.environmentIntensity = .24;
    environment.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#dcecff', '#766c4b', .95));
    const sun = this.sun;
    sun.position.set(-240, 620, 350); sun.target.position.set(-20, 0, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -510; sun.shadow.camera.right = 510;
    sun.shadow.camera.top = 510; sun.shadow.camera.bottom = -510;
    sun.shadow.camera.near = 100; sun.shadow.camera.far = 1200;
    sun.shadow.normalBias = .65; sun.shadow.bias = -.00013;
    this.scene.add(sun, sun.target);

    this.landscape = createLandscape(data);
    this.models = createBuildings(data);
    this.gate = createGate(data, this.landscape.elevation);
    this.comparisonFloor.rotation.x = -Math.PI / 2; this.comparisonFloor.receiveShadow = true; this.comparisonFloor.visible = false;
    this.comparisonGround.rotation.x = -Math.PI / 2; this.comparisonGround.visible = false;
    this.scene.add(this.landscape.group, this.models.root, this.gate, this.outline, this.comparisonGround, this.comparisonFloor);
    this.camera.position.copy(this.homePosition);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.homeTarget);
    this.controls.enableDamping = true; this.controls.dampingFactor = .09;
    this.controls.minDistance = 35; this.controls.maxDistance = 2200;
    this.controls.minPolarAngle = .025; this.controls.maxPolarAngle = Math.PI * .475;
    this.controls.panSpeed = .8; this.controls.rotateSpeed = .65;
    this.controls.maxTargetRadius = 620; this.controls.cursor.set(0, 25, 0);
    this.controls.addEventListener('start', () => { this.flight = undefined; this.dirtyFrames = 40; this.onUserMove?.(); });
    this.controls.addEventListener('change', () => { this.dirtyFrames = 2; });
    this.controls.update();
    this.makeLabels();
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => { this.pointerStart = [e.clientX, e.clientY]; this.dragging = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons && Math.hypot(e.clientX - this.pointerStart[0], e.clientY - this.pointerStart[1]) > 5) this.dragging = true;
      if (!e.buttons) canvas.style.cursor = this.hit(e.clientX, e.clientY) ? 'pointer' : 'grab';
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || this.dragging) return;
      const id = this.hit(e.clientX, e.clientY); if (id) onSelect(id);
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host); this.resize(); this.animate(0);
  }

  private hit(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.models.root.children.filter(group => group.visible), true);
    for (const hit of intersections) {
      let item: THREE.Object3D | null = hit.object;
      while (item) { if (item.userData.buildingId) return item.userData.buildingId as string; item = item.parent; }
    }
    return null;
  }

  private makeLabels() {
    const layer = document.createElement('div'); layer.className = 'map-labels'; layer.setAttribute('aria-label', '지도 위 건물');
    this.host.append(layer);
    const priorityIds = ['3', '5', '9', '15', '18', '13', '22', '17', '11', '6'];
    this.labels = this.data.buildings.map(b => {
      const node = document.createElement('button'); node.className = 'map-label';
      node.innerHTML = '<span class="label-code"></span><span class="label-name"></span>';
      node.querySelector('.label-code')!.textContent = b.code;
      node.querySelector('.label-name')!.textContent = b.name;
      node.setAttribute('aria-label', b.name + ' 선택');
      node.addEventListener('click', () => this.onSelect(b.id)); layer.append(node);
      const box = new THREE.Box3().setFromObject(this.models.groups.get(b.id)!);
      const center = box.getCenter(new THREE.Vector3()); center.y = box.max.y + 5;
      return { node, position: center, id: b.id, priority: priorityIds.includes(b.id) ? priorityIds.indexOf(b.id) : 30 };
    });
  }

  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    const nextScale = width < 600 ? 1.5 : width < 1000 ? 1.2 : 1;
    if (nextScale !== this.frameScale) {
      const ratio = nextScale / this.frameScale;
      this.camera.position.sub(this.controls.target).multiplyScalar(ratio).add(this.controls.target);
      if (this.flight) {
        this.flight.from.sub(this.flight.fromTarget).multiplyScalar(ratio).add(this.flight.fromTarget);
        this.flight.to.sub(this.flight.target).multiplyScalar(ratio).add(this.flight.target);
      }
      this.frameScale = nextScale;
    }
    this.renderer.setSize(width, height);
    this.camera.fov = width < 600 ? 55 : 40;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = 1050 * this.frameScale; fog.far = 2200 * this.frameScale;
    this.camera.aspect = width / height;
    const left = width >= 1000 && !document.getElementById('app')!.classList.contains('is-comparing') ? 304 : 0;
    const detail = document.getElementById('detail')!;
    const right = width >= 1000 && this.selected ? detail.clientWidth + 24 : width >= 600 && this.selected ? detail.clientWidth : 0;
    const bottom = width < 600 && this.selected ? detail.clientHeight + 20 : 0;
    this.camera.setViewOffset(width, height, (right - left) / 2, bottom / 2, width, height);
    this.camera.updateProjectionMatrix(); this.dirtyFrames = 3;
  }

  select(id: string | null, focus = true) {
    this.selected = id;
    this.updateComparison();
    while (this.outline.children.length) {
      const line = this.outline.children[0] as THREE.Line;
      line.geometry.dispose(); (line.material as THREE.Material).dispose(); this.outline.remove(line);
    }
    this.labels.forEach(l => l.node.classList.toggle('is-selected', l.id === id));
    this.resize();
    if (!id) return;
    const b = this.data.buildings.find(b => b.id === id)!;
    const points = b.ring.map(p => new THREE.Vector3(p[0], b.baseElevation + .8, p[1]));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#d3dbaa', transparent: true, opacity: .95, depthTest: false }));
    line.renderOrder = 10; this.outline.add(line);
    if (focus) this.focus(b);
    this.dirtyFrames = 3;
  }

  private focus(b: Building) {
    if (this.comparing) { this.focusPhoto(b); return; }
    const box = new THREE.Box3().setFromObject(this.models.groups.get(b.id)!);
    const target = box.getCenter(new THREE.Vector3()); target.y = box.min.y + (box.max.y - box.min.y) * .27;
    const size = box.getSize(new THREE.Vector3());
    const distance = Math.max(115, Math.max(size.x, size.z) * 2.3, size.y * 3.5) * this.frameScale;
    this.fly(this.clearView(b, target, distance, .7), target);
  }

  private focusPhoto(b: Building, zoom = 1) {
    const box = new THREE.Box3().setFromObject(this.models.groups.get(b.id)!);
    const size = box.getSize(new THREE.Vector3()), target = box.getCenter(new THREE.Vector3());
    target.y = b.baseElevation + b.height * .38;
    let distance = Math.max(115, Math.max(size.x, size.z) * 2.3, size.y * 3.5);
    if (b.kind === 'student') {
      const u = 14, v = -44, a = this.data.angle;
      target.set(b.center[0] + u * Math.cos(a) + v * Math.sin(a), b.baseElevation + 7.8, b.center[1] - u * Math.sin(a) + v * Math.cos(a));
      distance = 65;
    }
    if (b.kind === 'kim') distance = 205;
    this.fly(target.clone().addScaledVector(this.comparisonDirection(b).normalize(), distance * zoom * this.frameScale), target);
  }

  setComparison(show: boolean) {
    this.comparing = show; this.updateComparison(); this.resize();
    if (this.selected) this.focus(this.data.buildings.find(b => b.id === this.selected)!);
  }

  private updateComparison() {
    const active = this.comparing && !!this.selected;
    this.controls.maxPolarAngle = Math.PI * (active ? .58 : .475);
    for (const [id, group] of this.models.groups) group.visible = !active || id === this.selected;
    this.landscape.group.visible = this.gate.visible = !active;
    this.comparisonFloor.visible = this.comparisonGround.visible = active; this.outline.visible = !active;
    const sun = this.sun;
    if (active) {
      const b = this.data.buildings.find(b => b.id === this.selected)!;
      this.comparisonFloor.position.y = b.baseElevation + .015;
      this.comparisonGround.position.y = b.baseElevation;
      sun.target.position.set(b.center[0], b.baseElevation, b.center[1]);
      const direction = this.comparisonDirection(b).normalize();
      sun.position.copy(sun.target.position).add(new THREE.Vector3(direction.x * 420 - direction.z * 220, 620, direction.z * 420 + direction.x * 220));
    } else {
      sun.position.set(-240, 620, 350); sun.target.position.set(-20, 0, 0);
    }
    const span = active ? 135 : 510;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span });
    sun.shadow.normalBias = active ? .09 : .65;
    sun.shadow.camera.updateProjectionMatrix();
    this.dirtyFrames = 3;
  }

  private clearView(b: Building, target: THREE.Vector3, distance: number, slope: number) {
    // Choose an approach with an unobstructed sightline to the selected hall.
    if (this.comparing) {
      return target.clone().addScaledVector(this.comparisonDirection(b).normalize(), distance);
    }
    const preferred = b.kind === 'andrea' ? Math.PI * .48 : Math.PI * .23;
    const boxes = [...this.models.groups].filter(([id]) => id !== b.id).map(([, group]) => new THREE.Box3().setFromObject(group));
    let best = target.clone(), score = Infinity;
    for (const offset of [0, .48, -.48, .95, -.95, 1.55, -1.55, Math.PI]) {
      const angle = preferred + offset;
      const position = target.clone().addScaledVector(new THREE.Vector3(Math.sin(angle), slope, Math.cos(angle)).normalize(), distance);
      const ray = new THREE.Ray(position, target.clone().sub(position).normalize());
      const hit = new THREE.Vector3();
      const occlusions = boxes.filter(box => ray.intersectBox(box, hit) && hit.distanceTo(position) < distance - 6).length;
      const candidate = occlusions * 10 + Math.abs(offset);
      if (candidate < score) { best = position; score = candidate; }
    }
    return best;
  }

  private comparisonDirection(b: Building) {
    // Approximate the directions of the university's exterior photographs.
    const directions: Record<string, [number, number, number]> = {
      andrea: [.98, .11, -.1], library: [.96, .035, -.23],
      michael: [.99, .21, -.12], student: [-.53, -.08, -.84],
      chapel: [.3, .035, .95], kim: [.89, .075, -.49],
      songsim: [.87, -.005, .5],
    };
    return new THREE.Vector3(...(directions[b.kind] || [.87, .32, .5]));
  }

  closeView() {
    if (!this.selected) return;
    const b = this.data.buildings.find(b => b.id === this.selected)!;
    if (this.comparing) { this.focusPhoto(b, .82); return; }
    const box = new THREE.Box3().setFromObject(this.models.groups.get(b.id)!);
    const target = box.getCenter(new THREE.Vector3()); target.y = b.baseElevation + b.height * .42;
    const size = box.getSize(new THREE.Vector3());
    this.fly(this.clearView(b, target, Math.max(size.x, size.z, 40) * 1.8 * this.frameScale, .22), target);
  }

  home() { this.fly(this.homePosition.clone().sub(this.homeTarget).multiplyScalar(this.frameScale).add(this.homeTarget), this.homeTarget.clone()); }
  top() {
    const target = this.selected ? this.controls.target.clone() : this.homeTarget.clone();
    const distance = this.selected ? Math.max(180, this.camera.position.distanceTo(target)) : 930 * this.frameScale;
    this.fly(target.clone().add(new THREE.Vector3(0, distance, .15)), target);
  }
  north() {
    const offset = this.camera.position.clone().sub(this.controls.target), radius = Math.hypot(offset.x, offset.z);
    this.fly(this.controls.target.clone().add(new THREE.Vector3(0, offset.y, Math.max(1, radius))), this.controls.target.clone());
  }
  zoom(factor: number) {
    const target = this.controls.target.clone(), offset = this.camera.position.clone().sub(target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance));
    this.fly(target.clone().add(offset), target);
  }
  setLabels(show: boolean) { this.showLabels = show; this.dirtyFrames = 3; }

  private fly(to: THREE.Vector3, target: THREE.Vector3) {
    this.flight = { start: performance.now(), from: this.camera.position.clone(), to, fromTarget: this.controls.target.clone(), target };
    this.dirtyFrames = 3;
  }

  private updateLabels() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    const distance = this.camera.position.distanceTo(this.controls.target);
    const occupied: { x: number; y: number; w: number }[] = [];
    const sorted = [...this.labels].sort((a, b) => (a.id === this.selected ? -1 : a.priority) - (b.id === this.selected ? -1 : b.priority));
    for (const label of sorted) {
      this.vector.copy(label.position).project(this.camera);
      const x = (this.vector.x + 1) / 2 * width, y = (1 - this.vector.y) / 2 * height;
      const w = 42 + (this.selected === label.id ? label.node.textContent!.length * 6.3 : label.node.textContent!.length * 5.8);
      const detail = document.getElementById('detail')!;
      const left = width >= 1000 && !document.getElementById('app')!.classList.contains('is-comparing') ? 325 : 8;
      const right = width >= 600 && this.selected ? detail.clientWidth + 45 : 65;
      const bottom = width < 600 && this.selected ? detail.clientHeight + 120 : 110;
      const allowed = this.showLabels && (!this.comparing || label.id === this.selected) && this.vector.z < 1 && this.vector.z > -1 && x > left && x < width - right && y > 100 && y < height - bottom
        && (distance < 620 || label.priority < (width < 700 ? 4 : 8) || label.id === this.selected);
      const overlaps = occupied.some(p => Math.abs(p.x - x) < (p.w + w) / 2 + 7 && Math.abs(p.y - y) < 38);
      const visible = allowed && (!overlaps || label.id === this.selected);
      label.node.hidden = !visible;
      if (visible) { label.node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; occupied.push({ x, y, w }); }
    }
  }

  private animate = (time: number) => {
    this.raf = requestAnimationFrame(this.animate);
    if (document.hidden || time - this.lastFrame < 1000 / 45) return;
    this.lastFrame = time;
    if (this.flight) {
      const t = Math.min(1, (performance.now() - this.flight.start) / (matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1050));
      const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, eased);
      this.controls.target.lerpVectors(this.flight.fromTarget, this.flight.target, eased);
      if (t === 1) this.flight = undefined;
      this.dirtyFrames = 3;
    }
    this.controls.update();
    // Render on movement and resize, then let a stationary campus rest.
    if (this.dirtyFrames <= 0) return;
    this.dirtyFrames--;
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    this.onOrientation?.(this.controls.getAzimuthalAngle() * 180 / Math.PI);
  };

  dispose() {
    cancelAnimationFrame(this.raf); this.observer.disconnect(); this.controls.dispose();
    this.scene.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.dispose()); }
    });
    this.scene.environment?.dispose(); this.renderer.dispose();
  }
}
