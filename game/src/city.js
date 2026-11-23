// city.js — procedural Vista Bay: 600x600m city, districts, landmarks, road graph.
// All geometry and textures are generated at runtime; no external assets.

import * as THREE from 'three';
import { rand, randInt, choice } from './state.js';

export const CITY_HALF = 300;
export const ROADS = [-270, -210, -150, -90, -30, 30, 90, 150, 210, 270];
export const ROAD_W = 12;

// Block centres (between roads) — used for districts and landmark placement.
const BLOCKS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

function windowTexture(base, lit, floors, cols) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const cw = 128 / cols, ch = 256 / floors;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const on = Math.random() < 0.42;
      g.fillStyle = on ? lit : '#1d2733';
      g.fillRect(i * cw + 2, f * ch + 3, cw - 4, ch - 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textTexture(text, sub, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg; g.font = 'bold 54px Arial'; g.textAlign = 'center';
  g.fillText(text, 256, 62);
  g.font = '28px Arial';
  g.fillText(sub, 256, 104);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3a3d42';
  for (let i = 0; i < 200; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#e8d44d';
  g.fillRect(62, 0, 4, 128); // centre line
  g.fillStyle = '#dfe3e6';
  g.fillRect(6, 0, 3, 128); g.fillRect(119, 0, 3, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const palmPositions = [];
function addPalm(x, z) { palmPositions.push([x, z, rand(-0.06, 0.06)]); }

function buildPalms(scene) {
  // ~120 palms as 3 instanced meshes instead of ~950 separate meshes.
  const count = palmPositions.length;
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const nutMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 4.6, 6), trunkMat, count);
  const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.06, 0.55), leafMat, count * 6);
  const nuts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 5), nutMat, count);
  const dummy = new THREE.Object3D();
  palmPositions.forEach(([x, z, tilt], i) => {
    dummy.position.set(x, 2.3, z); dummy.rotation.set(0, 0, tilt); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 4.45, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    nuts.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      dummy.position.set(x + Math.cos(a) * 1.0, 4.7, z + Math.sin(a) * 1.0);
      dummy.rotation.set(0, -a, 0.45); dummy.updateMatrix();
      leaves.setMatrixAt(i * 6 + k, dummy.matrix);
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  nuts.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true; leaves.castShadow = true;
  scene.add(trunks, leaves, nuts);
}

const lampPositions = [];
function buildLamps(scene) {
  const count = lampPositions.length;
  if (!count) return;
  const mat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), mat, count);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), mat, count);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), count);
  const dummy = new THREE.Object3D();
  lampPositions.forEach(([x, z], i) => {
    dummy.position.set(x, 2.7, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x + 0.6, 5.35, z); dummy.updateMatrix();
    arms.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x + 1.25, 5.3, z); dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
  });
  poles.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  bulbs.instanceMatrix.needsUpdate = true;
  scene.add(poles, arms, bulbs);
}

// Landmark positions the missions and HUD share.
export const LANDMARKS = {
  garage: { x: 60, z: 226, label: 'Mara\'s Garage' },
  pier: { x: 0, z: 336, label: 'Vista Pier' },
  pierGate: { x: 0, z: 288, label: 'Pier Gate' },
  park: { x: -180, z: -180, label: 'Palm Court Park' },
  casino: { x: 180, z: -150, label: 'Golden Palm Casino' },
  casinoDoor: { x: 180, z: -138, label: 'Casino Front' },
  hospital: { x: -180, z: 168, label: 'Vista General Hospital' },
  hospitalDoor: { x: -180, z: 150, label: 'Hospital Entrance' },
  airport: { x: 270, z: 0, label: 'Vista Bay Airport' },
  runway: { x: 270, z: 0, label: 'Runway 27' },
  docks: { x: -252, z: 210, label: 'Harbor Docks' },
  downtown: { x: 0, z: 0, label: 'Downtown' },
  beach: { x: -120, z: 272, label: 'Vista Beach' },
};

