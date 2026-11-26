// Canvas-painted surfaces: the runway's paint, the instrument faces and the small stencils that
// make the aerodrome read as a place rather than a grey rectangle. Generated at boot, no assets.
import * as THREE from '../../vendor/three.module.min.js';
import { createRandom } from '../util/math.js';

function canvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return { c, g: c.getContext('2d') };
}

function toTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeRunwayTexture() {
  const W = 256;
  const H = 2048;
  const { c, g } = canvas(W, H);
  const random = createRandom(8128);

  g.fillStyle = '#2b2c30';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i += 1) {
    const v = random();
    g.fillStyle = `rgba(${120 + v * 40},${120 + v * 40},${124 + v * 40},${0.03 + random() * 0.05})`;
    g.fillRect(random() * W, random() * H, 1 + random() * 2, 1 + random() * 4);
  }
  // Tar seams.
  g.strokeStyle = 'rgba(16,16,18,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = (i / 9) * H;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y + (random() - 0.5) * 8);
    g.stroke();
  }

  const paint = '#e8e2d2';
  // Edge lines.
  g.fillStyle = paint;
  g.fillRect(10, 24, 5, H - 48);
  g.fillRect(W - 15, 24, 5, H - 48);

  // Centreline dashes.
  for (let y = 150; y < H - 150; y += 74) g.fillRect(W / 2 - 3, y, 6, 40);

  // Threshold piano keys at both ends.
  const keys = (top) => {
    for (let i = 0; i < 8; i += 1) {
      const x = 30 + i * 25;
      g.fillRect(x, top ? 34 : H - 54, 16, 20);
    }
  };
  keys(true);
  keys(false);

  // Touchdown-zone bars.
  for (const side of [0, 1]) {
    for (let row = 0; row < 3; row += 1) {
      const y = side === 0 ? 235 + row * 48 : H - 235 - row * 48 - 12;
      g.fillRect(48, y, 46, 12);
      g.fillRect(W - 94, y, 46, 12);
    }
  }

  // Aiming-point blocks.
  for (const side of [0, 1]) {
    const y = side === 0 ? 430 : H - 430 - 62;
    g.fillRect(58, y, 44, 62);
    g.fillRect(W - 102, y, 44, 62);
  }

  // Runway designators, shut so they read from the approach.
  g.save();
  g.translate(W / 2, 122);
  g.rotate(Math.PI);
  g.fillStyle = paint;
  g.font = '700 62px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('18', 0, 0);
  g.restore();

  g.save();
  g.translate(W / 2, H - 118);
  g.fillStyle = paint;
  g.font = '700 62px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('36', 0, 0);
  g.restore();

  return toTexture(c);
}

export function makeApronTexture() {
  const { c, g } = canvas(512, 512);
  const random = createRandom(311);
  g.fillStyle = '#5b5a56';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i += 1) {
    const v = random();
    g.fillStyle = `rgba(${40 + v * 60},${40 + v * 60},${40 + v * 60},${0.04 + random() * 0.06})`;
    g.fillRect(random() * 512, random() * 512, 2, 2);
  }
  g.strokeStyle = 'rgba(232,226,210,0.72)';
  g.lineWidth = 4;
  g.strokeRect(24, 24, 464, 464);
  g.setLineDash([26, 20]);
  g.beginPath();
  g.moveTo(256, 24);
  g.lineTo(256, 488);
  g.stroke();
  return toTexture(c);
}

export function makeHangarTexture() {
  const { c, g } = canvas(256, 128);
  g.fillStyle = '#8b8a83';
  g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 8) {
    g.fillStyle = x % 16 === 0 ? '#9b9a92' : '#7c7b74';
    g.fillRect(x, 0, 4, 128);
  }
  g.fillStyle = 'rgba(50,48,44,0.35)';
  g.fillRect(0, 0, 256, 10);
  return toTexture(c);
}

