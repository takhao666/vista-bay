// state.js — shared game state, math helpers, and localStorage save/load.
// Vista Bay: original open-world crime game. All code written for this entry.

export const SAVE_KEY = 'vistabay-save-v1';

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); }
export function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
export function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function dist2D(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

// Shortest signed difference between two headings (radians).
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Turn `current` toward `target` by at most `maxStep` radians, shortest arc.
export function angleTurn(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}
// Heading (radians) whose forward vector (sin h, cos h) points from (ax,az) to (bx,bz).
export function headingTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }

export function formatCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
export function formatTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

// Central mutable state. Systems read/write this through the shared G object.
export function createState() {
  return {
    started: false,       // true once the player leaves the start menu
    paused: false,
    over: false,          // busted / wasted screen showing
    time: 0,              // seconds since session start
    clockMin: 15 * 60 + 22, // in-world clock: sunny afternoon, 15:22
    cash: 250,
    health: 100,
    maxHealth: 100,
    wanted: 0,
    heat: 0,              // seconds since last crime / police sighting
    wantedDecay: 0,       // timer counting down to lose one star
    ammo: 12,             // pistol magazine
    reserveAmmo: 60,
    weapon: 'fists',      // 'fists' | 'pistol'
    missionsDone: [],     // ids of completed story missions
    currentMission: 0,    // 0 = none active
    totalKills: 0,
    carsStolen: 0,
    distanceDriven: 0,
    storyComplete: false,
    muted: false,
  };
}

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      v: 1,
      cash: G.state.cash,
      health: G.state.health,
      ammo: G.state.ammo,
      reserveAmmo: G.state.reserveAmmo,
      missionsDone: G.state.missionsDone,
      storyComplete: G.state.storyComplete,
      totalKills: G.state.totalKills,
      carsStolen: G.state.carsStolen,
      px: p.pos.x, pz: p.pos.z, heading: p.heading,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}

export function applySave(G, d) {
  G.state.cash = d.cash ?? 250;
  G.state.health = d.health ?? 100;
  G.state.ammo = d.ammo ?? 12;
  G.state.reserveAmmo = d.reserveAmmo ?? 60;
  G.state.missionsDone = Array.isArray(d.missionsDone) ? d.missionsDone : [];
  G.state.storyComplete = !!d.storyComplete;
  G.state.totalKills = d.totalKills ?? 0;
  G.state.carsStolen = d.carsStolen ?? 0;
  if (typeof d.px === 'number' && typeof d.pz === 'number') {
    G.player.pos.set(d.px, 0, d.pz);
    G.player.heading = d.heading || 0;
  }
}
