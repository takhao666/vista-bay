// main.js — Vista Bay entry point: builds the world, wires every system,
// runs the game loop, input, pause/save/end flows and test hooks.
// Original open-world crime game, written for the make.fun gta6-01 bounty.

import * as THREE from 'three';
import { createState, saveGame, loadGame, applySave, clamp } from './state.js';
import { buildCity } from './city.js';
import { VehicleSystem } from './vehicles.js';
import { PedSystem } from './pedestrians.js';
import { Player } from './player.js';
import { PoliceSystem } from './police.js';
import { Combat } from './combat.js';
import { MissionSystem, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const lowfx = params.get('lowfx') === '1'; // headless/verification mode: no shadow pass, no MSAA
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx });
renderer.setPixelRatio(lowfx ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowfx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.position.set(0, 40, 90);

const G = {
  scene, camera, renderer,
  state: createState(),
  input: { keys: new Set(), dragDX: 0, dragDY: 0, mouseDown: false },
  missionsList: MISSIONS,
  menuOrbit: false,
  shotMode: null,
  clock: new THREE.Clock(),
};

G.audio = new AudioSys();
buildCity(G);
G.vehicles = new VehicleSystem(G);
G.vehicles.init();
G.peds = new PedSystem(G);
G.peds.init();
G.player = new Player(G);
G.police = new PoliceSystem(G);
G.combat = new Combat(G);
G.missions = new MissionSystem(G);
G.hud = new HUD(G);

// --- game flow ---------------------------------------------------------------
G.startGame = function (useSave) {
  G.audio.init();
  G.audio.startMusic();
  if (useSave) {
    const d = loadGame();
    if (d) applySave(G, d);
  }
  G.state.started = true;
  G.state.paused = false;
  G.state.over = false;
  G.menuOrbit = false;
  G.hud.showMenu(null);
  G.hud.refreshMissionList();
  if (!G.state.currentMission && G.state.missionsDone.length === 0) {
    G.hud.showToast('Welcome to Vista Bay — open the menu (Esc) to start Mission 1');
  }
};

G.togglePause = function (force) {
  if (!G.state.started || G.state.over) return;
  const p = force !== undefined ? force : !G.state.paused;
  G.state.paused = p;
  G.hud.showMenu(p ? 'menu-pause' : null);
  if (!p) G.hud.refreshMissionList();
};

G.gameOver = function (kind) {
  const S = G.state;
  S.over = true;
  const lost = Math.floor(S.cash * 0.2);
  S.cash -= lost;
  S.wanted = 0;
  G.police.clearAll();
  G.police.syncSiren();
  G.missions.abort(true);
  G.audio.setEngine(0, false);
  G.audio.setSiren(false);
  G.hud.showEnd(kind, lost);
  saveGame(G);
};

G.retryAfterEnd = function () {
  G.state.health = 100;
  G.state.over = false;
  G.state.wanted = 0;
  G.player.resetTo(-180, 150, 0); // Vista General Hospital entrance
  G.hud.showMenu(null);
  G.hud.showToast('You woke up at Vista General Hospital.');
  saveGame(G);
};

G.restart = function () {
  // fresh session, keep the save file intact
  G.state = createState();
  G.player.resetTo(0, 40, Math.PI);
  G.police.clearAll();
  G.combat.clearEnemies();
  G.missions.abort(true);
  G.state.started = true;
  G.state.paused = false;
  G.hud.showMenu(null);
  G.hud.refreshMissionList();
};

G.toMenu = function () {
  G.state.started = false;
  G.state.paused = false;
  G.state.over = false;
  G.menuOrbit = true;
  saveGame(G);
  G.hud.showMenu('menu-start');
  G.hud.refreshMissionList();
};

// --- input -------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  G.audio.init();
  G.input.keys.add(e.code);
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (G.state.started && !G.state.over) G.togglePause();
  }
  if (e.code === 'KeyM') {
    const bm = document.getElementById('bigmap');
    bm.classList.toggle('hidden');
    if (!bm.classList.contains('hidden')) G.hud.drawBigMap();
  }
  if (e.code === 'KeyE' && G.state.started && !G.state.paused && !G.state.over) {
    if (!G.missions.interact()) {
      if (G.player.onFoot) {
        const r = G.player.tryEnterCar();
        if (r === 'no car nearby') G.hud.showToast('No car close enough');
      } else {
        G.player.exitVehicle();
      }
    }
  }
  if (e.code === 'KeyR') G.combat.reload();
  if (e.code === 'Digit1') { G.state.weapon = 'fists'; G.hud.showToast('Fists'); }
  if (e.code === 'Digit2') { G.state.weapon = 'pistol'; G.hud.showToast('Pistol — click to shoot'); }
  if (e.code === 'KeyF') G.combat.punch();
});
window.addEventListener('keyup', (e) => G.input.keys.delete(e.code));