const GAUGES = {
  asi: { label: 'AIRSPEED', unit: 'KTS', min: 0, max: 160, major: 20, minor: 10, start: 150, sweep: 240 },
  alt: { label: 'ALTITUDE', unit: 'FT', min: 0, max: 4000, major: 500, minor: 250, start: 150, sweep: 240 },
  vsi: { label: 'VERT SPEED', unit: 'FPM', min: -1000, max: 1000, major: 500, minor: 250, start: 150, sweep: 240 },
  rpm: { label: 'ENGINE', unit: 'RPM', min: 0, max: 3000, major: 500, minor: 250, start: 150, sweep: 240 },
  fuel: { label: 'FUEL', unit: 'L', min: 0, max: 100, major: 25, minor: 12.5, start: 150, sweep: 240 },
  hdg: { label: 'HEADING', unit: '°', min: 0, max: 360, major: 30, minor: 10, start: 0, sweep: 360 },
};

/** A static instrument face plus the needle angle range the cockpit uses. */
export function makeGaugeFace(kind) {
  const spec = GAUGES[kind];
  const S = 256;
  const { c, g } = canvas(S, S);
  g.clearRect(0, 0, S, S);

  const cx = S / 2;
  const cy = S / 2;
  const R = 108;
  const face = g.createRadialGradient(cx, cy, 8, cx, cy, R);
  face.addColorStop(0, '#1d2327');
  face.addColorStop(0.72, '#121619');
  face.addColorStop(1, '#0a0d0f');
  g.fillStyle = face;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = '#e8d9b8';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, R - 3, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(232,217,184,0.22)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, R - 14, 0, Math.PI * 2);
  g.stroke();

  const startRad = THREE.MathUtils.degToRad(90 + spec.start);
  const total = THREE.MathUtils.degToRad(spec.sweep);
  const count = Math.round((spec.max - spec.min) / spec.minor);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const a = startRad + total * t;
    const major = Math.abs((spec.min + t * (spec.max - spec.min)) % spec.major) < 1e-6;
    const r0 = R - (major ? 26 : 17);
    const r1 = R - 8;
    g.strokeStyle = major ? '#f0e3c4' : 'rgba(240,227,196,0.72)';
    g.lineWidth = major ? 4 : 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.stroke();
    if (major) {
      const value = Math.round(spec.min + t * (spec.max - spec.min));
      const label = kind === 'hdg' ? (value === 0 ? 'N' : value === 90 ? 'E' : value === 180 ? 'S' : value === 270 ? 'W' : String(value)) : String(value);
      g.fillStyle = '#f0e3c4';
      g.font = `${kind === 'hdg' ? 700 : 600} ${kind === 'hdg' ? 19 : 16}px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(label, cx + Math.cos(a) * 72, cy + Math.sin(a) * 72);
    }
  }

  if (kind === 'asi') {
    g.strokeStyle = '#6fd7c7';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy, R - 20, THREE.MathUtils.degToRad(240), THREE.MathUtils.degToRad(310));
    g.stroke();
    g.strokeStyle = '#ff6f52';
    g.beginPath();
    g.arc(cx, cy, R - 20, THREE.MathUtils.degToRad(310), THREE.MathUtils.degToRad(334));
    g.stroke();
  }
  if (kind === 'fuel') {
    g.strokeStyle = '#ff6f52';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(cx, cy, R - 20, THREE.MathUtils.degToRad(168), THREE.MathUtils.degToRad(210));
    g.stroke();
  }

  g.fillStyle = 'rgba(240,227,196,0.78)';
  g.font = '600 13px "Helvetica Neue", Arial, sans-serif';
  g.fillText(spec.label, cx, cy + 54);
  g.fillStyle = 'rgba(240,227,196,0.5)';
  g.font = '500 12px "Helvetica Neue", Arial, sans-serif';
  g.fillText(spec.unit, cx, cy + 72);

  return { texture: toTexture(c), spec, cx, cy };
}

export function gaugeAngle(kind, value) {
  const spec = GAUGES[kind];
  const t = THREE.MathUtils.clamp((value - spec.min) / (spec.max - spec.min), 0, 1);
  const start = 90 + spec.start;
  return THREE.MathUtils.degToRad(start + spec.sweep * t);
}
