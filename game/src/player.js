// player.js — third-person character: walk/run/jump on foot, drive, enter/exit cars,
// camera orbit with mouse drag and auto-follow. Health, busted/wasted handling.

import * as THREE from 'three';
import { clamp, lerp, angleDiff, angleTurn, dist2D } from './state.js';
import { collideCircle } from './city.js';
import { createHumanoid } from './pedestrians.js';

export class Player {
  constructor(G) {
    this.G = G;
    this.mesh = createHumanoid(0x2a9a8a, 0x2c3e50, 0xe8b98a);
    this.mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // give the player a visible jacket stripe
    this.pos = new THREE.Vector3(0, 0, 40);
    this.heading = Math.PI; // facing south, toward the beach
    this.onFoot = true;
    this.car = null;
    this.vy = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.moving = false;
    this.camYaw = Math.PI;   // camera behind the player
    this.camPitch = 0.32;
    this.camDist = 7.5;
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;
    this.dragMoved = 0;
    this.bustedT = 0;
    G.scene.add(this.mesh);
  }

  resetTo(x, z, heading = 0) {
    if (this.car) { this.G.vehicles.exitCar(); }
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.camYaw = heading;
    this.onFoot = true;
    this.car = null;
    this.vy = 0;
  }

  takeDamage(n) {
    const G = this.G;
    if (G.state.over) return;
    G.state.health -= n;
    G.hud.flashDamage();
    G.audio.hurt();
    if (G.state.health <= 0) {
      G.state.health = 0;
      G.gameOver('wasted');
    }
  }

  heal(n) {
    this.G.state.health = clamp(this.G.state.health + n, 0, 100);
  }

  update(dt) {
    const G = this.G;
    const inp = G.input;
    if (G.state.over || !G.state.started) return;

    // --- camera drag (mouse) ---
    if (inp.dragDX || inp.dragDY) {
      this.camYaw -= inp.dragDX * 0.005;
      this.camPitch = clamp(this.camPitch + inp.dragDY * 0.004, -0.15, 1.0);
      inp.dragDX = 0; inp.dragDY = 0;
    }

    if (this.onFoot) this.updateOnFoot(dt);
    else this.updateCameraForCar(dt);

    // keep the mesh where the player is
    if (this.onFoot) {
      this.mesh.visible = true;
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.heading;
    } else {
      this.mesh.visible = false;
    }
  }

  updateOnFoot(dt) {
    const G = this.G;
    const inp = G.input;
    const fwd = (inp.keys.has('KeyW') || inp.keys.has('ArrowUp') ? 1 : 0)
      - (inp.keys.has('KeyS') || inp.keys.has('ArrowDown') ? 1 : 0);
    const strafe = (inp.keys.has('KeyD') || inp.keys.has('ArrowRight') ? 1 : 0)
      - (inp.keys.has('KeyA') || inp.keys.has('ArrowLeft') ? 1 : 0);
    const run = inp.keys.has('ShiftLeft') || inp.keys.has('ShiftRight');
    const speed = run ? 8.2 : 4.4;
    this.moving = fwd !== 0 || strafe !== 0;

    // Movement is camera-relative: W runs away from the camera.
    const cy = this.camYaw;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    const rx = Math.cos(cy), rz = -Math.sin(cy);
    let mx = fx * fwd + rx * strafe;
    let mz = fz * fwd + rz * strafe;
    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) {
      mx /= ml; mz /= ml;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = angleTurn(this.heading, targetHeading, 10 * dt);
      const nx = this.pos.x + mx * speed * dt;
      const nz = this.pos.z + mz * speed * dt;
      const hit = collideCircle(G, nx, nz, 0.55);
      this.pos.x = hit.x; this.pos.z = hit.z;
      // auto-follow: ease the camera behind the direction of travel
      const diff = angleDiff(this.camYaw, this.heading);
      this.camYaw += diff * clamp(dt * 1.4, 0, 1);
      this.walkPhase += dt * speed * 1.9;
    }
    // jump
    if (inp.keys.has('Space') && this.grounded) {
      this.vy = 6.5; this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= 18 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }
    }
    // walk animation
    const parts = this.mesh.userData.parts;
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.65 : 0;
    parts.legL.rotation.x = swing; parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.8; parts.armR.rotation.x = swing * 0.8;
    parts.armR.rotation.x = this.G.state.weapon === 'pistol' ? -1.2 : swing * 0.8;

    this.updateCamera(dt, 7.5, 2.6);
  }

  updateCameraForCar(dt) {
    const G = this.G;
    // camera trails behind the car's heading unless the player dragged recently
    const diff = angleDiff(this.camYaw, this.heading);
    this.camYaw += diff * clamp(dt * 2.2, 0, 1);
    this.updateCamera(dt, 11, 4.2);
  }

  updateCamera(dt, dist, height) {
    const G = this.G;
    const cx = this.pos.x - Math.sin(this.camYaw) * dist;
    const cz = this.pos.z - Math.cos(this.camYaw) * dist;
    const cy = height + Math.sin(this.camPitch) * dist * 0.55;
    const target = new THREE.Vector3(cx, cy, cz);
    G.camera.position.lerp(target, clamp(dt * 8, 0, 1));
    G.camera.lookAt(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }

  // Try to enter the nearest parked car. Returns a status string for the HUD.
  tryEnterCar() {
    const G = this.G;
    if (!this.onFoot) return 'already driving';
    const car = G.vehicles.nearestParked(this.pos, 4.5);
    if (!car) return 'no car nearby';
    const stolen = !car.stolen;
    G.vehicles.enterCar(car, stolen);
    G.audio.door();
    return stolen ? 'stolen' : 'entered';
  }

  exitVehicle() {
    const G = this.G;
    if (this.car) {
      G.vehicles.exitCar();
      G.audio.door();
    }
  }
}
