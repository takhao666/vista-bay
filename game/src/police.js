// police.js — 5-star wanted system: police cars chase and ram, foot cops grab,
// roadblocks at high heat, heat decays when the player hides, busted/wasted.

import * as THREE from 'three';
import { clamp, lerp, rand, randInt, choice, angleTurn, angleDiff, headingTo, dist2D } from './state.js';
import { collideCircle } from './city.js';
import { createHumanoid } from './pedestrians.js';

export class PoliceSystem {
  constructor(G) {
    this.G = G;
    this.cars = [];   // police pursuit cars (also used as roadblock cars)
    this.cops = [];   // foot officers
    this.sirenOn = false;
    this.flashT = 0;  // light-bar phase
    this.bustedProgress = 0;
    this.bustedToastT = 0;
    this.roadblockT = 0;
  }

  wantedCount() { return this.G.state.wanted; }

  addWanted(n, reason) {
    const G = this.G;
    if (G.state.wanted >= 5) return;
    G.state.wanted = clamp(G.state.wanted + n, 0, 5);
    G.state.heat = 0;
    G.state.wantedDecay = 0;
    if (n > 0) G.hud.showToast('WANTED: ' + reason + ' — ' + G.state.wanted + ' star' + (G.state.wanted > 1 ? 's' : ''));
    this.syncSiren();
  }

  clearWanted() {
    this.G.state.wanted = 0;
    this.syncSiren();
  }

  syncSiren() {
    const on = this.G.state.wanted > 0;
    if (on !== this.sirenOn) {
      this.sirenOn = on;
      this.G.audio.setSiren(on);
    }
  }

  spawnPoliceCar(nearX, nearZ) {
    const G = this.G;
    // spawn on a road intersection 60-110m from the player
    const candidates = G.city.nodes.filter(n => {
      const d = dist2D(n.x, n.z, nearX, nearZ);
      return d >= 55 && d <= 115;
    });
    const n = candidates.length ? choice(candidates) : G.city.nodes[G.city.nearestNode(nearX + 80, nearZ)];
    const car = G.vehicles.makeCar(n.x, n.z, rand(Math.PI * 2), 0xf5f5f5, { police: true, kind: 'police' });
    car.cruise = 14;
    this.cars.push(car);
    return car;
  }

  spawnFootCop(x, z) {
    const G = this.G;
    const mesh = createHumanoid(0x1a3a6a, 0x1a1a1a, 0xe8b98a);
    // police cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x1a3a6a }));
    cap.position.y = 1.92; mesh.add(cap);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const cop = { mesh, x, z, heading: 0, speed: 6.9, walkPhase: rand(6), dead: false };
    this.cops.push(cop);
    return cop;
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.G.scene.remove(car.mesh);
  }

  removeCop(cop) {
    const i = this.cops.indexOf(cop);
    if (i >= 0) this.cops.splice(i, 1);
    this.G.scene.remove(cop.mesh);
  }

  clearAll() {
    for (const c of [...this.cars]) this.removeCar(c);
    for (const c of [...this.cops]) this.removeCop(c);
    this.bustedProgress = 0;
  }