canvas.addEventListener('pointerdown', (e) => {
  G.audio.init();
  G.input.mouseDown = true;
  G.player.dragging = true;
  G.player.lastX = e.clientX; G.player.lastY = e.clientY;
  G.player.dragMoved = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!G.input.mouseDown) return;
  const dx = e.clientX - G.player.lastX;
  const dy = e.clientY - G.player.lastY;
  G.player.lastX = e.clientX; G.player.lastY = e.clientY;
  G.player.dragMoved += Math.abs(dx) + Math.abs(dy);
  G.input.dragDX += dx;
  G.input.dragDY += dy;
});
canvas.addEventListener('pointerup', (e) => {
  G.input.mouseDown = false;
  G.player.dragging = false;
  // a short press (not a drag) is a shot / punch
  if (G.player.dragMoved < 6 && G.state.started && !G.state.paused && !G.state.over) {
    G.combat.shoot();
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- menu orbit camera (title screen) ---------------------------------------
let orbitA = 0;
function menuCamera(dt) {
  orbitA += dt * 0.05;
  const r = 190;
  camera.position.set(Math.sin(orbitA) * r, 70, Math.cos(orbitA) * r);
  camera.lookAt(0, 10, 0);
}

// --- main loop ---------------------------------------------------------------
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;
  const S = G.state;
  if (S.started && !S.paused && !S.over) {
    S.time += dt;
    // screenshot staging: the chase preset cruises at ~50 km/h so the
    // police can keep up and stay in frame
    if (G.shotMode === 'chase' && G.player.car) {
      if (G.player.car.speed < 14) G.input.keys.add('KeyW');
      else G.input.keys.delete('KeyW');
    }
    G.player.update(dt);
    G.vehicles.update(dt);
    G.peds.update(dt);
    G.police.update(dt);
    G.combat.update(dt);
    G.missions.update(dt);
    // ocean shimmer
    if (G.ocean) G.ocean.position.y = -0.4 + Math.sin(S.time * 0.7) * 0.12;
  } else if (G.menuOrbit || !S.started) {
    S.time += dt;
    menuCamera(dt);
    // keep the city alive behind the menu
    G.vehicles.updateTraffic(dt);
    G.peds.update(dt);
  }
  G.hud.update(dt);
  if (G.hud.shakeT > 0) {
    camera.position.x += (Math.random() - 0.5) * 0.3;
    camera.position.y += (Math.random() - 0.5) * 0.3;
  }
  renderer.render(scene, camera);
}

// --- boot --------------------------------------------------------------------
const shot = params.get('shot');
if (!applyShot(G, shot)) {
  G.hud.showMenu('menu-start');
  G.menuOrbit = true;
}
// Continue button only makes sense with a save.
if (!loadGame()) {
  const btn = document.getElementById('btn-continue');
  if (btn) btn.style.display = 'none';
}
requestAnimationFrame(loop);

// --- test / debug hooks (used by the CDP verification driver) ---------------
window.__VB = {
  state: () => ({
    started: G.state.started, paused: G.state.paused, over: G.state.over,
    cash: G.state.cash, health: G.state.health, wanted: G.state.wanted,
    ammo: G.state.ammo, reserveAmmo: G.state.reserveAmmo,
    weapon: G.state.weapon, mission: G.state.currentMission,
    missionsDone: [...G.state.missionsDone],
    onFoot: G.player.onFoot,
    pos: { x: +G.player.pos.x.toFixed(1), z: +G.player.pos.z.toFixed(1) },
    speed: G.player.car ? +G.player.car.speed.toFixed(1) : 0,
    policeCars: G.police.cars.length, cops: G.police.cops.length,
    enemies: G.combat.enemies.filter(e => !e.dead).length,
    traffic: G.vehicles.traffic.length, parked: G.vehicles.parked.length,
    peds: G.peds.list.filter(p => !p.dead).length,
    time: +G.state.time.toFixed(1),
  }),
  startGame: (useSave) => G.startGame(!!useSave),
  startMission: (id) => G.missions.start(id),
  teleport: (x, z) => {
    if (G.player.car) {
      const car = G.player.car;
      car.x = x; car.z = z; car.speed = 0;
      car.mesh.position.set(x, 0, z);
      G.player.pos.set(x, 0, z);
    } else {
      G.player.resetTo(x, z, 0);
    }
  },
  spawnCarAtPlayer: () => {
    const p = G.player.pos;
    const car = G.vehicles.makeCar(p.x + 3, p.z + 3, 0, 0xc0392b);
    car.kind = 'parked';
    G.vehicles.parked.push(car);
    return true;
  },
  setWanted: (n) => { G.state.wanted = n; G.police.syncSiren(); },
  giveAmmo: () => { G.state.ammo = 12; G.state.reserveAmmo = 120; G.state.weapon = 'pistol'; },
  enterNearestCar: () => G.player.tryEnterCar(),
  shoot: () => G.combat.shoot(),
  errors: [],
};
window.addEventListener('error', (e) => window.__VB.errors.push(String(e.message)));
