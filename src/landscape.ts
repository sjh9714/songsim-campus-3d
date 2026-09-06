import * as THREE from 'three';
import type { CampusData, Point } from './types';
import { bounds, center, circular, createElevation, extruded, inside, rawElevation, ringDistance, seededRandom, segmentDistance } from './geo';

export function createLandscape(data: CampusData) {
  const group = new THREE.Group(), trees = new THREE.Group();
  group.name = '지형 · 도로 · 조경'; trees.name = '수목';
  const elevation = createElevation(data), rng = seededRandom(2164);
  const e = data.terrain.extent, width = e[2] - e[0], depth = e[3] - e[1];
  const textureCanvas = document.createElement('canvas'); textureCanvas.width = 3072; textureCanvas.height = 2432;
  const c = textureCanvas.getContext('2d')!, sx = textureCanvas.width / width, sz = textureCanvas.height / depth;
  const px = (x: number) => (x - e[0]) * sx, pz = (z: number) => (z - e[1]) * sz;
  c.fillStyle = '#87926f'; c.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  for (let i = 0; i < 18000; i++) {
    c.fillStyle = rng() > .48 ? 'rgba(32,59,29,.035)' : 'rgba(204,199,141,.06)';
    c.beginPath(); c.ellipse(rng()*textureCanvas.width,rng()*textureCanvas.height,5+rng()*48,4+rng()*39,0,0,Math.PI*2); c.fill();
  }
  function fill(ring: Point[], color: string) {
    c.beginPath(); ring.forEach((p,i) => i ? c.lineTo(px(p[0]),pz(p[1])) : c.moveTo(px(p[0]),pz(p[1]))); c.closePath(); c.fillStyle=color; c.fill();
  }
  function stroke(points: Point[], color: string, size: number, close = false) {
    c.beginPath(); points.forEach((p,i) => i ? c.lineTo(px(p[0]),pz(p[1])) : c.moveTo(px(p[0]),pz(p[1])));
    if(close)c.closePath(); c.strokeStyle=color; c.lineWidth=size*sx; c.lineCap='round';c.lineJoin='round';c.stroke();
  }
  // Paving around the measured outlines. Local landscaping is interpreted from photos.
  for (const b of data.buildings) {
    fill(b.siteRing || b.ring,'#adafa3'); stroke(b.siteRing || b.ring,'#aaa99b',13,true);
    if(b.annex){fill(b.annex,'#aeae9f');stroke(b.annex,'#b7b2a2',11,true);}
    for(const hole of b.holes)fill(hole,'#aeada2');
  }
  const michael=data.buildings.find(b=>b.kind==='michael')!,library=data.buildings.find(b=>b.kind==='library')!;
  fill([[michael.center[0]+5,michael.center[1]-12],[library.center[0]+32,library.center[1]-16],
    [library.center[0]+51,library.center[1]+50],[michael.center[0]+33,michael.center[1]+32]],'#b4b1a1');
  const roadWidths: Record<string,number>={service:6.2,residential:6.8,tertiary:10,secondary:13,unclassified:7.2,footway:2.5,path:1.8,steps:2.6,track:3.2,pedestrian:4.5};
  for(const road of data.roads){
    const w=roadWidths[road.type]||4;
    stroke(road.points,'#bdbdaf',w+.8);
    stroke(road.points,['path','track'].includes(road.type)?'#a59c80':road.type==='steps'?'#bdbbb1':w<5?'#b6b3a1':'#747b79',w);
    if(road.type==='steps')for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.65);
      for(let j=0;j<n;j++){const t=j/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,nx=-(b[1]-a[1])/(len||1)*w/2,nz=(b[0]-a[0])/(len||1)*w/2;stroke([[x+nx,z+nz],[x-nx,z-nz]],'#8e9289',.13);}
    }
  }
  const lawn=data.landmarks.find(p=>p.number===12)!;
  const lawnRing=lawn.ring || circular(lawn.position[0],lawn.position[1],32,48);
  fill(lawnRing,'#84995d');
  for(const ground of data.grounds){
    fill(ground.ring,ground.kind==='field'?'#bca981':'#708887');
    stroke(ground.ring,'#b3b6aa',3,true);
    const r=ground.ring;
    const at=(u:number,v:number):Point=>[(1-v)*((1-u)*r[0][0]+u*r[1][0])+v*((1-u)*r[3][0]+u*r[2][0]),
      (1-v)*((1-u)*r[0][1]+u*r[1][1])+v*((1-u)*r[3][1]+u*r[2][1])];
    if(ground.kind==='field'){
      const line='#e3dfc5';
      stroke([at(.08,.07),at(.92,.07),at(.92,.93),at(.08,.93)],line,.22,true);
      stroke([at(.08,.5),at(.92,.5)],line,.18);
      const cp=at(.5,.5);stroke(circular(cp[0],cp[1],9.15,64),line,.2,true);
      for(const v of [.07,.93]){
        const dir=v<.5?1:-1;
        stroke([at(.24,v),at(.24,v+dir*.14),at(.76,v+dir*.14),at(.76,v)],line,.2);
        stroke([at(.38,v),at(.38,v+dir*.05),at(.62,v+dir*.05),at(.62,v)],line,.18);
      }
    }else{
      for(const off of [0,.5]){
        const a=(u:number,v:number)=>at(u*.42+.04+off,v*.82+.09);
        stroke([a(0,0),a(1,0),a(1,1),a(0,1)],'#d6dad0',.15,true);
        stroke([a(.12,0),a(.12,1)],'#d6dad0',.14);stroke([a(.88,0),a(.88,1)],'#d6dad0',.14);
        stroke([a(0,.5),a(1,.5)],'#ebeee4',.19);
        stroke([a(.12,.27),a(.88,.27)],'#d6dad0',.14);stroke([a(.12,.73),a(.88,.73)],'#d6dad0',.14);
        stroke([a(.5,.27),a(.5,.73)],'#d6dad0',.14);
      }
    }
  }
  for(let i=0;i<220000;i++){c.fillStyle=rng()<.5?'rgba(255,255,225,.045)':'rgba(23,30,20,.04)';c.fillRect(rng()*textureCanvas.width,rng()*textureCanvas.height,1+rng()*2,1+rng()*2);}
  const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const n=193, positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=e[0]+i/(n-1)*width,z=e[1]+j/(n-1)*depth;positions.push(x,elevation(x,z),z);uvs.push(i/(n-1),1-j/(n-1));}
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const a=j*n+i;indices.push(a,a+n,a+1,a+1,a+n,a+n+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const groundMesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,roughness:1,color:'#faf9f0'}));groundMesh.receiveShadow=true;groundMesh.name='공개 DEM 지형';group.add(groundMesh);

  const treePoints:{x:number;z:number;h:number;r:number}[]=[];
  const footprint=data.buildings.flatMap(b=>b.annex?[b.siteRing || b.ring,b.annex]:[b.siteRing || b.ring]);
  const excluded=[...footprint,...data.grounds.map(g=>g.ring),...data.context.map(b=>b.ring)];
  const boxes=excluded.map(r=>({ring:r,box:bounds(r)}));
  const nearRoad=(x:number,z:number)=>data.roads.some(r=>r.points.some((p,i)=>i>0&&segmentDistance(x,z,r.points[i-1],p)<((roadWidths[r.type]||4)/2+2.3)));
  for(let attempt=0;attempt<28000 && treePoints.length<1450;attempt++){
    const x=-415+rng()*840,z=-385+rng()*680,isCampus=inside(x,z,data.boundary);
    // The wooded hills west/north of the campus remain dominant; the urban edge stays open.
    if(!isCampus && !(x<-215 && z<160) && !(z<-280&&x<130))continue;
    if(inside(x,z,lawnRing))continue;
    if(x>michael.center[0]+10&&x<library.center[0]+55&&z>library.center[1]-24&&z<michael.center[1]+32)continue;
    if(boxes.some(p=>x>p.box.minX-8&&x<p.box.maxX+8&&z>p.box.minZ-8&&z<p.box.maxZ+8&&(inside(x,z,p.ring)||ringDistance(x,z,p.ring)<7)))continue;
    if(nearRoad(x,z))continue;
    if(treePoints.some(p=>Math.hypot(p.x-x,p.z-z)<5.3))continue;
    const h=5+rng()*7,r=2.8+rng()*2.5;treePoints.push({x,z,h,r});
  }
  const leafGeo=new THREE.SphereGeometry(1,9,7),lp=leafGeo.attributes.position;
  for(let i=0;i<lp.count;i++){const v=new THREE.Vector3().fromBufferAttribute(lp,i);v.multiplyScalar(.86+rng()*.26);lp.setXYZ(i,v.x,v.y,v.z);}leafGeo.computeVertexNormals();
  const foliage=new THREE.InstancedMesh(leafGeo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}),treePoints.length*4);
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.23,.36,1,6),new THREE.MeshStandardMaterial({color:'#685b45',roughness:1}),treePoints.length);
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  const greens=['#29482e','#456437','#526b37','#3d542b','#5c703a','#385c39','#4d5f32'];
  treePoints.forEach((t,i)=>{
    const y=elevation(t.x,t.z);dummy.position.set(t.x,y+t.h*.35,t.z);dummy.scale.set(1,t.h*.7,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    for(let j=0;j<4;j++){
      const a=j/3*Math.PI*2,offset=j===3?0:t.r*.42;
      dummy.position.set(t.x+Math.cos(a)*offset,y+t.h*(j===3?.78:.64),t.z+Math.sin(a)*offset);
      dummy.scale.set(t.r*(j===3?.77:.82),t.r*(j===3?1.03:.82),t.r*.83);
      dummy.rotation.set(rng()*.3,rng()*6,rng()*.3);dummy.updateMatrix();foliage.setMatrixAt(i*4+j,dummy.matrix);
      color.set(greens[Math.floor(rng()*greens.length)]);foliage.setColorAt(i*4+j,color);
    }
  });
  foliage.castShadow=foliage.receiveShadow=true;trunks.castShadow=true;foliage.computeBoundingSphere();trunks.computeBoundingSphere();trees.add(foliage,trunks);group.add(trees);

  // Outdoor stage and the spiral hedge are visible in the official Haneul garden photo.
  const hedgeMat=new THREE.MeshStandardMaterial({color:'#486d36',roughness:1}),woodMat=new THREE.MeshStandardMaterial({color:'#866348',roughness:.93});
  const bx=lawn.position[0]-16,bz=lawn.position[1]-13;
  for(let i=0;i<160;i++){
    const t=i/159*Math.PI*5.7,r=1.1+t*.28,x=bx+Math.cos(t)*r,z=bz+Math.sin(t)*r;
    const bush=new THREE.Mesh(new THREE.SphereGeometry(.56,6,4),hedgeMat);bush.scale.y=.9;bush.position.set(x,elevation(x,z)+.63,z);bush.castShadow=true;group.add(bush);
  }
  const gardenPoint=(u:number,v:number):Point=>[lawn.position[0]+u*Math.cos(data.angle)+v*Math.sin(data.angle),lawn.position[1]-u*Math.sin(data.angle)+v*Math.cos(data.angle)];
  const stageRing:Point[]=[gardenPoint(20,6)];
  for(let i=0;i<=24;i++){const t=-Math.PI/2+i/24*Math.PI;stageRing.push(gardenPoint(24+Math.cos(t)*6,14+Math.sin(t)*8));}
  stageRing.push(gardenPoint(20,22));
  const stage=new THREE.Mesh(extruded(stageRing,.65),woodMat);stage.position.y=elevation(...gardenPoint(24,14));stage.castShadow=stage.receiveShadow=true;group.add(stage);

  const field=data.grounds[0],r=field.ring,a=r[0],b=r[3],length=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  const fieldCenter=center(r),fieldY=rawElevation(data,...fieldCenter);
  const normal=new THREE.Vector2(-(b[1]-a[1])/length,(b[0]-a[0])/length);
  const mid=center([a,b]);
  if(normal.dot(new THREE.Vector2(mid[0]-fieldCenter[0],mid[1]-fieldCenter[1]))<0)normal.negate();
  for(let i=0;i<8;i++){
    const stand=new THREE.Mesh(new THREE.BoxGeometry(length+5,.75,1.7),new THREE.MeshStandardMaterial({color:i%2?'#aaa99d':'#b8b7a9',roughness:.94}));
    stand.position.set(mid[0]+normal.x*(2+i*1.2),fieldY+.38+i*.65,mid[1]+normal.y*(2+i*1.2));stand.rotation.y=angle;stand.castShadow=stand.receiveShadow=true;group.add(stand);
  }

  const context=new THREE.Group(),contextMat=new THREE.MeshStandardMaterial({color:'#b8b9b0',roughness:.95});
  for(const b of data.context){
    const cp=center(b.ring),mesh=new THREE.Mesh(extruded(b.ring,b.height),contextMat);mesh.position.y=elevation(...cp);
    mesh.castShadow=mesh.receiveShadow=true;context.add(mesh);
  }
  context.name='주변 건물';group.add(context);
  return {group,trees,context,elevation,treeCount:treePoints.length};
}
