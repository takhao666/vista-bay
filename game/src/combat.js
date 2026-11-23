// combat.js — pistol raycast shooting with tracers, fists, hostile goons
// who shoot back, and destructible cars. Gunfire makes pedestrians flee.

import * as THREE from 'three';
import { clamp, rand, dist2D } from './state.js';
import { createHumanoid } from './pedestrians.js';

const RAY = new THREE.Raycaster();

export class Combat {
  constructor(G) {
    this.G = G;
    this.tracers = [];
    this.enemies = []; // mission goons
    this.shotCooldown = 0;
    this.punchCooldown = 0;
  }

  // --- enemies -------------------------------------------------------------
  spawnEnemy(x, z, opts = {}) {
    const G = this.G;
    const mesh = createHumanoid(opts.shirt ?? 0x8a1a1a, 0x1a1a1a, 0xc98d5f);
    // gun in hand
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.25, 0.3);
    mesh.add(gun);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const e = {
      mesh, x, z, heading: 0, health: 100,
      shootT: rand(0.8, 2), dead: false, name: opts.name || 'Rook\'s goon',
      boss: !!opts.boss,
    };
    if (e.boss) {
      e.health = 300;
      mesh.scale.set(1.15, 1.15, 1.15);
    }
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.G.scene.remove(e.mesh);
    this.enemies = [];
  }

  updateEnemies(dt) {
    const G = this.G;
    const px = G.player.pos.x, pz = G.player.pos.z;
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      const d = dist2D(e.x, e.z, px, pz);
      // face the player and shoot back when close enough
      e.heading = Math.atan2(px - e.x, pz - e.z);
      e.mesh.rotation.y = e.heading;
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 46 && !G.state.over) {
        e.shootT = rand(1.1, 2.1);
        this.enemyShoot(e, d);
      }
      // strafe a little so they don't stand perfectly still
      if (d > 14) {
        e.x += Math.sin(e.heading) * 1.6 * dt;
        e.z += Math.cos(e.heading) * 1.6 * dt;
        e.mesh.position.set(e.x, 0, e.z);
      }
    }
  }

  enemyShoot(e, dist) {
    const G = this.G;
    const from = new THREE.Vector3(e.x, 1.4, e.z);
    const to = new THREE.Vector3(G.player.pos.x, 1.2, G.player.pos.z);
    this.addTracer(from, to);
    G.audio.enemyShot();
    // hit chance falls with distance; the player can dodge behind cover
    const hitChance = clamp(0.42 - dist * 0.006, 0.08, 0.42);
    if (Math.random() < hitChance) {
      G.player.takeDamage(e.boss ? 14 : 9);
      G.hud.showToast('You\'re hit!');
    }
  }

  // --- player attacks ------------------------------------------------------
  shoot() {
    const G = this.G;
    if (G.state.weapon !== 'pistol') { this.punch(); return; }
    if (this.shotCooldown > 0 || G.state.over) return;
    if (G.state.ammo <= 0) {
      G.audio.dryFire();
      G.hud.showToast('Out of ammo — press R to reload');
      this.shotCooldown = 0.25;
      return;
    }
    this.shotCooldown = 0.22;
    G.state.ammo--;
    G.audio.gunshot();
    G.peds.fleeFrom(G.player.pos.x, G.player.pos.z);
    if (G.state.wanted < 2) G.police.addWanted(1, 'Shots fired');

    // raycast from the camera through the crosshair
    RAY.setFromCamera(new THREE.Vector2(0, 0), G.camera);
    RAY.far = 120;
    const targets = [];
    for (const ped of G.peds.list) if (!ped.dead) targets.push(ped.mesh);
    for (const e of this.enemies) if (!e.dead) targets.push(e.mesh);
    for (const c of G.police.cops) if (!c.dead) targets.push(c.mesh);
    for (const car of G.vehicles.allCars()) if (!car.wrecked) targets.push(car.mesh);
    const hits = RAY.intersectObjects(targets, true);
    const origin = G.camera.position.clone();
    let end;
    if (hits.length) {
      const h = hits[0];
      end = h.point.clone();
      this.applyHit(h.object, h.point);
    } else {
      end = origin.clone().add(RAY.ray.direction.clone().multiplyScalar(90));
    }
    // tracer from the player's gun to the hit point
    const muzzle = G.player.onFoot
      ? new THREE.Vector3(G.player.pos.x, 1.3, G.player.pos.z)
      : new THREE.Vector3(G.player.car.x, 1.2, G.player.car.z);
    this.addTracer(muzzle, end);
    G.hud.muzzleFlash();
  }

  applyHit(obj, point) {
    const G = this.G;
    // walk up the hierarchy to find the tagged root
    let node = obj;
    while (node && !node.userData.parts && !node.userData.isCar) node = node.parent;
    if (!node) return;
    if (node.userData.isCar) {
      const car = G.vehicles.allCars().find(c => c.mesh === node);
      if (car) {
        G.vehicles.damageCar(car, 22, true);
        if (car.police) G.police.addWanted(1, 'Attacking police');
      }
      return;
    }
    // humanoid: find which list owns it
    for (const ped of G.peds.list) {
      if (ped.mesh === node && !ped.dead) { G.peds.die(ped, true); return; }
    }
    for (const e of this.enemies) {
      if (e.mesh === node && !e.dead) {
        e.health -= 34;
        this.bloodBurst(point);
        if (e.health <= 0) {
          e.dead = true;
          e.mesh.rotation.x = -Math.PI / 2;
          e.mesh.position.y = 0.3;
          G.state.totalKills++;
          G.hud.showToast((e.boss ? 'ROOK IS DOWN!' : 'Goon down.'));
          if (e.boss) G.audio.sting();
        }
        return;
      }
    }
    for (const c of G.police.cops) {
      if (c.mesh === node && !c.dead) {
        c.dead = true;
        G.state.totalKills++;
        G.police.addWanted(1, 'Killing an officer');
        return;
      }
    }
  }

  bloodBurst(point) {
    const G = this.G;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xa02020, transparent: true, opacity: 0.9 }));
    m.position.copy(point);
    G.scene.add(m);
    this.tracers.push({ mesh: m, t: 0, life: 0.35, blood: true });
  }

  punch() {
    const G = this.G;
    if (this.punchCooldown > 0 || G.state.over) return;
    this.punchCooldown = 0.45;
    G.audio.punch();
    const px = G.player.pos.x, pz = G.player.pos.z;
    const fx = Math.sin(G.player.heading), fz = Math.cos(G.player.heading);
    const tryHit = (list, dmg, kill) => {
      for (const o of list) {
        if (o.dead) continue;
        const dx = o.x - px, dz = o.z - pz;
        if (Math.hypot(dx, dz) < 2.3 && dx * fx + dz * fz > 0) {
          if (kill) { o.health -= dmg; if (o.health <= 0) { o.dead = true; o.mesh.rotation.x = -Math.PI / 2; o.mesh.position.y = 0.3; G.state.totalKills++; } }
          else if (o.mesh === undefined) return false;
          return true;
        }
      }
      return false;
    };
    // goons first, then cops, then peds
    if (tryHit(this.enemies, 26, true)) return;
    for (const c of G.police.cops) {
      if (!c.dead && dist2D(c.x, c.z, px, pz) < 2.3) {
        c.dead = true;
        G.state.totalKills++;
        G.police.addWanted(1, 'Assaulting an officer');
        return;
      }
    }
    for (const ped of G.peds.list) {
      if (!ped.dead && dist2D(ped.x, ped.z, px, pz) < 2.3) {
        G.peds.die(ped, true);
        return;
      }
    }
  }

  reload() {
    const G = this.G;
    if (G.state.weapon !== 'pistol') return;
    const need = 12 - G.state.ammo;
    if (need <= 0 || G.state.reserveAmmo <= 0) return;
    const take = Math.min(need, G.state.reserveAmmo);
    G.state.ammo += take;
    G.state.reserveAmmo -= take;
    G.audio.reload();
    G.hud.showToast('Reloaded — ' + G.state.ammo + '/12');
  }

  addTracer(from, to) {
    const G = this.G;
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.95,
    }));
    G.scene.add(line);
    this.tracers.push({ mesh: line, t: 0, life: 0.09 });
  }

  update(dt) {
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      if (tr.t >= tr.life) {
        this.G.scene.remove(tr.mesh);
        this.tracers.splice(i, 1);
      } else if (!tr.blood) {
        tr.mesh.material.opacity = 0.95 * (1 - tr.t / tr.life);
      }
    }
    this.updateEnemies(dt);
  }
}
