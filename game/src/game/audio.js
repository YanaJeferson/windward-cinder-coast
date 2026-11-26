// Procedural sound: a radial engine, wind over the wing, ring chimes and the thud of tyres.
// No audio files; everything is oscillators and noise created after the first player gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let started = false;
  let muted = false;
  let lastBeep = 0;

  function noiseBuffer(seconds = 2) {
    const rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.94 + white * 0.06;
      data[i] = white * 0.55 + last * 2.2;
    }
    return buffer;
  }

  function start() {
    if (started) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 620;
    engineFilter.Q.value = 1.6;
    engineGain.connect(engineFilter);
    engineFilter.connect(master);

    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 72;
    engine.connect(engineGain);
    engine.start();

    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 36;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.16;
    sub.connect(subGain);
    subGain.connect(engineFilter);
    sub.start();

    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(3);
    wind.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.7;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start();

    started = true;
  }

  function update(flight, dt) {
    if (!started || muted) return;
    const now = ctx.currentTime;
    const throttle = flight.engineOn ? flight.throttle : 0;
    const rpm = flight.engineOn ? 620 + throttle * 1650 : 0;
    engine.frequency.setTargetAtTime(Math.max(24, rpm / 16.5), now, 0.12);
    engineGain.gain.setTargetAtTime(flight.engineOn ? 0.034 + throttle * 0.05 : 0, now, 0.25);
    const wind = Math.min(1, flight.speed / 95);
    windGain.gain.setTargetAtTime(0.016 + wind * 0.07, now, 0.2);
    windFilter.frequency.setTargetAtTime(340 + wind * 900, now, 0.2);

    if (flight.stall && now - lastBeep > 0.55) {
      lastBeep = now;
      beep(760, 0.11, 0.05);
    }
  }

  function tone(freq, duration, gain = 0.08, type = 'sine', when = 0) {
    if (!started || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function beep(freq, duration, gain) {
    tone(freq, duration, gain, 'square');
  }

  function gate(index = 0) {
    const base = 660 + (index % 5) * 45;
    tone(base, 0.18, 0.06, 'sine');
    tone(base * 1.5, 0.24, 0.045, 'sine', 0.08);
  }

  function thud(strength = 1) {
    if (!started || muted) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * strength, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + 0.4);
  }

  function crash() {
    if (!started || muted) return;
    thud(2.2);
    tone(90, 0.9, 0.16, 'sawtooth');
    tone(54, 1.2, 0.12, 'square', 0.05);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
    return muted;
  }

  return { start, update, gate, thud, crash, tone, toggleMute, get muted() { return muted; } };
}
