// Procedural town audio. Everything is synthesized with the Web Audio API; there are no files.
// Graph: pads + plucks -> music ─┐
//        wind, engines ──────────┴> ambience ─┐
//        build snaps, pops ──────────> fx ────┴> master (mute + fade) -> compressor -> speakers
//        reverb and echo returns ─────────────┘

const STORAGE_KEY = "memotown-sound";
const MASTER = 0.8;
const CHORD_SECONDS = 5;
const LOOKAHEAD = 2;
// Cmaj7 -> Am7 -> Fmaj7 -> G6, voiced low and close so the pad stays warm.
const CHORDS = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [41, 48, 52, 57],
  [43, 50, 52, 59],
];
// C major pentatonic, so plucks sit on every chord above.
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];

type Graph = {
  ctx: AudioContext;
  master: GainNode;
  ambience: GainNode;
  music: GainNode;
  fx: GainNode;
  verb: GainNode;
  echo: GainNode;
  engine: GainNode;
  noise: AudioBuffer;
};

let enabled = true;
let loaded = false;
let unlocked = false;
let traffic = 0;
let g: Graph | null = null;
let timer: number | undefined;
let nextChord = 0;
let chordIndex = 0;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const engineLevel = (cars: number) => (cars > 0 ? 0.014 + 0.0025 * Math.min(cars, 11) : 0);

function loadPref() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {}
}

function gain(ctx: BaseAudioContext, value: number, dest?: AudioNode) {
  const node = ctx.createGain();
  node.gain.value = value;
  if (dest) node.connect(dest);
  return node;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q: number, dest?: AudioNode) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = freq;
  node.Q.value = q;
  if (dest) node.connect(dest);
  return node;
}

function lfo(ctx: BaseAudioContext, rate: number, depth: number, ...params: AudioParam[]) {
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  const amount = gain(ctx, depth);
  osc.connect(amount);
  for (const p of params) amount.connect(p);
  osc.start();
}

// A short envelope: near-instant attack, exponential decay.
function hit(ctx: BaseAudioContext, t: number, peak: number, decay: number, dest: AudioNode) {
  const node = ctx.createGain();
  node.gain.setValueAtTime(0, t);
  node.gain.linearRampToValueAtTime(peak, t + 0.003);
  node.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  node.connect(dest);
  return node;
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function build(): Graph | null {
  const AC =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: "interactive" });

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  comp.connect(ctx.destination);

  const master = gain(ctx, 0, comp);
  const ambience = gain(ctx, 1, master);
  const music = gain(ctx, 0.3, ambience);
  const fx = gain(ctx, 1, master);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.2, 2.6);
  reverb.connect(gain(ctx, 0.35, master));
  const verb = gain(ctx, 1, reverb);

  // Feedback echo, darkened a little on every repeat.
  const echo = gain(ctx, 1);
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.42;
  echo.connect(delay);
  const damp = filter(ctx, "lowpass", 2200, 0.5);
  delay.connect(damp);
  damp.connect(gain(ctx, 0.32, delay));
  damp.connect(gain(ctx, 0.35, master));

  const noise = noiseBuffer(ctx, 6);

  // Wind: bandpassed noise that swells on two slow, unrelated LFOs.
  const wind = ctx.createBufferSource();
  wind.buffer = noise;
  wind.loop = true;
  const windGain = gain(ctx, 0.14, ambience);
  const windBand = filter(ctx, "bandpass", 520, 0.6, filter(ctx, "lowpass", 1500, 0.3, windGain));
  wind.connect(windBand);
  lfo(ctx, 0.043, 240, windBand.frequency);
  lfo(ctx, 0.031, 0.08, windGain.gain);
  wind.start();

  // Engines: detuned low saws with a slow pitch wobble and a fast rumble, plus a little road noise.
  const engine = gain(ctx, 0, ambience);
  const rumble = gain(ctx, 0.8, filter(ctx, "lowpass", 280, 0.9, engine));
  lfo(ctx, 9, 0.2, rumble.gain);
  const pitches: AudioParam[] = [];
  for (const [type, f, level] of [
    ["sawtooth", 52, 1],
    ["sawtooth", 52.7, 1],
    ["triangle", 78, 0.5],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    osc.connect(gain(ctx, level, rumble));
    osc.start();
    pitches.push(osc.frequency);
  }
  lfo(ctx, 0.17, 1.4, ...pitches);
  const road = ctx.createBufferSource();
  road.buffer = noise;
  road.loop = true;
  road.loopStart = 2.5;
  road.connect(filter(ctx, "lowpass", 320, 0.5, gain(ctx, 0.25, rumble)));
  road.start();
  engine.gain.setTargetAtTime(engineLevel(traffic), ctx.currentTime, 1.2);

  return { ctx, master, ambience, music, fx, verb, echo, engine, noise };
}

// A plucked sine with a quicker overtone: soft bell in the music, marimba in the build snap.
function tone(
  a: Graph,
  f: number,
  t: number,
  o: { level: number; decay: number; dest: AudioNode; partial: number; send: number; pan?: number },
) {
  const { ctx } = a;
  const out = ctx.createStereoPanner();
  out.pan.value = o.pan ?? 0;
  out.connect(o.dest);
  if (o.send) out.connect(gain(ctx, o.send, a.verb));
  const body = hit(ctx, t, o.level, o.decay, out);
  const osc = ctx.createOscillator();
  osc.frequency.value = f;
  osc.detune.value = (Math.random() - 0.5) * 8;
  osc.connect(body);
  osc.start(t);
  osc.stop(t + o.decay + 0.05);
  if (o.partial) {
    const over = ctx.createOscillator();
    over.frequency.value = f * o.partial;
    over.connect(hit(ctx, t, o.level * 0.18, o.decay * 0.3, out));
    over.start(t);
    over.stop(t + o.decay * 0.3 + 0.05);
  }
  return out;
}

