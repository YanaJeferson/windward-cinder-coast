// Cinder Coast: one analytic heightfield. The mesh, the collision test, every tree and every
// lighthouse stand on the same function, so the coast you see is the coast you hit.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, PALETTE } from '../config.js';
import { clamp, fbm, lerp, ridge, smoothstep, valueNoise } from '../util/math.js';

const ELEV = WORLD.runway.elevation;

function gauss(x, z, cx, cz, radius, height) {
  const dx = (x - cx) / radius;
  const dz = (z - cz) / radius;
  return height * Math.exp(-(dx * dx + dz * dz) * 2.1);
}

/** The island's outline: 1 inland, 0 open sea, with a ragged, eroded edge. */
function landMask(x, z) {
  const wobble = (fbm(x * 0.00042, z * 0.00042, 4, 31) - 0.5) * 0.34;
  const dx = Math.abs((x + 1100) / 2300);
  const dz = Math.abs((z + 1400) / 2400);
  const d = Math.max(dx, dz * 0.95) + wobble;
  return 1 - smoothstep(0.62, 0.98, d);
}

function coastline(x, z) {
  return smoothstep(0.02, 0.42, landMask(x, z));
}

export function sampleHeight(x, z) {
  if (Math.abs(x) > WORLD.size * 0.52 || Math.abs(z) > WORLD.size * 0.52) return -30;

  const land = landMask(x, z);
  const hills = fbm(x * 0.00055, z * 0.00055, 5, 11);
  const detail = fbm(x * 0.0021, z * 0.0021, 3, 53);
  let h = coastline(x, z) * (96 + hills * 210 + detail * 38);

  // The volcanic spine in the north-west, and the old cone above the bay.
  const spine = ridge(x * 0.00075, z * 0.00075, 4, 23);
  h += spine * 520 * smoothstep(260, 1500, -z) * land;
  h += gauss(x, z, -1750, -2450, 1280, 520);
  h += gauss(x, z, -3150, -900, 1150, 380);
  h += gauss(x, z, 700, -2900, 980, 300);
  h += gauss(x, z, -2550, 720, 1500, 690);

  // The volcano's crater: a shallow bowl inside the cone.
  const crater = Math.exp(-(((x + 2550) / 330) ** 2 + ((z - 720) / 300) ** 2) * 2.2);
  h -= crater * 175;
  h += Math.exp(-(((x + 2550) / 120) ** 2 + ((z - 720) / 110) ** 2) * 2.4) * 36;

  // The Cinder canyon: a river-cut trench west of the strip.
  const canyonX = -1520 + Math.sin(z / 690) * 330 + Math.sin(z / 233) * 65;
  const canyon = Math.exp(-(((x - canyonX) / 300) ** 2) * 2.2) * smoothstep(-3300, -2200, z) * smoothstep(2500, 1500, z);
  h -= canyon * 215;

  // Small offshore stacks and the low island on the horizon.
  h += gauss(x, z, 2550, 900, 230, 96);
  h += gauss(x, z, 3250, -420, 190, 74);
  h += gauss(x, z, 1750, 2050, 150, 58);
  h += gauss(x, z, 4300, 1700, 780, 132);
  h += gauss(x, z, 3900, 2350, 420, 66);

  // The airstrip shelf: a flat headland cut into the coastal slope, open to the south.
  const shelfD = Math.sqrt((x / 1050) ** 2 + ((z + 160) / 1250) ** 2);
  const shelf = 1 - smoothstep(0.58, 1.3, shelfD);
  h = lerp(h, ELEV, shelf * 0.94);

  // The apron and threshold stay dead flat for wheels and cameras.
  const pad = Math.exp(-(((x / 330) ** 2 + (z / 640) ** 2)) * 2.6);
  h = lerp(h, ELEV, smoothstep(0.1, 0.75, pad));

  // Offshore ground falls away under the water plane, so the coast has a real waterline.
  h -= (1 - coastline(x, z)) * 70;

  return h;
}

export function terrainNormal(x, z) {
  const e = 6;
  const hL = sampleHeight(x - e, z);
  const hR = sampleHeight(x + e, z);
  const hD = sampleHeight(x, z - e);
  const hU = sampleHeight(x, z + e);
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
}

function faceColor(h, slope, x, z, out) {
  const grain = valueNoise(x * 0.011, z * 0.011, 91);
  const patch = fbm(x * 0.0016, z * 0.0016, 2, 71);
  let c;
  if (h < 2.5) c = new THREE.Color(PALETTE.sand).multiplyScalar(0.82 + grain * 0.16);
  else if (slope > 0.44) c = new THREE.Color(PALETTE.basalt).lerp(new THREE.Color(PALETTE.rock), 0.25 + grain * 0.55);
  else if (h > 620) c = new THREE.Color(PALETTE.rock).lerp(new THREE.Color('#b7a78e'), (h - 620) / 260 + grain * 0.2);
  else {
    c = new THREE.Color(PALETTE.grass).lerp(new THREE.Color(PALETTE.grassDry), patch * 0.85);
    if (slope > 0.28) c.lerp(new THREE.Color(PALETTE.rock), smoothstep(0.28, 0.52, slope));
  }
  const shade = 0.9 + grain * 0.18;
  out.setRGB(clamp(c.r * shade, 0, 1), clamp(c.g * shade, 0, 1), clamp(c.b * shade, 0, 1));
  return out;
}

export function createTerrain() {
  const size = WORLD.size;
  const seg = 236;
  const step = size / seg;
  const half = size / 2;
  const positions = [];
  const colors = [];
  const c = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  const pushTriangle = (x1, z1, x2, z2, x3, z3) => {
    const h1 = sampleHeight(x1, z1);
    const h2 = sampleHeight(x2, z2);
    const h3 = sampleHeight(x3, z3);
    if (h1 < -8 && h2 < -8 && h3 < -8) return;
    a.set(x1, h1, z1); b.set(x2, h2, z2); d.set(x3, h3, z3);
    e1.subVectors(b, a); e2.subVectors(d, a);
    nrm.crossVectors(e1, e2).normalize();
    const slope = 1 - Math.abs(nrm.y);
    const cx = (x1 + x2 + x3) / 3;
    const cz = (z1 + z2 + z3) / 3;
    const ch = (h1 + h2 + h3) / 3;
    faceColor(ch, slope, cx, cz, c);
    positions.push(x1, h1, z1, x2, h2, z2, x3, h3, z3);
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
  };

  for (let iz = 0; iz < seg; iz += 1) {
    for (let ix = 0; ix < seg; ix += 1) {
      const x0 = -half + ix * step;
      const z0 = -half + iz * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      pushTriangle(x0, z0, x0, z1, x1, z0);
      pushTriangle(x1, z0, x0, z1, x1, z1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'cinder-coast-terrain';
  return mesh;
}

/** A lathe-free ridge silhouette for the horizon behind the island. */
export function createDistantRange() {
  const group = new THREE.Group();
  group.name = 'distant-range';
  const mat = new THREE.MeshBasicMaterial({ color: '#8d7a70', fog: true });
  const shapes = [
    [-8200, -2600, 2100, 720], [-6100, -5200, 2600, 940], [-1600, -6600, 3000, 820],
    [4200, -6200, 2500, 640], [7600, -3000, 2400, 590],
  ];
  for (const [x, z, w, h] of shapes) {
    const g = new THREE.ConeGeometry(w, h, 5, 1);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, h * 0.34 - 20, z);
    m.rotation.y = (x + z) * 0.0013;
    group.add(m);
  }
  return group;
}
