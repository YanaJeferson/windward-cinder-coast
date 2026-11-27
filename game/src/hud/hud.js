// The glass: a warm, thin-line HUD drawn over the 3D scene. Compass ribbon, speed and altitude
// tapes, a pitch ladder that rolls with the wing, engine and fuel strips, and the mission card.
import { altitudeFt, speedKts, verticalFpm } from '../aircraft/flight.js';
import { clamp, formatTime, pad, wrapDeg } from '../util/math.js';

const CREAM = 'rgba(255,241,210,0.94)';
const DIM = 'rgba(255,241,210,0.5)';
const FAINT = 'rgba(255,241,210,0.24)';
const AMBER = '#ffb45c';
const TEAL = '#7ff0de';
const WARN = '#ff5646';

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function panel(g, x, y, w, h, r = 8, fill = 'rgba(10,16,18,0.5)') {
  roundRect(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = 'rgba(255,241,210,0.16)';
  g.lineWidth = 1;
  g.stroke();
}

export function createHud(canvas) {
  const g = canvas.getContext('2d');
  let W = 1280;
  let H = 720;
  let s = 1;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    s = H / 720;
  }
  resize();
  window.addEventListener('resize', resize);

  function tape(g, x, y, h, value, step, pxPerUnit, side, label, unit, digits = 0) {
    const half = h / 2;
    panel(g, side < 0 ? x - 62 * s : x - 10 * s, y - half - 24 * s, 72 * s, h + 48 * s, 6, 'rgba(10,16,19,0.5)');
    g.save();
    g.beginPath();
    g.rect(x - 66 * s, y - half, 132 * s, h);
    g.clip();
    g.strokeStyle = DIM;
    g.lineWidth = 1;
    g.textAlign = side < 0 ? 'right' : 'left';
    g.font = `600 ${11 * s}px "SF Mono", Consolas, monospace`;
    const first = Math.floor((value - h / pxPerUnit / 2) / step) * step;
    const last = value + h / pxPerUnit / 2;
    for (let v = first; v <= last; v += step) {
      const yy = y - (v - value) * pxPerUnit;
      const major = Math.abs(v % (step * 2)) < 1e-6;
      g.beginPath();
      g.moveTo(x - (side < 0 ? 8 : 0) * s, yy);
      g.lineTo(x - (side < 0 ? 30 : 22) * s * (major ? 1 : 0.55), yy);
      g.strokeStyle = major ? CREAM : FAINT;
      g.stroke();
      if (major) {
        g.fillStyle = DIM;
        g.fillText(side < 0 ? String(Math.round(v)) : String(Math.round(v)), side < 0 ? x - 34 * s : x + 26 * s, yy + 3.5 * s);
      }
    }
    g.restore();

    // Current-value bug.
    const bw = 62 * s;
    const bx = side < 0 ? x - 66 * s : x - 4 * s;
    const bh = 24 * s;
    roundRect(g, bx, y - bh / 2, bw, bh, 3);
    g.fillStyle = 'rgba(255,241,210,0.94)';
    g.fill();
    g.fillStyle = '#141a1c';
    g.font = `700 ${16 * s}px "SF Mono", Consolas, monospace`;
    g.textAlign = 'center';
    g.fillText(Math.round(value).toString().padStart(digits, '0'), bx + bw / 2, y + 6 * s);
    g.fillStyle = DIM;
    g.font = `600 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = side < 0 ? 'left' : 'right';
    g.fillText(label, side < 0 ? x - 60 * s : x + 62 * s, y - half - 8 * s);
    g.fillStyle = FAINT;
    g.fillText(unit, side < 0 ? x - 60 * s : x + 62 * s, y + half + 20 * s);
  }

  function compass(g, cx, y, heading) {
    const w = 430 * s;
    const h = 34 * s;
    panel(g, cx - w / 2, y, w, h, 4, 'rgba(10,16,18,0.36)');
    g.save();
    g.beginPath();
    g.rect(cx - w / 2 + 2, y, w - 4, h);
    g.clip();
    const pxPerDeg = w / 110;
    g.textAlign = 'center';
    const start = Math.ceil((heading - 56) / 5) * 5;
    for (let v = start; v <= heading + 56; v += 5) {
      const x = cx + (v - heading) * pxPerDeg;
      const compassDeg = wrapDeg(v);
      const major = Math.abs(compassDeg % 30) < 0.01;
      g.beginPath();
      g.moveTo(x, y + h - (major ? 15 : 8) * s);
      g.lineTo(x, y + h - 2 * s);
      g.strokeStyle = major ? CREAM : FAINT;
      g.lineWidth = major ? 1.4 : 1;
      g.stroke();
      if (major) {
        g.fillStyle = DIM;
        g.font = `600 ${10 * s}px "SF Mono", Consolas, monospace`;
        const card = compassDeg === 0 ? 'N' : compassDeg === 90 ? 'E' : compassDeg === 180 ? 'S' : compassDeg === 270 ? 'W' : pad(compassDeg / 10, 2);
        g.fillText(card, x, y + 15 * s);
      }
    }
    g.restore();
    // Pointer and boxed heading.
    g.beginPath();
    g.moveTo(cx, y + h + 6 * s);
    g.lineTo(cx - 5 * s, y + h + 14 * s);
    g.lineTo(cx + 5 * s, y + h + 14 * s);
    g.closePath();
    g.fillStyle = AMBER;
    g.fill();
    roundRect(g, cx - 30 * s, y + h + 14 * s, 60 * s, 24 * s, 3);
    g.fillStyle = 'rgba(10,16,18,0.72)';
    g.fill();
    g.strokeStyle = 'rgba(255,180,92,0.6)';
    g.stroke();
    g.fillStyle = AMBER;
    g.font = `700 ${17 * s}px "SF Mono", Consolas, monospace`;
    g.textAlign = 'center';
    g.fillText(pad(heading, 3), cx, y + h + 31 * s);
  }

  function ladder(g, cx, cy, pitch, bank) {
    const R = 212 * s;
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(bank);
    const pxPerDeg = 7.4 * s;
    for (let deg = -40; deg <= 40; deg += 5) {
      if (deg === 0) continue;
      const y = (deg - pitch) * -pxPerDeg;
      if (Math.abs(y) > R) continue;
      const w = deg % 10 === 0 ? 150 : 76;
      g.strokeStyle = deg % 10 === 0 ? 'rgba(255,241,210,0.62)' : 'rgba(255,241,210,0.32)';
      g.lineWidth = 1.2;
      g.beginPath();
      if (deg < 0) {
        g.setLineDash([7 * s, 7 * s]);
      } else {
        g.setLineDash([]);
      }
      g.moveTo(-w * s, y);
      g.lineTo(-w * 0.42 * s, y);
      g.moveTo(w * 0.42 * s, y);
      g.lineTo(w * s, y);
      g.stroke();
      g.setLineDash([]);
      if (deg % 10 === 0) {
        g.fillStyle = 'rgba(255,241,210,0.58)';
        g.font = `600 ${10 * s}px "SF Mono", Consolas, monospace`;
        g.textAlign = 'right';
        g.fillText(String(Math.abs(deg)), -w * s - 5 * s, y + 3 * s);
        g.textAlign = 'left';
        g.fillText(String(Math.abs(deg)), w * s + 5 * s, y + 3 * s);
      }
    }
    // Horizon.
    const hy = -pitch * -pxPerDeg;
    if (Math.abs(hy) < R) {
      g.strokeStyle = 'rgba(255,241,210,0.78)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.setLineDash([30 * s, 10 * s]);
      g.moveTo(-R * 0.78, hy);
      g.lineTo(R * 0.78, hy);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();

    // Bank arc and pointer.
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = 'rgba(255,241,210,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, 122 * s, -Math.PI * 0.84, -Math.PI * 0.16);
    g.stroke();
    for (const tick of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const a = -Math.PI / 2 + THREEdeg(tick);
      g.beginPath();
      g.moveTo(Math.cos(a) * 122 * s, Math.sin(a) * 122 * s);
      g.lineTo(Math.cos(a) * (tick % 30 === 0 ? 112 : 116) * s, Math.sin(a) * (tick % 30 === 0 ? 112 : 116) * s);
      g.stroke();
    }
    const ba = -Math.PI / 2 - bank;
    g.beginPath();
    g.moveTo(Math.cos(ba) * 128 * s, Math.sin(ba) * 128 * s);
    g.lineTo(Math.cos(ba + 0.035) * 118 * s, Math.sin(ba + 0.035) * 118 * s);
    g.lineTo(Math.cos(ba - 0.035) * 118 * s, Math.sin(ba - 0.035) * 118 * s);
    g.closePath();
    g.fillStyle = AMBER;
    g.fill();
    g.restore();
  }

  function reticle(g, cx, cy) {
    g.strokeStyle = CREAM;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(cx, cy, 3.4 * s, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 34 * s, cy); g.lineTo(cx - 12 * s, cy);
    g.moveTo(cx + 12 * s, cy); g.lineTo(cx + 34 * s, cy);
    g.moveTo(cx, cy - 10 * s); g.lineTo(cx, cy - 4 * s);
    g.stroke();
    // Little wingtips.
    g.beginPath();
    g.moveTo(cx - 26 * s, cy + 5 * s); g.lineTo(cx - 26 * s, cy + 9 * s);
    g.moveTo(cx + 26 * s, cy + 5 * s); g.lineTo(cx + 26 * s, cy + 9 * s);
    g.stroke();
  }

  function gateBracket(g, point, label, distance, offscreen) {
    const x = clamp(point.x, 250 * s, W - 250 * s);
    const y = clamp(point.y, 110 * s, H - 170 * s);
    g.strokeStyle = offscreen ? 'rgba(255,180,92,0.55)' : 'rgba(127,240,222,0.85)';
    g.lineWidth = 1.4;
    const r = 17 * s;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.beginPath();
      g.moveTo(x + dx * r, y + dy * r - dy * 8 * s);
      g.lineTo(x + dx * r, y + dy * r);
      g.lineTo(x + dx * r - dx * 8 * s, y + dy * r);
      g.stroke();
    }
    g.fillStyle = offscreen ? AMBER : TEAL;
    g.font = `600 ${10.5 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center';
    g.fillText(label, x, y - 23 * s);
    g.fillStyle = DIM;
    g.font = `600 ${10 * s}px "SF Mono", Consolas, monospace`;
    g.fillText(distance, x, y + 28 * s);
    if (offscreen) {
      g.beginPath();
      g.arc(x, y, 7 * s, 0, Math.PI * 2);
      g.fillStyle = AMBER;
      g.fill();
    }
  }

  function bars(g, x, y, flight) {
    const w = 172 * s;
    panel(g, x, y, w, 94 * s, 6, 'rgba(10,16,18,0.42)');
    const rows = [
      ['THR', flight.throttle * 100, '%', AMBER],
      ['FUEL', flight.fuel, 'L', flight.fuel < 22 ? WARN : TEAL],
      ['DMG', flight.damage, '%', flight.damage > 40 ? WARN : CREAM],
    ];
    rows.forEach(([label, value, unit, color], i) => {
      const ry = y + 16 * s + i * 25 * s;
      g.fillStyle = DIM;
      g.font = `600 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
      g.textAlign = 'left';
      g.fillText(label, x + 10 * s, ry);
      g.fillStyle = 'rgba(255,241,210,0.12)';
      g.fillRect(x + 46 * s, ry - 6 * s, 84 * s, 5 * s);
      g.fillStyle = color;
      g.fillRect(x + 46 * s, ry - 6 * s, 84 * s * clamp(value / 100, 0, 1), 5 * s);
      g.fillStyle = CREAM;
      g.font = `700 ${11 * s}px "SF Mono", Consolas, monospace`;
      g.textAlign = 'right';
      g.fillText(`${Math.round(value)}${unit}`, x + w - 10 * s, ry);
    });
    // Gear and flap pills.
    const pills = [['GEAR', flight.gearDown, TEAL], ['FLAP', flight.flaps > 0.4, AMBER], ['PARK', flight.parkingBrake, WARN]];
    pills.forEach(([label, on, color], i) => {
      const px = x + 8 * s + i * 50 * s;
      roundRect(g, px, y + 90 * s - 22 * s, 44 * s, 15 * s, 3);
      g.fillStyle = on ? color : 'rgba(255,241,210,0.08)';
      g.fill();
      g.fillStyle = on ? '#101618' : DIM;
      g.font = `700 ${8 * s}px "Helvetica Neue", Arial, sans-serif`;
      g.textAlign = 'center';
      g.fillText(label, px + 22 * s, y + 90 * s - 11.5 * s);
    });
  }

  function missionCard(g, x, y, mission, flight, nextGate) {
    const w = 240 * s;
    const h = 88 * s;
    panel(g, x - w, y, w, h, 6, 'rgba(10,16,18,0.44)');
    g.textAlign = 'right';
    g.fillStyle = AMBER;
    g.font = `700 ${10 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(mission.name.toUpperCase(), x - 12 * s, y + 17 * s);
    g.fillStyle = CREAM;
    g.font = `500 ${10.5 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(mission.objective, x - 12 * s, y + 33 * s);
    g.fillStyle = DIM;
    g.font = `600 ${9.5 * s}px "SF Mono", Consolas, monospace`;
    const total = mission.gates.length;
    const dist = nextGate ? `${(nextGate / 1000).toFixed(1)} KM` : total ? 'FINAL' : 'LAND 36';
    g.fillText(total ? `${mission.gateIndex + 1}/${total}  ${dist}` : dist, x - 12 * s, y + 51 * s);
    const timed = mission.timeLimit !== null;
    g.fillStyle = timed && mission.timeLeft < 30 ? WARN : CREAM;
    g.font = `700 ${14 * s}px "SF Mono", Consolas, monospace`;
    g.fillText(timed ? formatTime(mission.timeLeft) : `FREE ${formatTime(mission.elapsed)}`, x - 12 * s, y + 72 * s);
    g.fillStyle = flight.assist ? TEAL : AMBER;
    g.font = `600 ${8 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(flight.assist ? 'ASSIST' : 'PRO', x - 12 * s, y + 83 * s);
  }

  function draw(state) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { flight, mission, gateScreen, warnings = [] } = state;
    const cx = W / 2;
    const cy = H / 2;

    if (state.hideHud) {
      if (state.stage) state.stage(g, W, H, s);
      return;
    }

    // Top-left wordmark and mission.
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,241,210,0.86)';
    g.font = `700 ${15 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText('WINDWARD', 34 * s, 38 * s);
    g.fillStyle = DIM;
    g.font = `600 ${9 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText('CINDER COAST', 34 * s, 52 * s);
    if (state.wind) {
      g.fillStyle = 'rgba(255,241,210,0.62)';
      g.font = `600 ${9.5 * s}px "SF Mono", Consolas, monospace`;
      const w = state.wind;
      g.fillText(`WIND ${pad(w.from, 3)}° / ${Math.round(w.speed)} KT${w.gust ? ' G' + Math.round(w.gust) : ''}`, 34 * s, 68 * s);
    }
    if (state.engine) {
      g.fillStyle = state.engine === 'OUT' ? AMBER : state.engine === 'START' ? TEAL : 'rgba(255,241,210,0.55)';
      g.font = `600 ${9.5 * s}px "SF Mono", Consolas, monospace`;
      g.fillText(`ENGINE ${state.engine}`, 34 * s, 84 * s);
    }
    if (state.weatherLabel) {
      g.fillStyle = 'rgba(255,241,210,0.5)';
      g.font = `600 ${9.5 * s}px "SF Mono", Consolas, monospace`;
      g.fillText(`WX ${state.weatherLabel}`, 34 * s, 100 * s);
    }

    compass(g, cx, 22 * s, flight.heading);
    if (!state.compact) {
      tape(g, 86 * s, cy + 8 * s, 236 * s, speedKts(flight), 10, 2.1 * s, -1, 'IAS', 'KNOTS');
      const alt = altitudeFt(flight);
      tape(g, W - 86 * s, cy + 8 * s, 236 * s, alt, 100, 0.21 * s, 1, 'ALT', 'FEET');
    }
    if (!state.compact) ladder(g, cx, cy + 18 * s, flight.pitchDeg ?? 0, flight.bank);
    reticle(g, cx, cy + 18 * s);

    if (!state.compact) {
      const vs = verticalFpm(flight);
      const vy = cy + 8 * s - clamp(vs / 1000, -1, 1) * 100 * s;
      g.fillStyle = TEAL;
      g.beginPath();
      g.moveTo(W - 152 * s, vy);
      g.lineTo(W - 162 * s, vy - 4 * s);
      g.lineTo(W - 162 * s, vy + 4 * s);
      g.closePath();
      g.fill();
      g.fillStyle = DIM;
      g.font = `600 ${9 * s}px "SF Mono", Consolas, monospace`;
      g.textAlign = 'right';
      g.fillText(`${vs >= 0 ? '+' : ''}${Math.round(vs / 10) * 10}`, W - 166 * s, vy + 3 * s);

      bars(g, 34 * s, H - 128 * s, flight);
    }

    if (mission) {
      const next = gateScreen ? gateScreen.distance : null;
      if (!state.compact) missionCard(g, W - 30 * s, H - 118 * s, mission, flight, next);
      if (gateScreen) gateBracket(g, gateScreen, `GATE ${mission.gateIndex + 1}`, `${(gateScreen.distance / 1000).toFixed(2)} KM`, gateScreen.offscreen);
    }

    // Speed streaks: a little of the Vertigo-style sense of motion at the edges of the glass.
    if (state.speedFx) {
      const intensity = state.speedFx;
      g.save();
      g.strokeStyle = 'rgba(255,246,224,0.5)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 20; i += 1) {
        const a = (i / 20) * Math.PI * 2 + 0.2;
        const inner = 0.42 + (i % 3) * 0.08;
        const outer = 1.05;
        const cx = W / 2;
        const cy = H / 2;
        g.globalAlpha = intensity * (0.28 + (i % 4) * 0.09);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * W * inner * 0.5, cy + Math.sin(a) * H * inner * 0.5);
        g.lineTo(cx + Math.cos(a) * W * outer * 0.5, cy + Math.sin(a) * H * outer * 0.5);
        g.stroke();
      }
      g.restore();
    }

    // Warnings, stacked under the reticle.
    let wy = cy + 108 * s;
    for (const w of warnings) {
      if (!w) continue;
      g.font = `700 ${15 * s}px "Helvetica Neue", Arial, sans-serif`;
      g.textAlign = 'center';
      g.fillStyle = w.color || WARN;
      g.fillText(w.text, cx, wy);
      wy += 21 * s;
    }

    if (state.groundPrompt) {
      g.textAlign = 'center';
      g.fillStyle = 'rgba(10,16,18,0.62)';
      const text = state.groundPrompt.text;
      g.font = `700 ${11 * s}px "SF Mono", Consolas, monospace`;
      const tw = g.measureText(text).width + 34 * s;
      roundRect(g, cx - tw / 2, H - 238 * s, tw, 30 * s, 4);
      g.fill();
      g.fillStyle = state.groundPrompt.color;
      g.fillText(text, cx, H - 218 * s);
    }

    if (state.touchdown) {
      g.textAlign = 'center';
      g.fillStyle = 'rgba(10,16,18,0.66)';
      g.font = `700 ${12 * s}px "SF Mono", Consolas, monospace`;
      const tw = g.measureText(state.touchdown).width + 30 * s;
      roundRect(g, cx - tw / 2, H - 280 * s, tw, 28 * s, 4);
      g.fill();
      g.fillStyle = PALETTE.teal;
      g.fillText(state.touchdown, cx, H - 261 * s);
    }

    // First seconds of a sortie: show which keys the game is actually seeing.
    if (state.keys) {
      const held = new Set(state.keys);
      const row = [['W', 'KeyW'], ['A', 'KeyA'], ['S', 'KeyS'], ['D', 'KeyD'], ['↑', 'ArrowUp'], ['←', 'ArrowLeft'], ['↓', 'ArrowDown'], ['→', 'ArrowRight']];
      const cell = 24 * s;
      const width = row.length * cell + 12 * s;
      const x0 = cx - width / 2;
      const y0 = H - 34 * s;
      g.fillStyle = 'rgba(10,16,18,0.5)';
      roundRect(g, x0, y0, width, 24 * s, 3);
      g.fill();
      row.forEach(([label, code], i) => {
        const on = held.has(code);
        g.fillStyle = on ? AMBER : 'rgba(255,241,210,0.32)';
        g.font = `700 ${11 * s}px "SF Mono", Consolas, monospace`;
        g.textAlign = 'center';
        g.fillText(label, x0 + 6 * s + i * cell + cell / 2, y0 + 16 * s);
      });
    }

    // Radio line.
    if (state.radio) {
      const { speaker, text, age } = state.radio;
      const alpha = clamp(1 - (age - 4) / 1.4, 0, 1);
      g.globalAlpha = alpha;
      g.fillStyle = 'rgba(10,16,18,0.62)';
      const tw = Math.min(W - 200 * s, g.measureText(text).width + 40 * s);
      roundRect(g, cx - tw / 2, H - 190 * s, tw, 34 * s, 4);
      g.fill();
      g.textAlign = 'center';
      g.fillStyle = AMBER;
      g.font = `700 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(speaker.toUpperCase(), cx, H - 177 * s);
      g.fillStyle = CREAM;
      g.font = `500 ${12 * s}px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(text, cx, H - 162 * s);
      g.globalAlpha = 1;
    }

    if (state.flash) {
      g.fillStyle = `rgba(255,56,30,${0.28 * state.flash})`;
      g.fillRect(0, 0, W, H);
    }

    if (state.stage) {
      // Stage card for briefing, pause and results, drawn over a dim wash.
      g.fillStyle = 'rgba(8,12,14,0.62)';
      g.fillRect(0, 0, W, H);
      state.stage(g, W, H, s);
    }
  }

  return { draw, resize };
}

function THREEdeg(d) {
  return (d * Math.PI) / 180;
}
