// audio.js — all sound is synthesized with WebAudio: no audio files.
// Engine hum, gunshots, sirens, pickups, stings and a mission bass loop.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.enabled = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
      this.startEngine();
    } catch (e) {
      this.enabled = false;
    }
  }

  setMuted(m) {
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // --- engine loop (sawtooth through a lowpass, pitch follows speed) ---
  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, driving) {
    if (!this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 95, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.1);
  }

  // --- one-shot helpers ---
  noiseBurst(dur, filterFreq, gain, type = 'lowpass') {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  tone(freq, dur, gain, type = 'sine', slideTo = null) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  gunshot() { this.noiseBurst(0.16, 1800, 0.5, 'bandpass'); this.tone(160, 0.1, 0.35, 'square', 60); }
  enemyShot() { this.noiseBurst(0.12, 1200, 0.22, 'bandpass'); }
  dryFire() { this.tone(1200, 0.05, 0.12, 'square'); }
  punch() { this.noiseBurst(0.09, 500, 0.4); }
  crash() { this.noiseBurst(0.3, 400, 0.5); }
  crashSoft() { this.noiseBurst(0.12, 300, 0.16); }
  door() { this.tone(220, 0.08, 0.2, 'square', 140); }
  hurt() { this.tone(180, 0.18, 0.3, 'sawtooth', 90); }
  explosion() { this.noiseBurst(0.9, 300, 0.9); this.tone(70, 0.7, 0.5, 'sine', 30); }
  reload() { this.tone(600, 0.06, 0.18, 'square'); setTimeout(() => this.tone(900, 0.06, 0.18, 'square'), 110); }
  pickup() { this.tone(880, 0.1, 0.25); setTimeout(() => this.tone(1320, 0.16, 0.25), 90); }
  sirenBurst() { this.tone(700, 0.3, 0.2, 'sine', 1100); }
  fail() { this.tone(220, 0.5, 0.3, 'sawtooth', 110); }
  click() { this.tone(1000, 0.04, 0.12, 'square'); }

  sting() {
    // mission-complete fanfare: four rising notes
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.35, 0.28, 'triangle'), i * 120));
  }

  missionStart() {
    const notes = [392, 523, 659];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.25, 0.22, 'triangle'), i * 100));
  }

  // --- two-tone police siren ---
  setSiren(on) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (on && !this.sirenOsc) {
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 750;
      this.sirenLfo = ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.05;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null; this.sirenLfo = null; this.sirenGain = null;
    }
  }

  // --- mission music: a simple bass + hat loop, scheduled on a timer ---
  startMusic() {
    if (!this.enabled || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0];
    this.musicTimer = setInterval(() => {
      if (!this.enabled) return;
      const n = bass[this.musicStep % bass.length];
      if (n) this.tone(n, 0.22, 0.16, 'triangle');
      if (this.musicStep % 4 === 2) this.noiseBurst(0.04, 6000, 0.05, 'highpass');
      this.musicStep++;
    }, 170);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
