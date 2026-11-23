// pedestrians.js — 42 city pedestrians: sidewalk strollers who flee gunfire,
// plus the shared low-poly humanoid factory used by peds, cops and goons.

import * as THREE from 'three';
import { rand, randInt, choice, angleTurn, headingTo, dist2D } from './state.js';
import { collideCircle } from './city.js';

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a34, 0xf0c8a0];
const SHIRTS = [0xd94f30, 0x2a6ab8, 0x3a9a4a, 0xe8b13a, 0x7d3c98, 0xe0e0e0, 0x222222, 0xc96a9a];
const PANTS = [0x2c3e50, 0x5d6d7e, 0x1a1a1a, 0x7a5a3a];

// Build a simple articulated humanoid. Returns { group, parts:{legL,legR,armL,armR,head} }.
export function createHumanoid(shirt, pants, skin) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.24);
  const legL = new THREE.Mesh(legGeo, pantsMat); legL.position.set(-0.14, 0.4, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat); legR.position.set(0.14, 0.4, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
  head.position.y = 1.72;
  const armGeo = new THREE.BoxGeometry(0.16, 0.66, 0.18);
  const armL = new THREE.Mesh(armGeo, shirtMat); armL.position.set(-0.4, 1.2, 0);
  const armR = new THREE.Mesh(armGeo, shirtMat); armR.position.set(0.4, 1.2, 0);
  for (const m of [legL, legR, torso, head, armL, armR]) { m.castShadow = true; g.add(m); }
  g.userData.parts = { legL, legR, armL, armR, head, torso };
  return g;
}

export class PedSystem {
  constructor(G) {
    this.G = G;
    this.list = [];
  }

  init() {
    for (let i = 0; i < 42; i++) {
      const x = rand(-280, 280), z = rand(-280, 280);
      const mesh = createHumanoid(choice(SHIRTS), choice(PANTS), choice(SKINS));
      mesh.position.set(x, 0, z);
      this.G.scene.add(mesh);
      this.list.push({
        mesh, x, z, heading: rand(Math.PI * 2),
        speed: rand(0.9, 1.6), walkPhase: rand(Math.PI * 2),
        targetX: x, targetZ: z, fleeT: 0, dead: false, deadT: 0,
        panic: false,
      });
      this.pickTarget(this.list[this.list.length - 1]);
    }
  }

  pickTarget(ped) {
    // stroll along a nearby road, on the sidewalk edge
    const road = choice([-270, -210, -150, -90, -30, 30, 90, 150, 210, 270]);
    if (Math.random() < 0.5) {
      ped.targetX = rand(-280, 280);
      ped.targetZ = road + (Math.random() < 0.5 ? 8 : -8);
    } else {
      ped.targetX = road + (Math.random() < 0.5 ? 8 : -8);
      ped.targetZ = rand(-280, 280);
    }
  }

  fleeFrom(x, z) {
    for (const ped of this.list) {
      if (ped.dead) continue;
      if (dist2D(ped.x, ped.z, x, z) < 45) {
        ped.fleeT = 3.5;
        ped.panic = true;
        // run directly away from the shot
        const a = headingTo(x, z, ped.x, ped.z);
        ped.targetX = ped.x + Math.sin(a) * 60;
        ped.targetZ = ped.z + Math.cos(a) * 60;
      }
    }
  }

  die(ped, byPlayer) {
    if (ped.dead) return;
    ped.dead = true;
    ped.deadT = 0;
    ped.mesh.rotation.x = -Math.PI / 2; // fall flat
    ped.mesh.position.y = 0.3;
    if (byPlayer) {
      this.G.state.totalKills++;
      this.G.police.addWanted(1, 'Murder');
    }
  }

  update(dt) {
    const G = this.G;
    for (const ped of this.list) {
      if (ped.dead) { ped.deadT += dt; continue; }
      if (ped.fleeT > 0) ped.fleeT -= dt;
      const d = dist2D(ped.x, ped.z, ped.targetX, ped.targetZ);
      if (d < 3) { this.pickTarget(ped); continue; }
      const desired = headingTo(ped.x, ped.z, ped.targetX, ped.targetZ);
      ped.heading = angleTurn(ped.heading, desired, 3.2 * dt);
      const spd = ped.fleeT > 0 ? 4.6 : ped.speed;
      ped.x += Math.sin(ped.heading) * spd * dt;
      ped.z += Math.cos(ped.heading) * spd * dt;
      ped.x = Math.max(-295, Math.min(295, ped.x));
      ped.z = Math.max(-295, Math.min(295, ped.z));
      const hit = collideCircle(G, ped.x, ped.z, 0.5);
      if (hit.hit) { ped.x = hit.x; ped.z = hit.z; this.pickTarget(ped); }
      ped.walkPhase += dt * spd * 3.2;
      const parts = ped.mesh.userData.parts;
      const swing = Math.sin(ped.walkPhase) * (ped.fleeT > 0 ? 0.9 : 0.55);
      parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
      parts.armL.rotation.x = -swing * 0.8; parts.armR.rotation.x = swing * 0.8;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }
}
