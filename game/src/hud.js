// hud.js — DOM HUD: wanted stars, cash, health, ammo, speed, objective,
// minimap + big map (M), start/pause/end menus, toasts, subtitles.

import { formatCash, formatTime } from './state.js';
import { ROADS } from './city.js';

export class HUD {
  constructor(G) {
    this.G = G;
    this.el = {};
    for (const id of ['hud', 'stars', 'cash', 'health-fill', 'health-num', 'ammo', 'weapon',
      'speed', 'speed-box', 'objective', 'timer', 'subtitle', 'toast', 'crosshair',
      'minimap', 'menu-start', 'menu-pause', 'menu-end', 'end-title', 'end-text',
      'mission-list', 'bigmap', 'bigmap-canvas', 'damage', 'muzzle', 'clock',
      'mission-complete', 'mc-title', 'mc-text', 'prompt', 'save-note']) {
      this.el[id] = document.getElementById(id);
    }
    this.mm = this.el['minimap'].getContext('2d');
    this.bm = this.el['bigmap-canvas'].getContext('2d');
    this.toastT = 0;
    this.shakeT = 0;
    this.lastObjective = '';
    this.lastStars = -1;
    this.lastCash = -1;
    this.lastHealth = -1;
    this.lastAmmo = '';
    this.lastSpeed = '';
    this.buildMissionList();
    this.bindButtons();
  }

  bindButtons() {
    const G = this.G;
    const q = (sel) => document.querySelector(sel);
    q('#btn-play')?.addEventListener('click', () => { G.audio.init(); G.startGame(false); });
    q('#btn-continue')?.addEventListener('click', () => { G.audio.init(); G.startGame(true); });
    q('#btn-resume')?.addEventListener('click', () => G.togglePause(false));
    q('#btn-restart')?.addEventListener('click', () => { G.restart(); });
    q('#btn-quit-menu')?.addEventListener('click', () => { G.toMenu(); });
    q('#btn-end-menu')?.addEventListener('click', () => { G.toMenu(); });
    q('#btn-end-retry')?.addEventListener('click', () => { G.retryAfterEnd(); });
    q('#btn-mute')?.addEventListener('click', (e) => {
      G.state.muted = !G.state.muted;
      G.audio.setMuted(G.state.muted);
      e.target.textContent = G.state.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
    });
    q('#btn-close-map')?.addEventListener('click', () => { this.el['bigmap'].classList.add('hidden'); });
  }

  buildMissionList() {
    const G = this.G;
    for (const listId of ['mission-list', 'mission-list-pause']) {
      const list = document.getElementById(listId);
      if (!list) continue;
      list.innerHTML = '';
      for (const m of G.missionsList) {
        const done = G.state.missionsDone.includes(m.id);
        const btn = document.createElement('button');
        btn.className = 'mission-btn' + (done ? ' done' : '');
        btn.textContent = (done ? '✓ ' : m.id + '. ') + m.name + ' — ' + formatCash(m.reward);
        btn.disabled = done || G.state.currentMission !== 0;
        btn.addEventListener('click', () => {
          G.audio.init();
          G.startGame(false);
          G.missions.start(m.id);
        });
        list.appendChild(btn);
      }
    }
  }

  refreshMissionList() { this.buildMissionList(); }

  setObjective(text) {
    if (text !== this.lastObjective) {
      this.lastObjective = text;
      this.el['objective'].textContent = text;
      this.el['objective'].style.display = text ? 'block' : 'none';
    }
  }

  setTimer(t) {
    this.el['timer'].style.display = t > 0 ? 'block' : 'none';
    if (t > 0) {
      this.el['timer'].textContent = '⏱ ' + formatTime(Math.max(0, t));
      this.el['timer'].classList.toggle('urgent', t < 15);
    }
  }

  showSubtitle(text) {
    this.el['subtitle'].textContent = text;
    this.el['subtitle'].style.display = text ? 'block' : 'none';
  }

  showToast(text, dur = 3) {
    this.el['toast'].textContent = text;
    this.el['toast'].style.display = 'block';
    this.toastT = dur;
  }