export function buildCity(G) {
  const scene = G.scene;
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const addCollider = (x, z, w, d) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  // --- sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x9cc4e4, 220, 950);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -340; sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340; sun.shadow.camera.bottom = -340;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));
  G.sun = sun;

  // --- ground --------------------------------------------------------------
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9aa08a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  // beach sand strip
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(620, 62),
    new THREE.MeshLambertMaterial({ color: 0xe6cf9a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 271);
  sand.receiveShadow = true; scene.add(sand);

  // ocean
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 900),
    new THREE.MeshLambertMaterial({ color: 0x2a7ab8, transparent: true, opacity: 0.94 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.4, 760);
  scene.add(ocean);
  G.ocean = ocean;

  // park grass
  const parkGrass = new THREE.Mesh(new THREE.PlaneGeometry(58, 58),
    new THREE.MeshLambertMaterial({ color: 0x5da24a }));
  parkGrass.rotation.x = -Math.PI / 2; parkGrass.position.set(-180, 0.03, -180);
  parkGrass.receiveShadow = true; scene.add(parkGrass);

  // airport tarmac
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(58, 150),
    new THREE.MeshLambertMaterial({ color: 0x4a4d52 }));
  tarmac.rotation.x = -Math.PI / 2; tarmac.position.set(270, 0.03, 0);
  tarmac.receiveShadow = true; scene.add(tarmac);
  // runway centre dashes
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  for (let z = -70; z <= 70; z += 14) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 7), dashMat);
    d.position.set(270, 0.06, z); scene.add(d);
  }

  // --- roads ---------------------------------------------------------------
  const rTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: rTex });
  for (const r of ROADS) {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(620, ROAD_W), roadMat.clone());
    alongX.material.map = rTex.clone();
    alongX.material.map.repeat.set(620 / 16, 1);
    alongX.material.map.needsUpdate = true;
    alongX.rotation.x = -Math.PI / 2; alongX.position.set(0, 0.04, r);
    alongX.receiveShadow = true; scene.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(620, ROAD_W), roadMat.clone());
    alongZ.material.map = rTex.clone();
    alongZ.material.map.repeat.set(620 / 16, 1);
    alongZ.material.map.needsUpdate = true;
    alongZ.rotation.x = -Math.PI / 2; alongZ.rotation.z = Math.PI / 2;
    alongZ.position.set(r, 0.04, 0);
    alongZ.receiveShadow = true; scene.add(alongZ);
  }

  // --- buildings -----------------------------------------------------------
  const winMats = [
    new THREE.MeshLambertMaterial({ map: windowTexture('#7d8a99', '#ffd98a', 14, 6) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#5d6b7a', '#ffe9b0', 18, 8) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#8a7a68', '#cfe8ff', 10, 5) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#6b7d8a', '#ffd98a', 22, 8) }),
    new THREE.MeshLambertMaterial({ map: windowTexture('#9a8a7a', '#fff2b0', 8, 5) }),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4e });
  const houseMat = new THREE.MeshLambertMaterial({ color: 0xd8c9a8 });
  const houseMat2 = new THREE.MeshLambertMaterial({ color: 0xc9b8a0 });

  const specialBlocks = new Set([
    '-180,-180', // park
    '180,-180',  // casino
    '-180,180',  // hospital
    '240,0', '240,-60', '240,60', // airport tarmac block
    '-240,240', '-240,180', // docks
    '60,240',    // garage block (keep low, garage building)
  ]);

  let buildingCount = 0;
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const key = bx + ',' + bz;
      if (specialBlocks.has(key)) continue;
      const downtown = Math.abs(bx) <= 120 && Math.abs(bz) <= 120;
      const beachfront = bz === 240;
      if (downtown) {
        const n = randInt(2, 3);
        for (let i = 0; i < n; i++) {
          const w = rand(14, 22), d = rand(14, 22), h = rand(35, 110);
          const x = bx + rand(-14, 14), z = bz + rand(-14, 14);
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), choice(winMats));
          m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true;
          scene.add(m);
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 2, d * 0.7), roofMat);
          roof.position.set(x, h + 1, z); scene.add(roof);
          addCollider(x, z, w, d); buildingCount++;
        }
      } else if (beachfront) {
        // low beachfront hotels
        const w = rand(20, 30), d = rand(14, 18), h = rand(12, 22);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), choice(winMats));
        m.position.set(bx, h / 2, bz); m.castShadow = true;
        scene.add(m); addCollider(bx, bz, w, d); buildingCount++;
      } else {
        // houses / low shops
        const n = randInt(1, 2);
        for (let i = 0; i < n; i++) {
          const w = rand(10, 16), d = rand(10, 16), h = rand(6, 14);
          const x = bx + rand(-12, 12), z = bz + rand(-12, 12);
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.5 ? houseMat : houseMat2);
          m.position.set(x, h / 2, z); m.castShadow = true;
          scene.add(m); addCollider(x, z, w, d); buildingCount++;
        }
      }
    }
  }

  // --- landmarks -----------------------------------------------------------
  // Golden Palm Casino
  const casino = new THREE.Group();
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(34, 22, 26),
    new THREE.MeshLambertMaterial({ map: windowTexture('#7a5a2a', '#ffe27a', 6, 8) }));
  cBody.position.y = 11; cBody.castShadow = true; casino.add(cBody);
  const cSign = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5),
    new THREE.MeshBasicMaterial({ map: textTexture('GOLDEN PALM', 'CASINO • HOTEL', '#3a2408', '#ffd24d') }));
  cSign.position.set(0, 18, 13.2); casino.add(cSign);
  const cSign2 = cSign.clone(); cSign2.rotation.y = Math.PI; cSign2.position.z = -13.2; casino.add(cSign2);
  const cTower = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 12, 12),
    new THREE.MeshLambertMaterial({ color: 0xd8b45a }));
  cTower.position.set(0, 28, 0); casino.add(cTower);
  casino.position.set(180, 0, -180); scene.add(casino);
  addCollider(180, -180, 36, 28);

  // Vista General Hospital
  const hosp = new THREE.Group();
  const hBody = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 20),
    new THREE.MeshLambertMaterial({ color: 0xf2f2ee }));
  hBody.position.y = 9; hBody.castShadow = true; hosp.add(hBody);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ map: textTexture('+', '', '#c02020', '#ffffff') }));
  cross.position.set(0, 14, 10.2); hosp.add(cross);
  const hSign = new THREE.Mesh(new THREE.PlaneGeometry(24, 4),
    new THREE.MeshBasicMaterial({ map: textTexture('VISTA GENERAL', 'HOSPITAL', '#ffffff', '#2050a0') }));
  hSign.position.set(0, 8, 10.2); hosp.add(hSign);
  hosp.position.set(-180, 0, 180); scene.add(hosp);
  addCollider(-180, 180, 32, 22);

  // Mara's Garage (player home base)
  const gar = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 14),
    new THREE.MeshLambertMaterial({ color: 0x3a6a8a }));
  gBody.position.y = 3.5; gBody.castShadow = true; gar.add(gBody);
  const gSign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3),
    new THREE.MeshBasicMaterial({ map: textTexture("MARA'S GARAGE", 'REPAIRS • STORAGE', '#12303f', '#7fd4ff') }));
  gSign.position.set(0, 5.5, 7.2); gar.add(gSign);
  gar.position.set(60, 0, 240); scene.add(gar);
  addCollider(60, 240, 22, 16);

  // Airport terminal
  const term = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 40),
    new THREE.MeshLambertMaterial({ color: 0xdde3e8 }));
  term.position.set(246, 4.5, 0); term.castShadow = true; scene.add(term);
  addCollider(246, 0, 18, 42);
  // parked plane (simple: fuselage + wings + tail)
  const plane = new THREE.Group();
  const pMat = new THREE.MeshLambertMaterial({ color: 0xe8ecf0 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 10), pMat);
  fus.rotation.x = Math.PI / 2; plane.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 5), pMat);
  plane.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 3), pMat);
  tail.position.set(0, 1.5, -12); plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 3), new THREE.MeshLambertMaterial({ color: 0x2a6ab8 }));
  fin.position.set(0, 3, -12); plane.add(fin);
  plane.position.set(282, 2.4, -40); plane.rotation.y = 0.3;
  scene.add(plane);

  // Harbor docks: containers + cranes
  const contCols = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3),
      new THREE.MeshLambertMaterial({ color: choice(contCols) }));
    const x = -258 + rand(-8, 8), z = 168 + i * 9;
    c.position.set(x, 1.5 + (i % 3 === 0 ? 3 : 0), z);
    c.rotation.y = rand(-0.1, 0.1); c.castShadow = true;
    scene.add(c); addCollider(x, z, 10, 3);
  }
  // crane
  const crane = new THREE.Group();
  const crMat = new THREE.MeshLambertMaterial({ color: 0xd4ac0d });
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 26, 1.5), crMat); leg1.position.set(-3, 13, 0);
  const leg2 = leg1.clone(); leg2.position.x = 3;
  const top = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 1.5), crMat); top.position.set(2, 26, 0);
  crane.add(leg1, leg2, top);
  crane.position.set(-252, 0, 240); scene.add(crane);
  addCollider(-252, 240, 8, 4);

  // Pier: wooden deck out into the sea, low enough to walk and drive on
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 84), pierMat);
  deck.position.set(0, 0.15, 342); deck.castShadow = true; scene.add(deck);
  for (let z = 306; z <= 378; z += 12) {
    for (const x of [-5, 5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 6), pierMat);
      post.position.set(x, -0.6, z); scene.add(post);
    }
  }
  const pierSign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: textTexture('VISTA PIER', 'FISH • FOOD • FUN', '#12303f', '#ffd24d') }));
  pierSign.position.set(0, 6, 300); scene.add(pierSign);

  // Park: palms, benches, fountain
  for (let i = 0; i < 14; i++) {
    addPalm(-180 + rand(-26, 26), -180 + rand(-26, 26));
  }
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
  fountain.position.set(-180, 0.6, -180); scene.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.4, 16),
    new THREE.MeshLambertMaterial({ color: 0x4aa8d8 }));
  water.position.set(-180, 1.1, -180); scene.add(water);

  // Palm Avenue: palms along the two central roads
  for (let x = -260; x <= 260; x += 26) {
    for (const z of [24, 36, -24, -36]) {
      if (Math.abs(x) < 8) continue;
      addPalm(x + rand(-2, 2), z + rand(-1, 1));
    }
  }
  // beachfront palms
  for (let x = -280; x <= 280; x += 24) {
    addPalm(x, 246 + rand(-2, 2));
  }

  // street lamps at intersections
  for (const x of ROADS) {
    for (const z of ROADS) {
      if ((x + z) % 120 !== 0) continue;
      lampPositions.push([x + 8, z + 8]);
    }
  }
  buildPalms(scene);
  buildLamps(scene);

  // Road graph: intersections + adjacency for traffic AI.
  const nodes = [];
  const nodeIndex = new Map();
  for (let ix = 0; ix < ROADS.length; ix++) {
    for (let iz = 0; iz < ROADS.length; iz++) {
      const id = ix * ROADS.length + iz;
      nodeIndex.set(ix + ',' + iz, id);
      nodes.push({ id, x: ROADS[ix], z: ROADS[iz], ix, iz });
    }
  }
  function neighbors(id) {
    const n = nodes[id];
    const out = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of dirs) {
      const k = (n.ix + dx) + ',' + (n.iz + dz);
      if (nodeIndex.has(k)) out.push(nodeIndex.get(k));
    }
    return out;
  }
  function nearestNode(x, z) {
    let best = 0, bd = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  G.city = {
    colliders, nodes, neighbors, nearestNode,
    buildingCount,
    landmarks: LANDMARKS,
  };
  return G.city;
}

// Circle (radius r) vs building AABBs: push the point out. Returns true if hit.
export function collideCircle(G, x, z, r) {
  for (const c of G.city.colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        return { x: cx + (dx / d) * r, z: cz + (dz / d) * r, hit: true };
      }
      return { x: x + r, z, hit: true };
    }
  }
  return { x, z, hit: false };
}

export function insideCity(x, z) {
  return Math.abs(x) < CITY_HALF - 4 && Math.abs(z) < CITY_HALF - 4;
}
