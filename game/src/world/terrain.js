// Cinder Coast: one analytic heightfield. The mesh, the collision test, every tree and every
// lighthouse stand on the same function, so the coast you see is the coast you hit.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, PALETTE } from '../config.js';
import { clamp, fbm, lerp, ridge, smoothstep, valueNoise } from '../util/math.js';
import { makeGroundDetailTexture } from '../util/textures.js';

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

  // Outer islands that widen the playable coast.
  h += gauss(x, z, 4300, 2700, 1250, 240);
  h += gauss(x, z, -4500, 2900, 950, 190);
  h += gauss(x, z, 3700, -4400, 1150, 300);
  h += gauss(x, z, -3600, -3900, 1050, 260);

  // The airstrip shelf: a flat headland cut into the coastal slope, open to the south.
  const shelfD = Math.sqrt((x / 1050) ** 2 + ((z + 160) / 1250) ** 2);
  const shelf = 1 - smoothstep(0.58, 1.3, shelfD);
  h = lerp(h, ELEV, shelf * 0.94);

  // The apron and threshold stay dead flat for wheels and cameras.
  const pad = Math.exp(-(((x / 330) ** 2 + (z / 640) ** 2)) * 2.6);
  h = lerp(h, ELEV, smoothstep(0.1, 0.75, pad));

  // Small undulations in the open field, kept away from the paved surfaces.
  const flat = 1 - smoothstep(260, 680, Math.max(Math.abs(x), Math.abs(z) * 0.72));
  const micro = (fbm(x * 0.008, z * 0.008, 3, 777) - 0.5) * 4.2;
  h += micro * (1 - flat);

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