  update(dt) {
    const G = this.G;
    const wanted = G.state.wanted;
    const px = G.player.pos.x, pz = G.player.pos.z;

    // --- keep the pursuit force at the right size ---
    const wantCars = wanted === 0 ? 0 : Math.min(wanted, 5);
    if (this.cars.length < wantCars && G.state.started && !G.state.over) {
      this.spawnPoliceCar(px, pz);
    }
    if (this.cars.length > wantCars) {
      // retire the farthest car
      let far = this.cars[0], fd = -1;
      for (const c of this.cars) {
        const d = dist2D(c.x, c.z, px, pz);
        if (d > fd) { fd = d; far = c; }
      }
      this.removeCar(far);
    }
    const wantCops = wanted >= 2 && G.player.onFoot ? Math.min(wanted - 1, 3) : 0;
    if (this.cops.length < wantCops) {
      const a = rand(Math.PI * 2);
      this.spawnFootCop(px + Math.sin(a) * rand(25, 45), pz + Math.cos(a) * rand(25, 45));
    }
    if (this.cops.length > wantCops) this.removeCop(this.cops[this.cops.length - 1]);

    // --- light bars flash on every police car, held or chasing ---
    this.flashT += dt;
    const phase = Math.floor(this.flashT * 6) % 2 === 0;
    for (const car of this.cars) {
      if (!car.mesh.userData.redLight) continue;
      car.mesh.userData.redLight.material.color.setHex(phase ? 0xff2020 : 0x400000);
      car.mesh.userData.blueLight.material.color.setHex(phase ? 0x102060 : 0x2040ff);
    }

    // --- heat decay: hide from the police and the stars fade ---
    if (wanted > 0) {
      let nearest = Infinity;
      for (const c of this.cars) nearest = Math.min(nearest, dist2D(c.x, c.z, px, pz));
      for (const c of this.cops) nearest = Math.min(nearest, dist2D(c.x, c.z, px, pz));
      const hidden = nearest > 85;
      G.state.heat += dt;
      if (hidden) {
        G.state.wantedDecay += dt;
        if (G.state.wantedDecay > 9) {
          G.state.wantedDecay = 0;
          G.state.wanted--;
          G.hud.showToast('Heat cooling off… ' + G.state.wanted + ' star' + (G.state.wanted === 1 ? '' : 's') + ' left');
          this.syncSiren();
        }
      } else {
        G.state.wantedDecay = Math.max(0, G.state.wantedDecay - dt * 0.5);
      }
    }

    // --- roadblocks at 4+ stars: a held police car blocks the road ahead ---
    if (wanted >= 4) {
      this.roadblockT -= dt;
      if (this.roadblockT <= 0 && this.cars.filter(c => c.hold).length < 2) {
        this.roadblockT = 14;
        const h = G.player.heading;
        const bx = px + Math.sin(h) * 45, bz = pz + Math.cos(h) * 45;
        const car = this.spawnPoliceCar(bx, bz);
        car.hold = true;
        car.x = bx; car.z = bz;
        car.heading = h + Math.PI / 2; // sideways across the road
        car.mesh.position.set(bx, 0, bz);
        car.mesh.rotation.y = car.heading;
        G.hud.showToast('Roadblock ahead!');
      }
    }

    // --- pursuit cars ---
    for (const car of [...this.cars]) {
      if (car.wrecked) { this.removeCar(car); continue; }
      if (car.hold) continue; // roadblock car stays put (lights still flash above)
      const d = dist2D(car.x, car.z, px, pz);
      const desired = headingTo(car.x, car.z, px, pz);
      car.heading = angleTurn(car.heading, desired, 2.4 * dt);
      const maxSpd = 15 + wanted * 1.4;
      const targetSpeed = d > 6 ? maxSpd : maxSpd * 0.4;
      car.speed = lerp(car.speed, targetSpeed, clamp(dt * 1.8, 0, 1));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const hit = collideCircle(G, car.x, car.z, 2.1);
      if (hit.hit) { car.x = hit.x; car.z = hit.z; car.speed *= 0.5; }
      // ram the player's car
      if (G.player.car && d < 4.6) {
        const pc = G.player.car;
        const ux = (pc.x - car.x) / (d || 1), uz = (pc.z - car.z) / (d || 1);
        pc.x += ux * 2.4 * dt * 10; pc.z += uz * 2.4 * dt * 10;
        pc.speed *= 0.985;
        if (Math.abs(pc.speed) > 6) G.vehicles.damageCar(pc, 2 * dt, false);
        G.audio.crashSoft();
      }
      // if the player is on foot and a police car gets close, officers pile out
      if (G.player.onFoot && d < 9 && this.cops.length < 3 && wanted >= 2) {
        this.spawnFootCop(car.x + rand(-3, 3), car.z + rand(-3, 3));
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }

    // --- foot cops ---
    let copNear = false;
    for (const cop of [...this.cops]) {
      if (cop.dead) { this.removeCop(cop); continue; }
      const d = dist2D(cop.x, cop.z, px, pz);
      if (d < 2.2) copNear = true;
      const desired = headingTo(cop.x, cop.z, px, pz);
      cop.heading = angleTurn(cop.heading, desired, 4 * dt);
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      const hit = collideCircle(G, cop.x, cop.z, 0.5);
      if (hit.hit) { cop.x = hit.x; cop.z = hit.z; }
      cop.walkPhase += dt * 9;
      const parts = cop.mesh.userData.parts;
      const swing = Math.sin(cop.walkPhase) * 0.8;
      parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
      parts.armL.rotation.x = -swing; parts.armR.rotation.x = swing;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      // cop too far away for too long gives up (despawn at 120m)
      if (d > 130) this.removeCop(cop);
    }

    // --- busted: a cop holds the player, or the car is boxed in at low speed ---
    if (G.state.started && !G.state.over && wanted > 0) {
      this.bustedToastT = Math.max(0, this.bustedToastT - dt);
      if (copNear) {
        this.bustedProgress += dt;
        // warn once every couple of seconds, not every frame
        if (this.bustedToastT <= 0) {
          this.bustedToastT = 2;
          G.hud.showToast('The cops have you! Break away!');
        }
      } else if (G.player.car && Math.abs(G.player.car.speed) < 0.5) {
        let adjacent = 0;
        for (const c of this.cars) if (dist2D(c.x, c.z, px, pz) < 6) adjacent++;
        if (adjacent >= 2) this.bustedProgress += dt * 0.7;
        else this.bustedProgress = Math.max(0, this.bustedProgress - dt);
      } else {
        this.bustedProgress = Math.max(0, this.bustedProgress - dt * 2);
      }
      if (this.bustedProgress > 1.4) {
        this.bustedProgress = 0;
        G.gameOver('busted');
      }
    }
  }
}