  flashDamage() {
    const d = this.el['damage'];
    d.style.opacity = '0.55';
    setTimeout(() => { d.style.opacity = '0'; }, 130);
  }

  muzzleFlash() {
    const m = this.el['muzzle'];
    m.style.opacity = '0.5';
    setTimeout(() => { m.style.opacity = '0'; }, 60);
  }

  shake(t) { this.shakeT = Math.max(this.shakeT, t); }

  showMissionComplete(def) {
    this.el['mc-title'].textContent = 'MISSION COMPLETE';
    this.el['mc-text'].textContent = def.name + ' — ' + formatCash(def.reward) + ' earned';
    const box = this.el['mission-complete'];
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 4200);
    this.refreshMissionList();
    this.showSaveNote();
  }

  showSaveNote() {
    this.el['save-note'].textContent = '✓ Progress saved';
    this.el['save-note'].style.display = 'block';
    setTimeout(() => { this.el['save-note'].style.display = 'none'; }, 2500);
  }

  showMenu(name) {
    for (const m of ['menu-start', 'menu-pause', 'menu-end']) {
      this.el[m].classList.toggle('hidden', m !== name);
    }
    this.el['hud'].classList.toggle('hidden', name === 'menu-start');
  }

  showEnd(kind, lostCash) {
    this.el['end-title'].textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    this.el['end-text'].textContent = kind === 'busted'
      ? 'The Vista Bay police hauled you in. You lost ' + formatCash(lostCash) + ' (20%) and woke up at Vista General Hospital.'
      : 'You were taken down. You lost ' + formatCash(lostCash) + ' (20%) and woke up at Vista General Hospital.';
    this.showMenu('menu-end');
  }

  update(dt) {
    const G = this.G;
    const S = G.state;
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.el['toast'].style.display = 'none';
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    // stars
    if (S.wanted !== this.lastStars) {
      this.lastStars = S.wanted;
      let s = '';
      for (let i = 0; i < 5; i++) s += i < S.wanted ? '★' : '☆';
      this.el['stars'].textContent = s;
      this.el['stars'].classList.toggle('hot', S.wanted > 0);
    }
    if (S.cash !== this.lastCash) {
      this.lastCash = S.cash;
      this.el['cash'].textContent = formatCash(S.cash);
    }
    const hp = Math.round(S.health);
    if (hp !== this.lastHealth) {
      this.lastHealth = hp;
      this.el['health-fill'].style.width = hp + '%';
      this.el['health-fill'].classList.toggle('low', hp < 30);
      this.el['health-num'].textContent = hp;
    }
    const ammoTxt = S.weapon === 'pistol' ? S.ammo + ' / ' + S.reserveAmmo : '—';
    if (ammoTxt !== this.lastAmmo) {
      this.lastAmmo = ammoTxt;
      this.el['ammo'].textContent = ammoTxt;
      this.el['weapon'].textContent = S.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
    }
    const speed = G.player.car ? Math.abs(Math.round(G.player.car.speed * 3.6)) : 0;
    const speedTxt = G.player.car ? speed + ' km/h' : '';
    if (speedTxt !== this.lastSpeed) {
      this.lastSpeed = speedTxt;
      this.el['speed'].textContent = speedTxt;
      this.el['speed-box'].style.display = G.player.car ? 'block' : 'none';
    }
    // crosshair only with pistol on foot
    this.el['crosshair'].style.display = (S.weapon === 'pistol' && G.player.onFoot) ? 'block' : 'none';
    // in-world clock: afternoon advances slowly
    const mins = Math.floor(S.clockMin + S.time / 10) % (24 * 60);
    this.el['clock'].textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    // context prompt (E to enter car / talk)
    let prompt = '';
    if (G.state.started && !G.state.over && G.player.onFoot) {
      const step = G.missions.currentStep();
      if (step && step.type === 'talk' && Math.hypot(G.player.pos.x - step.x, G.player.pos.z - step.z) < 4) prompt = '[E] Talk';
      else if (step && step.type === 'stealTruck' && G.missions.truck &&
        Math.hypot(G.player.pos.x - G.missions.truck.x, G.player.pos.z - G.missions.truck.z) < 5) prompt = '[E] Steal the vault truck';
      else if (G.vehicles.nearestParked(G.player.pos, 4.5)) prompt = '[E] Steal car';
    }
    if (G.state.started && !G.state.over && G.player.car) prompt = '[E] Exit car';
    this.el['prompt'].textContent = prompt;
    this.el['prompt'].style.display = prompt ? 'block' : 'none';

    this.drawMinimap();
    if (!this.el['bigmap'].classList.contains('hidden')) this.drawBigMap();
  }

  // --- maps ----------------------------------------------------------------
  drawMap(ctx, size) {
    const G = this.G;
    const scale = size / 620;
    const toPx = (x, z) => [(x + 310) * scale, (z + 310) * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#20262c';
    ctx.fillRect(0, 0, size, size);
    // ocean + beach
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(0, (300 + 310) * scale, size, size - (300 + 310) * scale);
    ctx.fillStyle = '#e6cf9a';
    ctx.fillRect(0, (240 + 310) * scale, size, (300 - 240) * scale);
    // park
    ctx.fillStyle = '#3f7a34';
    ctx.fillRect((-210 + 310) * scale, (-210 + 310) * scale, 60 * scale, 60 * scale);
    // airport tarmac
    ctx.fillStyle = '#4a4d52';
    ctx.fillRect((240 + 310) * scale, (-90 + 310) * scale, 60 * scale, 180 * scale);
    // roads
    ctx.fillStyle = '#3a3d42';
    for (const r of ROADS) {
      const [x0] = toPx(r - 6, 0);
      ctx.fillRect(x0, 0, 12 * scale, size);
      const [, z0] = toPx(0, r - 6);
      ctx.fillRect(0, z0, size, 12 * scale);
    }
    // buildings hint
    ctx.fillStyle = '#5a6270';
    // mission beacon
    if (G.missions.beaconTarget) {
      const [bx, by] = toPx(G.missions.beaconTarget.x, G.missions.beaconTarget.z);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(bx, by, size * 0.02, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, size * 0.035 + Math.sin(G.state.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // traffic + parked cars
    ctx.fillStyle = '#c8cdd4';
    for (const car of G.vehicles.allCars()) {
      if (car.wrecked) continue;
      const [cx, cy] = toPx(car.x, car.z);
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // police (red)
    ctx.fillStyle = '#ff4040';
    for (const car of G.police.cars) {
      const [cx, cy] = toPx(car.x, car.z);
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const cop of G.police.cops) {
      const [cx, cy] = toPx(cop.x, cop.z);
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const [px, py] = toPx(G.player.pos.x, G.player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    // map space: x right, z down; arrow drawn pointing up, rotate so it
    // points along the player's heading (sin h, cos h) in map space.
    ctx.rotate(Math.PI - G.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // north label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.max(10, size * 0.03) + 'px Arial';
    ctx.fillText('N', 8, size * 0.05);
    return { toPx, scale };
  }

  drawMinimap() {
    const size = 200;
    const ctx = this.mm;
    ctx.save();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
    this.drawMap(ctx, size);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  }

  drawBigMap() {
    const size = 560;
    const ctx = this.bm;
    this.drawMap(ctx, size);
    // labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial';
    const labels = [
      ['DOWNTOWN', 0, -40], ['VISTA BEACH', -120, 268], ['GOLDEN PALM CASINO', 180, -150],
      ['VISTA GENERAL', -180, 180], ['PALM COURT PARK', -180, -180],
      ['AIRPORT', 270, 0], ['HARBOR DOCKS', -252, 210], ["MARA'S GARAGE", 60, 246],
    ];
    const scale = size / 620;
    for (const [t, x, z] of labels) {
      ctx.fillText(t, (x + 310) * scale - 30, (z + 310) * scale);
    }
  }
}
