// missions.js — 9 original story missions for Vista Bay.
// Mara Voss (the player), fixer Dario Kane, villain Rook.
// Steps: goto | steal | deliver | kill | collect | escape | talk.
// Each mission has dialogue, a timer where stated, and a cash reward.

import * as THREE from 'three';
import { dist2D, formatCash, saveGame } from './state.js';
import { createHumanoid } from './pedestrians.js';

const L = {
  garage: { x: 60, z: 226 },
  pier: { x: 0, z: 336 },
  pierGate: { x: 0, z: 288 },
  park: { x: -180, z: -180 },
  casino: { x: 180, z: -138 },
  hospital: { x: -180, z: 150 },
  airport: { x: 270, z: 0 },
  docks: { x: -252, z: 210 },
  downtown: { x: 0, z: 30 },
};

export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', giver: 'Mara Voss', reward: 500,
    brief: 'Mara needs wheels. Steal a parked car and bring it to her garage.',
    dialogue: [
      ['Mara', 'New in Vista Bay? You need wheels before anything else.'],
      ['Mara', 'Take any parked car on the street — press E next to one.'],
      ['Mara', 'Then bring it to my garage. Don\'t let the cops see you take it.'],
    ],
    steps: [
      { type: 'steal', label: 'Steal a parked car (press E near one)' },
      { type: 'goto', x: L.garage.x, z: L.garage.z, r: 9, label: 'Drive the car to Mara\'s Garage', inCar: true },
    ],
  },
  {
    id: 2, name: 'Dockside Delivery', giver: 'Dario Kane', reward: 800,
    brief: 'Dario has a package for the pier. 90 seconds, no excuses.',
    dialogue: [
      ['Dario', 'Mara says you can drive. Prove it.'],
      ['Dario', 'Package goes to the end of Vista Pier. Ninety seconds. Go.'],
    ],
    steps: [
      { type: 'goto', x: L.pier.x, z: L.pier.z, r: 9, label: 'Deliver the package to Vista Pier', timer: 90 },
    ],
  },
  {
    id: 3, name: 'Park Pickup', giver: 'Dario Kane', reward: 1000,
    brief: 'Meet Dario\'s contact in Palm Court Park — then shake the cops.',
    dialogue: [
      ['Dario', 'My man is waiting in the park. He has something for us.'],
      ['Dario', 'Cops are sniffing around that park. Keep your head down.'],
    ],
    steps: [
      { type: 'goto', x: L.park.x, z: L.park.z, r: 8, label: 'Meet the contact in Palm Court Park' },
      { type: 'talk', x: L.park.x, z: L.park.z, label: 'Talk to the contact (press E)' },
      { type: 'escape', label: 'Lose the cops — stay out of sight until the heat dies' },
    ],
  },
  {
    id: 4, name: 'Pier Shootout', giver: 'Mara Voss', reward: 1500,
    brief: 'Rook\'s crew is shaking down the pier fishermen. Clear them out.',
    dialogue: [
      ['Mara', 'Rook\'s boys are leaning on the pier fishermen. That ends tonight.'],
      ['Mara', 'Take the pistol. Four of them. Make it loud.'],
    ],
    steps: [
      { type: 'goto', x: L.pierGate.x, z: L.pierGate.z, r: 10, label: 'Get to Vista Pier' },
      { type: 'kill', count: 4, label: 'Take out Rook\'s crew (0/4)',
        spawns: [[-4, 320], [5, 330], [-3, 348], [4, 356]] },
    ],
  },
  {
    id: 5, name: 'Cash Run', giver: 'Dario Kane', reward: 2000,
    brief: 'Five dead drops of cash are stashed around the city. Collect them all.',
    dialogue: [
      ['Dario', 'Five drops, five corners of the bay. Grab them before Rook\'s boys do.'],
      ['Dario', 'Follow the yellow beacons. A car helps — it\'s a long run.'],
    ],
    steps: [
      { type: 'collect', label: 'Collect the cash drops (0/5)',
        points: [[90, 90], [-90, 210], [210, 30], [-210, -90], [30, -210]] },
    ],
  },
  {
    id: 6, name: 'Casino Vault Truck', giver: 'Mara Voss', reward: 3000,
    brief: 'A vault truck is parked behind the Golden Palm. Take it. Deliver it.',
    dialogue: [
      ['Mara', 'The Golden Palm moves its vault cash by truck. One is parked out back.'],
      ['Mara', 'Take the truck and bring it to the garage. The casino will not thank you.'],
    ],
    steps: [
      { type: 'goto', x: L.casino.x, z: L.casino.z, r: 10, label: 'Get to the Golden Palm Casino' },
      { type: 'stealTruck', label: 'Steal the armored vault truck (press E)' },
      { type: 'goto', x: L.garage.x, z: L.garage.z, r: 9, label: 'Deliver the vault truck to the garage', inCar: true },
    ],
  },
  {
    id: 7, name: 'Harbor Cleanup', giver: 'Dario Kane', reward: 2500,
    brief: 'Rook\'s smugglers run the harbor docks. Five of them. No survivors.',
    dialogue: [
      ['Dario', 'The docks are Rook\'s lifeline. Cut it.'],
      ['Dario', 'Five smugglers between the containers. Watch the cranes — they watch you.'],
    ],
    steps: [
      { type: 'goto', x: L.docks.x, z: L.docks.z, r: 12, label: 'Get to the Harbor Docks' },
      { type: 'kill', count: 5, label: 'Clear the docks (0/5)',
        spawns: [[-258, 180], [-246, 200], [-262, 220], [-248, 236], [-258, 252]] },
    ],
  },
  {
    id: 8, name: 'Convoy Ambush', giver: 'Mara Voss', reward: 4000,
    brief: 'Rook\'s armored convoy rolls down Palm Avenue. Stop both trucks, take the cargo.',
    dialogue: [
      ['Mara', 'Rook is moving his money in a convoy — two trucks, escorts, the works.'],
      ['Mara', 'Wreck both trucks on Palm Avenue and grab the cargo.'],
    ],
    steps: [
      { type: 'goto', x: 150, z: 90, r: 12, label: 'Reach the convoy route on Palm Avenue' },
      { type: 'wreck', count: 2, label: 'Wreck the armored trucks (0/2)' },
      { type: 'collect', label: 'Grab the cargo (0/1)', points: [[150, 96]] },
    ],
  },
  {
    id: 9, name: 'Airport Showdown', giver: 'Mara Voss', reward: 8000,
    brief: 'Rook is fleeing Vista Bay from the airport runway. End it there.',
    dialogue: [
      ['Mara', 'Rook is on the runway, about to fly out with everything he stole.'],
      ['Mara', 'No more running. Finish this, and Vista Bay is ours.'],
      ['Rook', 'You think you own this city, Voss? Come and take it.'],
    ],
    steps: [
      { type: 'goto', x: L.airport.x, z: L.airport.z, r: 14, label: 'Get to Vista Bay Airport' },
      { type: 'kill', count: 5, label: 'Take down Rook and his crew (0/5)', boss: true,
        spawns: [[270, 20], [258, -12], [282, 10], [264, 30], [276, -30]] },
    ],
  },
];