function chord(a: Graph, notes: number[], t: number, dur: number) {
  const { ctx } = a;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.05, t + 1.6);
  env.gain.setValueAtTime(0.05, t + dur - 0.2);
  env.gain.linearRampToValueAtTime(0, t + dur + 2.2);
  const lp = filter(ctx, "lowpass", 700, 0.3, a.music);
  lp.connect(gain(ctx, 0.5, a.verb));
  lp.frequency.setValueAtTime(600, t);
  lp.frequency.linearRampToValueAtTime(1300, t + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(700, t + dur + 2);
  env.connect(lp);
  for (const m of notes) {
    for (const [type, cents] of [
      ["triangle", -7],
      ["sine", 6],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz(m);
      osc.detune.value = cents;
      osc.connect(env);
      osc.start(t);
      osc.stop(t + dur + 2.4);
    }
  }
  // A few soft pentatonic bells drifting over the pad.
  const plucks = Math.floor(Math.random() * 3);
  for (let i = 0; i < plucks; i++) {
    const when = t + 0.8 + Math.random() * (dur - 1.2);
    const out = tone(a, hz(pick(PENTA)), when, {
      level: 0.035,
      decay: 1.8,
      dest: a.music,
      partial: 2,
      send: 0.8,
      pan: (Math.random() - 0.5) * 0.8,
    });
    out.connect(a.echo);
  }
}

function schedule() {
  if (!g) return;
  const now = g.ctx.currentTime;
  if (nextChord < now) nextChord = now + 0.1;
  while (nextChord < now + LOOKAHEAD) {
    chord(g, CHORDS[chordIndex % CHORDS.length], nextChord, CHORD_SECONDS);
    chordIndex++;
    nextChord += CHORD_SECONDS;
  }
}

function start() {
  if (!g) g = build();
  if (!g) return;
  if (g.ctx.state !== "running") void g.ctx.resume().catch(() => {});
  const t = g.ctx.currentTime;
  g.master.gain.cancelScheduledValues(t);
  g.master.gain.setTargetAtTime(MASTER, t, 0.6);
  if (timer === undefined) {
    schedule();
    timer = window.setInterval(schedule, 500);
  }
}

function stop() {
  window.clearInterval(timer);
  timer = undefined;
  if (!g) return;
  const { ctx, master } = g;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  window.setTimeout(() => {
    if (timer === undefined) void ctx.suspend().catch(() => {});
  }, 500);
}

// The graph, only when sound is on and actually playing; everything else no-ops.
function live() {
  return g && enabled && timer !== undefined && g.ctx.state === "running" ? g : null;
}

export const sound = {
  // Call from a user gesture: browsers only let audio start from one.
  unlock(): void {
    loadPref();
    unlocked = true;
    if (enabled) start();
  },
  // Fade out and go quiet until the next unlock(), e.g. when the town unmounts.
  pause(): void {
    unlocked = false;
    stop();
  },
  setEnabled(on: boolean): void {
    loadPref();
    enabled = on;
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch {}
    if (!unlocked) return;
    if (on) start();
    else stop();
  },
  isEnabled(): boolean {
    loadPref();
    return enabled;
  },
  setTraffic(cars: number): void {
    traffic = cars;
    if (g) g.engine.gain.setTargetAtTime(engineLevel(cars), g.ctx.currentTime, 1.2);
  },
  // The dopamine moment: a toy snap, then a rising marimba arpeggio (plus a shimmer for a new building).
  playBuild(kind: "floor" | "building"): void {
    const a = live();
    if (!a) return;
    const { ctx } = a;
    const t = ctx.currentTime + 0.005;
    const snap = ctx.createBufferSource();
    snap.buffer = a.noise;
    snap.connect(filter(ctx, "highpass", 2400, 0.7, hit(ctx, t, 0.3, 0.025, a.fx)));
    snap.start(t, Math.random() * 5, 0.04);
    const tock = ctx.createOscillator();
    tock.frequency.setValueAtTime(1500, t);
    tock.frequency.exponentialRampToValueAtTime(260, t + 0.035);
    tock.connect(hit(ctx, t, 0.35, 0.06, a.fx));
    tock.start(t);
    tock.stop(t + 0.08);
    const notes = kind === "building" ? [72, 76, 79, 84] : [76, 79, 84];
    notes.forEach((m, i) =>
      tone(a, hz(m), t + 0.012 + i * 0.055, { level: 0.2, decay: 0.42, dest: a.fx, partial: 4, send: 0.25 }),
    );
    if (kind === "building") {
      for (let i = 0; i < 6; i++) {
        tone(a, hz(pick([91, 96, 100, 103])), t + 0.17 + i * 0.045 + Math.random() * 0.02, {
          level: 0.03,
          decay: 0.2,
          dest: a.fx,
          partial: 0,
          send: 0.6,
          pan: (Math.random() - 0.5) * 1.4,
        });
      }
    }
  },
  // A soft bubbly plip that climbs a little with each card in the stagger.
  playPop(index: number): void {
    const a = live();
    if (!a) return;
    const { ctx } = a;
    const t = ctx.currentTime + 0.003;
    const f = 620 * 2 ** (Math.min(Math.max(index, 0), 8) / 8);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f * 0.55, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.6;
    pan.connect(a.fx);
    pan.connect(gain(ctx, 0.15, a.verb));
    osc.connect(hit(ctx, t, 0.09, 0.09, pan));
    osc.start(t);
    osc.stop(t + 0.12);
  },
};
