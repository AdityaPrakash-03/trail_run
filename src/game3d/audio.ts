// All sound is synthesised with WebAudio. There are no audio files to download.
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const KEY = "trial-run-muted-v1";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeSound(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* storage can be blocked, sound still works for this visit */
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.9, ctx.currentTime, 0.02);
  emit();
}

/** Must be called from a user gesture at least once. Safe to call many times. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return;
    try {
      ctx = new Ctor();
    } catch {
      return;
    }
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(compressor);
    compressor.connect(ctx.destination);
    const len = ctx.sampleRate;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function ready() {
  return !!ctx && !!sfxBus && ctx.state === "running" && !muted;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  bus: GainNode,
  endFreq?: number,
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

function burst(
  start: number,
  dur: number,
  gain: number,
  bus: GainNode,
  filter: BiquadFilterType,
  f0: number,
  f1: number,
) {
  if (!ctx || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(f0, start);
  f.frequency.exponentialRampToValueAtTime(f1, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(start);
  src.stop(start + dur + 0.03);
}

const note = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

export const sfx = {
  ui() {
    if (!ready() || !ctx || !sfxBus) return;
    tone(720, ctx.currentTime, 0.05, "sine", 0.07, sfxBus, 480);
  },
  coin(combo: number) {
    if (!ready() || !ctx || !sfxBus) return;
    const t = ctx.currentTime;
    const base = note(15 + Math.min(combo, 9));
    tone(base, t, 0.09, "triangle", 0.2, sfxBus);
    tone(base * 1.5, t + 0.055, 0.16, "sine", 0.17, sfxBus);
  },
  hit() {
    if (!ready() || !ctx || !sfxBus) return;
    const t = ctx.currentTime;
    burst(t, 0.28, 0.5, sfxBus, "lowpass", 1800, 120);
    tone(150, t, 0.25, "sine", 0.45, sfxBus, 45);
  },
  beep(final: boolean) {
    if (!ready() || !ctx || !sfxBus) return;
    const t = ctx.currentTime;
    if (final) {
      tone(note(15), t, 0.32, "square", 0.12, sfxBus);
      tone(note(22), t, 0.32, "triangle", 0.12, sfxBus);
    } else {
      tone(note(3), t, 0.12, "square", 0.1, sfxBus);
    }
  },
  tick() {
    if (!ready() || !ctx || !sfxBus) return;
    tone(1100, ctx.currentTime, 0.04, "square", 0.05, sfxBus);
  },
  end(good: boolean) {
    if (!ready() || !ctx || !sfxBus) return;
    const t = ctx.currentTime;
    const notes = good ? [3, 7, 10, 15] : [3, 0, -4, -9];
    notes.forEach((n, i) => {
      tone(note(n), t + i * 0.09, 0.22, good ? "triangle" : "sawtooth", good ? 0.2 : 0.1, sfxBus!);
    });
  },
  bonus() {
    if (!ready() || !ctx || !sfxBus) return;
    const t = ctx.currentTime;
    [3, 7, 10, 15, 19, 22, 27].forEach((n, i) => {
      tone(note(n), t + i * 0.07, 0.2, "triangle", 0.15, sfxBus!);
      tone(note(n + 12), t + i * 0.07 + 0.02, 0.16, "sine", 0.06, sfxBus!);
    });
  },
  redeem() {
    if (!ready() || !ctx || !sfxBus) return;
    const t = ctx.currentTime;
    [
      [3, 7, 10],
      [5, 8, 12],
      [7, 10, 14],
      [15, 19, 22],
    ].forEach((chord, i) =>
      chord.forEach((n) => tone(note(n), t + i * 0.14, i === 3 ? 0.7 : 0.18, "triangle", 0.13, sfxBus!)),
    );
    burst(t + 0.42, 0.5, 0.12, sfxBus, "highpass", 3000, 8000);
  },
  swoosh() {
    if (!ready() || !ctx || !sfxBus) return;
    burst(ctx.currentTime, 0.22, 0.12, sfxBus, "bandpass", 500, 3000);
  },
};

// Small looping groove: kick, bass, hat, arp. A minor, Am F C G.
let musicTimer: number | null = null;
let nextTime = 0;
let step = 0;
const BPM = 118;
const STEP = 60 / BPM / 4;
const ROOTS = [-24, -28, -21, -26]; // A1 F1 C2 G1 relative to A4 in semitones
const CHORDS = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];

function scheduleStep(s: number, t: number) {
  if (!ctx || !musicBus) return;
  const bar = Math.floor(s / 16) % 4;
  const i = s % 16;
  if (i % 4 === 0) tone(130, t, 0.14, "sine", 0.34, musicBus, 42);
  if ([0, 3, 6, 8, 11, 14].includes(i)) {
    const f = note(ROOTS[bar]! + (i === 14 ? 12 : 0));
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    lp.type = "lowpass";
    lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 2.2);
    osc.connect(lp);
    lp.connect(g);
    g.connect(musicBus);
    osc.start(t);
    osc.stop(t + STEP * 2.4);
  }
  if (i % 2 === 1) burst(t, 0.04, 0.05, musicBus, "highpass", 7000, 9000);
  if (i % 4 === 2) burst(t, 0.1, 0.09, musicBus, "bandpass", 1800, 1500);
  if (i % 2 === 0) {
    const chord = CHORDS[bar]!;
    const n = chord[(i / 2) % 3]!;
    tone(note(n + 12), t, 0.16, "triangle", 0.07, musicBus);
  }
}

export const music = {
  start() {
    if (!ctx || !musicBus || musicTimer !== null) return;
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    musicTimer = window.setInterval(() => {
      if (!ctx) return;
      while (nextTime < ctx.currentTime + 0.14) {
        if (!muted) scheduleStep(step, nextTime);
        nextTime += STEP;
        step++;
      }
    }, 28);
  },
  stop() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  },
};

export function vibrate(ms: number) {
  try {
    if (!muted && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* not supported */
  }
}