export class MissionSystem {
  constructor(G) {
    this.G = G;
    this.active = null;      // { def, stepIndex, ...runtime }
    this.beacon = null;      // 3D marker group
    this.pickups = [];       // collect markers {mesh,x,z,taken}
    this.convoy = [];        // mission 8 trucks
    this.dialogueQueue = [];
    this.dialogueT = 0;
    this.timer = 0;
    this.killsAtStart = 0;
    this.escapeWantedAtStart = 0;
    this.buildBeacon();
  }

  buildBeacon() {
    const G = this.G;
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 15; g.add(cyl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd24d }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd24d }));
    arrow.rotation.x = Math.PI; arrow.position.y = 8; g.add(arrow);
    g.visible = false;
    G.scene.add(g);
    this.beacon = g;
    this.beaconRing = ring;
    this.beaconArrow = arrow;
  }

  setBeacon(x, z, visible = true) {
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = visible;
    this.beaconTarget = visible ? { x, z } : null;
  }

  start(id) {
    const G = this.G;
    const def = MISSIONS.find(m => m.id === id);
    if (!def) return false;
    if (G.state.missionsDone.includes(id)) return false;
    this.abort(true);
    G.state.currentMission = id;
    this.active = { def, stepIndex: 0, stepState: {} };
    this.killsAtStart = G.state.totalKills;
    this.sayLines(def.dialogue);
    G.hud.showToast('MISSION: ' + def.name + ' — ' + def.brief);
    G.audio.missionStart();
    this.enterStep();
    return true;
  }

  sayLines(lines) {
    this.dialogueQueue = [...lines];
    this.dialogueT = 0;
  }

  currentStep() {
    if (!this.active) return null;
    return this.active.def.steps[this.active.stepIndex];
  }

  objectiveText() {
    const step = this.currentStep();
    if (!step) return '';
    return step.label;
  }

  enterStep() {
    const G = this.G;
    const step = this.currentStep();
    if (!step) { this.complete(); return; }
    const st = this.active.stepState = {};
    this.timer = step.timer || 0;
    switch (step.type) {
      case 'goto':
        this.setBeacon(step.x, step.z);
        break;
      case 'talk': {
        this.setBeacon(step.x, step.z);
        // the contact waits in the park, visible and marked
        this.contactMesh = createHumanoid(0xe8b13a, 0x2c3e50, 0x8a5a34);
        this.contactMesh.position.set(step.x, 0, step.z);
        G.scene.add(this.contactMesh);
        break;
      }
      case 'steal':
        this.setBeacon(G.player.pos.x, G.player.pos.z, false);
        break;
      case 'stealTruck': {
        this.setBeacon(L.casino.x, L.casino.z);
        // park the vault truck on the road behind the casino
        const truck = G.vehicles.makeCar(205, -150, Math.PI / 2, 0x3a3f45, { armored: true, kind: 'truck' });
        truck.kind = 'truck';
        G.vehicles.specials.push(truck);
        this.truck = truck;
        break;
      }
      case 'kill': {
        this.setBeacon(step.spawns[0][0], step.spawns[0][1]);
        G.combat.clearEnemies();
        st.killed = 0;
        st.total = step.count;
        step.spawns.forEach((s, i) => {
          G.combat.spawnEnemy(s[0], s[1], { boss: step.boss && i === 0, name: step.boss && i === 0 ? 'Rook' : undefined });
        });
        if (step.boss) G.hud.showToast('ROOK IS HERE — take him down!');
        break;
      }
      case 'collect': {
        st.collected = 0;
        st.total = step.points.length;
        this.clearPickups();
        for (const [x, z] of step.points) this.addPickup(x, z);
        const p = step.points[0];
        this.setBeacon(p[0], p[1]);
        break;
      }
      case 'wreck': {
        st.wrecked = 0;
        st.total = step.count;
        this.convoy = [];
        // two armored trucks rolling slowly down Palm Avenue
        for (let i = 0; i < 2; i++) {
          const t = G.vehicles.makeCar(150, 60 + i * 26, 0, 0x3a3f45, { armored: true, kind: 'truck' });
          t.kind = 'convoy';
          t.cruise = 5;
          t.from = -1; t.to = -1;
          G.vehicles.specials.push(t);
          this.convoy.push(t);
        }
        this.setBeacon(150, 90);
        break;
      }
      case 'escape':
        this.setBeacon(G.player.pos.x, G.player.pos.z, false);
        G.police.addWanted(2, 'Spotted at the meet');
        st.hadWanted = true;
        break;
      default:
        this.setBeacon(G.player.pos.x, G.player.pos.z, false);
    }
    G.hud.setObjective(step.label);
  }

  addPickup(x, z) {
    const G = this.G;
    const g = new THREE.Group();
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2a7a3a }));
    bag.position.y = 0.5; g.add(bag);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.25 }));
    glow.position.y = 0.7; g.add(glow);
    g.position.set(x, 0, z);
    G.scene.add(g);
    this.pickups.push({ mesh: g, x, z, taken: false });
  }

  clearPickups() {
    for (const p of this.pickups) this.G.scene.remove(p.mesh);
    this.pickups = [];
  }

  nextStep() {
    this.clearContact();
    this.active.stepIndex++;
    if (this.active.stepIndex >= this.active.def.steps.length) this.complete();
    else this.enterStep();
  }

  complete() {
    const G = this.G;
    const def = this.active.def;
    G.state.cash += def.reward;
    G.state.missionsDone.push(def.id);
    G.state.currentMission = 0;
    this.active = null;
    this.setBeacon(0, 0, false);
    this.clearPickups();
    G.combat.clearEnemies();
    G.hud.showMissionComplete(def);
    G.audio.sting();
    if (def.id === 9) {
      G.state.storyComplete = true;
      G.hud.showToast('STORY COMPLETE — Vista Bay is yours, Mara.');
    }
    saveGame(G);
  }

  fail(reason) {
    const G = this.G;
    const def = this.active ? this.active.def : null;
    this.abort();
    G.hud.showToast('MISSION FAILED: ' + reason);
    G.audio.fail();
    if (def) G.hud.setObjective('Mission failed — ' + def.name + '. Restart it from the menu.');
  }

  clearContact() {
    if (this.contactMesh) {
      this.G.scene.remove(this.contactMesh);
      this.contactMesh = null;
    }
  }

  abort(silent) {
    const G = this.G;
    this.clearContact();
    if (this.active) {
      this.active = null;
      G.state.currentMission = 0;
    }
    this.setBeacon(0, 0, false);
    this.clearPickups();
    G.combat.clearEnemies();
    for (const t of this.convoy) {
      const i = G.vehicles.specials.indexOf(t);
      if (i >= 0) G.vehicles.specials.splice(i, 1);
      G.scene.remove(t.mesh);
    }
    this.convoy = [];
    if (this.truck && !G.player.car) {
      const i = G.vehicles.specials.indexOf(this.truck);
      if (i >= 0) G.vehicles.specials.splice(i, 1);
      G.scene.remove(this.truck.mesh);
    }
    this.truck = null;
    if (!silent) G.hud.setObjective('');
  }

  // E-key interactions for talk / stealTruck steps.
  interact() {
    const G = this.G;
    const step = this.currentStep();
    if (!step) return false;
    if (step.type === 'talk') {
      if (dist2D(G.player.pos.x, G.player.pos.z, step.x, step.z) < 4) {
        this.sayLines([['Contact', 'Package is yours. Dario says move fast — cops are coming.']]);
        this.nextStep();
        return true;
      }
    }
    if (step.type === 'stealTruck' && this.truck) {
      if (dist2D(G.player.pos.x, G.player.pos.z, this.truck.x, this.truck.z) < 5) {
        G.vehicles.enterCar(this.truck, true);
        this.nextStep();
        return true;
      }
    }
    return false;
  }

  update(dt) {
    const G = this.G;
    // dialogue subtitles
    if (this.dialogueQueue.length) {
      this.dialogueT += dt;
      if (this.dialogueT > 3.6) {
        this.dialogueT = 0;
        this.dialogueQueue.shift();
      }
      const line = this.dialogueQueue[0];
      if (line) G.hud.showSubtitle(line[0] + ': ' + line[1]);
    } else {
      G.hud.showSubtitle('');
    }
    // beacon pulse
    if (this.beacon.visible) {
      const s = 1 + Math.sin(G.state.time * 4) * 0.12;
      this.beaconRing.scale.set(s, s, 1);
      this.beaconArrow.position.y = 8 + Math.sin(G.state.time * 3) * 0.5;
    }
    // pickup bob + spin
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.children[0].position.y = 0.5 + Math.sin(G.state.time * 3 + p.x) * 0.12;
    }
    if (!this.active) return;
    const step = this.currentStep();
    const st = this.active.stepState;
    const px = G.player.pos.x, pz = G.player.pos.z;

    // timers
    if (this.timer > 0) {
      this.timer -= dt;
      G.hud.setTimer(this.timer);
      if (this.timer <= 0) { this.fail('Out of time'); return; }
    } else {
      G.hud.setTimer(0);
    }

    switch (step.type) {
      case 'goto': {
        const d = dist2D(px, pz, step.x, step.z);
        G.hud.setObjective(step.label + ' — ' + Math.round(d) + 'm');
        if (d < step.r) {
          if (step.inCar && !G.player.car) {
            G.hud.setObjective(step.label + ' — get in a car!');
          } else this.nextStep();
        }
        break;
      }
      case 'steal': {
        if (G.player.car) this.nextStep();
        break;
      }
      case 'stealTruck': {
        if (G.player.car === this.truck) this.nextStep();
        break;
      }
      case 'talk': {
        const d = dist2D(px, pz, step.x, step.z);
        if (d < 4) G.hud.setObjective(step.label + ' — press E');
        break;
      }
      case 'kill': {
        const killed = G.combat.enemies.filter(e => e.dead).length;
        if (killed !== st.killed) {
          st.killed = killed;
          G.hud.setObjective(step.label.replace(/\(\d+\/\d+\)/, `(${killed}/${st.total})`));
        }
        if (killed >= st.total) this.nextStep();
        break;
      }
      case 'collect': {
        let remaining = null;
        for (const p of this.pickups) {
          if (p.taken) continue;
          if (dist2D(px, pz, p.x, p.z) < 3.2) {
            p.taken = true;
            G.scene.remove(p.mesh);
            st.collected++;
            G.state.cash += 150;
            G.audio.pickup();
            G.hud.showToast('Cash +$150 (' + st.collected + '/' + st.total + ')');
          }
          if (!p.taken && !remaining) remaining = p;
        }
        G.hud.setObjective(step.label.replace(/\(\d+\/\d+\)/, `(${st.collected}/${st.total})`));
        if (remaining) this.setBeacon(remaining.x, remaining.z);
        if (st.collected >= st.total) this.nextStep();
        break;
      }
      case 'wreck': {
        const wrecked = this.convoy.filter(t => t.wrecked).length;
        if (wrecked !== st.wrecked) {
          st.wrecked = wrecked;
          G.hud.setObjective(step.label.replace(/\(\d+\/\d+\)/, `(${wrecked}/${st.total})`));
        }
        // convoy trucks crawl forward along the avenue
        for (const t of this.convoy) {
          if (t.wrecked) continue;
          t.z += t.cruise * dt;
          t.mesh.position.set(t.x, 0, t.z);
          if (t.z > 280) t.z = -280;
        }
        if (wrecked >= st.total) this.nextStep();
        break;
      }
      case 'escape': {
        if (G.state.wanted === 0) this.nextStep();
        else G.hud.setObjective(step.label + ' — ' + G.state.wanted + '★ wanted');
        break;
      }
      default:
        break;
    }
  }
}
