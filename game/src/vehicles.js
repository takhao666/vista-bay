// vehicles.js — car models, road traffic AI, parked (stealable) cars,
// player driving physics, and destructible cars.
// Heading convention: forward = (sin h, 0, cos h); heading = atan2(dx, dz).

import * as THREE from 'three';
import { clamp, lerp, rand, randInt, choice, angleTurn, angleDiff, headingTo, dist2D } from './state.js';
import { collideCircle } from './city.js';

const CAR_COLORS = [0xc0392b, 0x2471a3, 0x1e8449, 0xd4ac0d, 0x7d3c98, 0xe67e22, 0x95a5a6, 0x2c3e50, 0xf5f5f5, 0x16a085, 0xb03a2e, 0x5d6d7e];
const TRAFFIC_COUNT = 26;
const PARKED_COUNT = 18;

// --- shared car geometry: one body box + one merged "dark parts" geometry
// (cabin + 4 wheels) reused by every car, so each car is 2 draw calls. ---
function xg(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(m);
  return geo;
}
function mergeGeoms(list) {
  const pos = [], norm = [], uv = [];
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    norm.push(...ng.attributes.normal.array);
    uv.push(...ng.attributes.uv.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}
const BODY_GEO = new THREE.BoxGeometry(1.9, 0.62, 4.4);
const DARK_GEO = mergeGeoms([
  xg(new THREE.BoxGeometry(1.7, 0.55, 2.2), 0, 1.08, -0.2),
  ...[[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]].map(([wx, wz]) =>
    xg(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), wx, 0.36, wz, 0, 0, Math.PI / 2)),
]);
const DARK_MAT = new THREE.MeshLambertMaterial({ color: 0x1a2028 });

export function createCarModel(color, opts = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(BODY_GEO, new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const dark = new THREE.Mesh(DARK_GEO, DARK_MAT);
  dark.castShadow = true; g.add(dark);
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.42, -0.2); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 1.44, -0.2); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 1.44, -0.2); g.add(blue);
    g.userData.redLight = red; g.userData.blueLight = blue;
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x103060 }));
    badge.position.set(-0.96, 0.6, 0.2); badge.rotation.y = -Math.PI / 2; g.add(badge);
  }
  if (opts.armored) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 2.6),
      new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
    box.position.set(0, 1.1, -0.4); g.add(box);
  }
  g.userData.isCar = true;
  return g;
}

export class VehicleSystem {
  constructor(G) {
    this.G = G;
    this.traffic = [];   // AI cars on the road network
    this.parked = [];    // stealable parked cars
    this.specials = [];  // mission trucks / convoy vehicles
    this.explosions = [];
  }

  makeCar(x, z, heading, color, opts = {}) {
    const mesh = createCarModel(color, opts);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.G.scene.add(mesh);
    const car = {
      mesh, x, z, heading, speed: 0,
      health: opts.armored ? 220 : 100,
      maxHealth: opts.armored ? 220 : 100,
      color, kind: opts.kind || 'car',
      police: !!opts.police, armored: !!opts.armored,
      stolen: false, wrecked: false, hold: false,
      from: -1, to: -1, targetX: x, targetZ: z,
      cruise: rand(9, 13),
      honkT: rand(5, 20),
    };
    return car;
  }