const SUN_DIR = (() => {
  const az = (WORLD.sun.azimuth * Math.PI) / 180;
  const el = (WORLD.sun.elevation * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
})();

/** A coarse terrain ray toward the sun: big shapes cast shadows on the valleys without a shadow map. */
function sunBlocked(x, z, h) {
  if (h < 4) return false;
  for (let d = 90; d < 1300; d += 150) {
    const sx = x + SUN_DIR.x * d;
    const sz = z + SUN_DIR.z * d;
    const sy = h + SUN_DIR.y * d;
    if (sampleHeight(sx, sz) > sy + 3) return true;
  }
  return false;
}

function vertexColor(h, slope, x, z, out, ao = 1) {
  const grain = valueNoise(x * 0.02, z * 0.02, 91);
  const patch = fbm(x * 0.0016, z * 0.0016, 3, 71);
  const macro = fbm(x * 0.0055, z * 0.0055, 3, 191);
  let c;
  if (h < 2.5) c = new THREE.Color('#e6d6b2').multiplyScalar(0.92 + grain * 0.1);
  else if (slope > 0.42) c = new THREE.Color('#8a8178').lerp(new THREE.Color('#c3b4a2'), 0.2 + grain * 0.5);
  else if (h > 620) c = new THREE.Color('#bdb2a2').lerp(new THREE.Color('#ddd5c6'), (h - 620) / 260 + grain * 0.2);
  else {
    c = new THREE.Color('#cfdcb4').lerp(new THREE.Color('#e3d7b8'), patch * 1.05);
    if (slope > 0.22) c.lerp(new THREE.Color('#c9bba7'), smoothstep(0.22, 0.46, slope));
  }
  const lit = sunBlocked(x, z, h) ? 0.56 : 1;
  const shade = (0.8 + grain * 0.18 + macro * 0.16) * ao * lit;
  out.setRGB(clamp(c.r * shade, 0, 1), clamp(c.g * shade, 0, 1), clamp(c.b * shade, 0, 1));
  return out;
}

/** A coarse terrain-height map for the water shader: shore depth and foam. */
export function createHeightTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const minH = -80;
  const maxH = 920;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wx = (x / (size - 1) - 0.5) * WORLD.size;
      const wz = (y / (size - 1) - 0.5) * WORLD.size;
      const h = Math.max(minH, Math.min(maxH, sampleHeight(wx, wz)));
      const v = Math.round(((h - minH) / (maxH - minH)) * 255);
      const i = (y * size + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createTerrain() {
  const size = WORLD.size;
  const seg = 188;
  const step = size / seg;
  const half = size / 2;
  const verts = (seg + 1) * (seg + 1);
  const positions = new Float32Array(verts * 3);
  const colors = new Float32Array(verts * 3);
  const uvs = new Float32Array(verts * 2);
  const c = new THREE.Color();
  const e = 8;

  let v = 0;
  for (let iz = 0; iz <= seg; iz += 1) {
    const z = -half + iz * step;
    for (let ix = 0; ix <= seg; ix += 1) {
      const x = -half + ix * step;
      const h = sampleHeight(x, z);
      const hL = sampleHeight(x - e, z);
      const hR = sampleHeight(x + e, z);
      const hD = sampleHeight(x, z - e);
      const hU = sampleHeight(x, z + e);
      const nx = hL - hR;
      const nz = hD - hU;
      const ny = 2 * e;
      const len = Math.hypot(nx, ny, nz);
      const slope = 1 - ny / len;
      const avg = (hL + hR + hD + hU) / 4;
      const ao = clamp(1 + (h - avg) * 0.008, 0.72, 1.08);
      vertexColor(h, slope, x, z, c, ao);
      positions[v * 3] = x;
      positions[v * 3 + 1] = h;
      positions[v * 3 + 2] = z;
      colors[v * 3] = c.r;
      colors[v * 3 + 1] = c.g;
      colors[v * 3 + 2] = c.b;
      uvs[v * 2] = x / 16;
      uvs[v * 2 + 1] = z / 16;
      v += 1;
    }
  }

  const indices = [];
  for (let iz = 0; iz < seg; iz += 1) {
    for (let ix = 0; ix < seg; ix += 1) {
      const a = iz * (seg + 1) + ix;
      const b = a + 1;
      const d = a + seg + 1;
      const e2 = d + 1;
      indices.push(a, d, b, b, d, e2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const loader = new THREE.TextureLoader();
  const load = (name, srgb) => {
    const tex = loader.load(new URL(`../../assets/${name}`, import.meta.url).href);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 16;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const grass = load('grass001_color.jpg', true);
  const rock = load('rock030_color.jpg', true);
  const detail = makeGroundDetailTexture();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detail,
    bumpMap: detail,
    bumpScale: 0.45,
    flatShading: false,
    roughness: 0.97,
    metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGrass = { value: grass };
    shader.uniforms.uRock = { value: rock };
    shader.uniforms.uMacro = { value: detail };
    shader.vertexShader = 'varying float vSlope;\nvarying float vHeight;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSlope = 1.0 - abs(normal.y);\nvHeight = position.y;',
    );
    shader.fragmentShader = 'uniform sampler2D uGrass;\nuniform sampler2D uRock;\nuniform sampler2D uMacro;\nvarying float vSlope;\nvarying float vHeight;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
        vec3 gcol = texture2D(uGrass, vMapUv * 0.62).rgb;
        vec3 rcol = texture2D(uRock, vMapUv * 1.25).rgb;
        float macro = texture2D(uMacro, vMapUv * 0.055).r;
        float rockMix = max(smoothstep(0.22, 0.48, vSlope), smoothstep(170.0, 520.0, vHeight) * 0.85);
        vec3 terrainColor = mix(gcol, rcol, rockMix);
        vec3 macroTint = mix(vec3(0.72, 0.7, 0.56), vec3(1.28, 1.18, 0.96), smoothstep(0.32, 0.78, macro));
        terrainColor *= macroTint;
        vec4 sampledDiffuseColor = vec4(terrainColor, 1.0);
        diffuseColor.rgb *= sampledDiffuseColor.rgb * 1.18 * vec3(1.08, 1.04, 0.94);
      `,
    );
  };
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
