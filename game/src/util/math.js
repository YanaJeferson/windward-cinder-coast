// Small pure helpers shared by the coast generator, the flight model and the HUD. No state lives
// here, so the same numbers come out on every machine and in every screenshot.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rad = (deg) => (deg * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const wrapDeg = (d) => ((d % 360) + 360) % 360;
export const wrapPi = (r) => {
  let a = r;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const pad = (n, width, fill = '0') => String(Math.trunc(Math.abs(n))).padStart(width, fill);

/** Seeded 32-bit generator; every random draw in the build comes from one of these. */
export function createRandom(seed = 1) {
  let s = seed >>> 0 || 1;
  return function random() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = ix * 374761393 + iz * 668265263 + seed * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise on a unit grid, smooth-interpolated: the base of every landform. */
export function valueNoise(x, z, seed = 7) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

export function fbm(x, z, octaves = 4, seed = 7, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * freq, z * freq, seed + i * 131) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged noise: sharper crests for the volcanic spine. */
export function ridge(x, z, octaves = 4, seed = 17) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    const n = 1 - Math.abs(valueNoise(x * freq, z * freq, seed + i * 71) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.11;
  }
  return sum / norm;
}

/** Compass heading (degrees, 0 north, 90 east) to a yaw around three.js +Y. */
export const headingToYaw = (headingDeg) => -rad(headingDeg);
export const yawToHeading = (yaw) => wrapDeg(-deg(yaw));

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${pad(Math.floor(s / 60), 2)}:${pad(s % 60, 2)}`;
}