  init() {
    const G = this.G;
    // Traffic cars on random intersections.
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      const n = choice(G.city.nodes);
      const car = this.makeCar(n.x + rand(-4, 4), n.z + rand(-4, 4), rand(Math.PI * 2), choice(CAR_COLORS));
      car.from = n.id;
      const nb = G.city.neighbors(n.id);
      car.to = choice(nb);
      this.setTrafficTarget(car);
      car.speed = rand(6, 11);
      this.traffic.push(car);
    }
    // Parked cars along road edges (stealable).
    let placed = 0, guard = 0;
    while (placed < PARKED_COUNT && guard++ < 400) {
      const road = choice([-270, -210, -150, -90, -30, 30, 90, 150, 210, 270]);
      const along = rand(-270, 270);
      const horiz = Math.random() < 0.5;
      const x = horiz ? along : road + (Math.random() < 0.5 ? 5.2 : -5.2);
      const z = horiz ? road + (Math.random() < 0.5 ? 5.2 : -5.2) : along;
      if (Math.abs(x) > 292 || Math.abs(z) > 292) continue;
      if (dist2D(x, z, 0, 0) < 25) continue;
      if (this.parked.some(p => dist2D(p.x, p.z, x, z) < 14)) continue;
      const heading = horiz ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const car = this.makeCar(x, z, heading, choice(CAR_COLORS));
      car.kind = 'parked';
      this.parked.push(car);
      placed++;
    }
  }

  setTrafficTarget(car) {
    const G = this.G;
    const to = G.city.nodes[car.to];
    const from = car.from >= 0 ? G.city.nodes[car.from] : null;
    let tx = to.x, tz = to.z;
    if (from) {
      // Right-hand lane: offset the target point to the right of travel.
      const dx = to.x - from.x, dz = to.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      const rx = dz / len, rz = -dx / len; // right of (dx,dz) in xz plane
      tx += rx * 2.8; tz += rz * 2.8;
    }
    car.targetX = tx; car.targetZ = tz;
  }

  updateTraffic(dt) {
    const G = this.G;
    for (const car of this.traffic) {
      if (car.wrecked) continue;
      const d = dist2D(car.x, car.z, car.targetX, car.targetZ);
      if (d < 5) {
        const next = G.city.neighbors(car.to).filter(n => n !== car.from);
        car.from = car.to;
        car.to = next.length ? choice(next) : choice(G.city.neighbors(car.to));
        this.setTrafficTarget(car);
      }
      const desired = headingTo(car.x, car.z, car.targetX, car.targetZ);
      const turn = angleDiff(car.heading, desired);
      car.heading = angleTurn(car.heading, desired, 1.7 * dt);
      // slow for sharp turns and when a car is right ahead
      let targetSpeed = car.cruise * clamp(1 - Math.abs(turn) * 0.55, 0.35, 1);
      for (const o of this.allCars()) {
        if (o === car || o.wrecked) continue;
        const dd = dist2D(car.x, car.z, o.x, o.z);
        if (dd < 7) {
          const ah = Math.abs(angleDiff(car.heading, headingTo(car.x, car.z, o.x, o.z)));
          if (ah < 0.6) { targetSpeed = 0; break; }
        }
      }
      car.speed = lerp(car.speed, targetSpeed, clamp(dt * 1.6, 0, 1));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const hit = collideCircle(G, car.x, car.z, 2.1);
      if (hit.hit) { car.x = hit.x; car.z = hit.z; car.speed *= 0.4; }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  allCars() {
    return [...this.traffic, ...this.parked, ...this.specials, ...this.G.police.cars];
  }

  nearestParked(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const car of this.parked) {
      if (car.wrecked) continue;
      const d = dist2D(pos.x, pos.z, car.x, car.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  // Player enters a car (steal or re-enter). Returns true on success.
  enterCar(car, stolen) {
    const G = this.G;
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
    const j = this.traffic.indexOf(car);
    if (j >= 0) this.traffic.splice(j, 1);
    const k = this.specials.indexOf(car);
    if (k >= 0) this.specials.splice(k, 1);
    car.kind = 'player';
    if (stolen && !car.stolen) {
      car.stolen = true;
      G.state.carsStolen++;
      G.police.addWanted(1, 'Grand theft auto');
      G.hud.showToast('Car stolen! The cops are onto you.');
      G.audio.sirenBurst();
    }
    G.player.car = car;
    G.player.onFoot = false;
    return true;
  }

  exitCar() {
    const G = this.G;
    const car = G.player.car;
    if (!car) return;
    car.speed = 0;
    car.kind = 'parked';
    this.parked.push(car);
    G.player.car = null;
    G.player.onFoot = true;
    // step out beside the car
    const sx = car.x + Math.cos(car.heading) * 2.4;
    const sz = car.z - Math.sin(car.heading) * 2.4;
    G.player.pos.set(sx, 0, sz);
    G.player.heading = car.heading;
  }

  // Arcade driving for the player's car.
  updatePlayerCar(dt) {
    const G = this.G;
    const car = G.player.car;
    if (!car) return;
    const inp = G.input;
    const fwd = inp.keys.has('KeyW') || inp.keys.has('ArrowUp');
    const back = inp.keys.has('KeyS') || inp.keys.has('ArrowDown');
    const left = inp.keys.has('KeyA') || inp.keys.has('ArrowLeft');
    const right = inp.keys.has('KeyD') || inp.keys.has('ArrowRight');
    const brake = inp.keys.has('Space');
    const maxSpeed = car.armored ? 30 : 40;
    if (fwd) car.speed += 15 * dt;
    if (back) car.speed -= (car.speed > 0.5 ? 22 : 9) * dt;
    if (brake) car.speed = lerp(car.speed, 0, clamp(dt * 4, 0, 1));
    if (!fwd && !back) car.speed = lerp(car.speed, 0, clamp(dt * 0.9, 0, 1));
    car.speed = clamp(car.speed, -11, maxSpeed);
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const steerFactor = clamp(Math.abs(car.speed) / 8, 0, 1);
    if (Math.abs(car.speed) > 0.2) {
      car.heading += steer * 1.5 * steerFactor * dt * Math.sign(car.speed);
    }
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hit = collideCircle(G, nx, nz, 2.1);
    if (hit.hit) {
      car.x = hit.x; car.z = hit.z;
      if (Math.abs(car.speed) > 12) { this.damageCar(car, 12, false); G.audio.crash(); }
      car.speed *= -0.25;
    } else {
      car.x = nx; car.z = nz;
    }
    car.x = clamp(car.x, -296, 296); car.z = clamp(car.z, -296, 296);
    // bump into other cars
    for (const o of this.allCars()) {
      if (o === car || o.wrecked) continue;
      const d = dist2D(car.x, car.z, o.x, o.z);
      if (d < 4.2 && d > 0.01) {
        const push = (4.2 - d) * 0.5;
        const ux = (o.x - car.x) / d, uz = (o.z - car.z) / d;
        o.x += ux * push; o.z += uz * push;
        o.mesh.position.set(o.x, 0, o.z);
        if (Math.abs(car.speed) > 8) {
          this.damageCar(o, 15, true);
          car.speed *= 0.6;
          G.audio.crash();
          if (o.police) G.police.addWanted(1, 'Assaulting an officer');
        }
      }
    }
    // run over pedestrians
    for (const ped of G.peds.list) {
      if (ped.dead) continue;
      const d = dist2D(car.x, car.z, ped.x, ped.z);
      if (d < 2.4 && Math.abs(car.speed) > 3) {
        ped.die(true);
        G.police.addWanted(1, 'Hit and run');
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    G.player.pos.set(car.x, 0, car.z);
    G.player.heading = car.heading;
    G.state.distanceDriven += Math.abs(car.speed) * dt;
    // engine sound follows speed
    G.audio.setEngine(Math.abs(car.speed) / maxSpeed, !!car);
  }

  damageCar(car, dmg, byPlayer) {
    if (car.wrecked) return;
    car.health -= dmg;
    if (car.health <= 0) this.explodeCar(car);
    else if (car.health < 40) this.smoke(car);
  }

  smoke(car) {
    if (car.smoking) return;
    car.smoking = true;
    const mat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.55 });
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), mat);
    puff.position.y = 1.6;
    car.mesh.add(puff);
    car.smokeMesh = puff;
  }

  explodeCar(car) {
    const G = this.G;
    car.wrecked = true;
    car.speed = 0;
    car.mesh.traverse(o => {
      if (o.isMesh) o.material = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
    });
    if (car.smokeMesh) car.mesh.remove(car.smokeMesh);
    // fireball
    const fire = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.95 }));
    fire.position.set(car.x, 1.6, car.z);
    G.scene.add(fire);
    const light = new THREE.PointLight(0xff8a00, 60, 40);
    light.position.set(car.x, 3, car.z);
    G.scene.add(light);
    this.explosions.push({ mesh: fire, light, t: 0 });
    G.audio.explosion();
    G.hud.shake(0.5);
    // splash damage
    const pd = dist2D(car.x, car.z, G.player.pos.x, G.player.pos.z);
    if (pd < 8 && G.player.onFoot) G.player.takeDamage(35);
    for (const ped of G.peds.list) {
      if (!ped.dead && dist2D(car.x, car.z, ped.x, ped.z) < 7) ped.die(true);
    }
    for (const o of this.allCars()) {
      if (o !== car && !o.wrecked && dist2D(car.x, car.z, o.x, o.z) < 7) this.damageCar(o, 60, false);
    }
    if (G.player.car === car) {
      G.player.car = null;
      G.player.onFoot = true;
      G.player.pos.set(car.x + 3, 0, car.z + 3);
      G.player.takeDamage(25);
    }
  }

  updateExplosions(dt) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.t += dt;
      const s = 1 + e.t * 4;
      e.mesh.scale.set(s, s * 0.8, s);
      e.mesh.material.opacity = Math.max(0, 0.95 - e.t * 1.8);
      e.light.intensity = Math.max(0, 60 - e.t * 120);
      if (e.t > 0.55) {
        this.G.scene.remove(e.mesh);
        this.G.scene.remove(e.light);
        this.explosions.splice(i, 1);
      }
    }
  }

  update(dt) {
    this.updateTraffic(dt);
    this.updatePlayerCar(dt);
    this.updateExplosions(dt);
  }
}
