// Grass clumps near the strip: crossed alpha cards that give the airfield a foreground texture
// without a single downloaded asset. Placed by the same heightfield as everything else.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../config.js';
import { createRandom } from '../util/math.js';
import { sampleHeight } from './terrain.js';

function bladeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const random = createRandom(771);
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i += 1) {
    const x = 8 + random() * 112;
    const h = 30 + random() * 88;
    const bend = (random() - 0.5) * 22;
    g.strokeStyle = `rgba(${60 + random() * 55},${85 + random() * 65},${35 + random() * 45},${0.65 + random() * 0.35})`;
    g.lineWidth = 1 + random() * 1.8;
    g.beginPath();
    g.moveTo(x, 128);
    g.quadraticCurveTo(x + bend * 0.4, 128 - h * 0.55, x + bend, 128 - h);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createGrass() {
  const random = createRandom(3301);
  const map = bladeTexture();
  const mat = new THREE.MeshBasicMaterial({
    map, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    depthWrite: true, color: '#d7d2b4',
  });
  const geo = new THREE.PlaneGeometry(1.8, 1.0);
  geo.translate(0, 0.5, 0);
  const count = 600;
  const a = new THREE.InstancedMesh(geo, mat, count);
  const b = new THREE.InstancedMesh(geo, mat, count);
  a.name = 'grass-clumps-a';
  b.name = 'grass-clumps-b';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 30) {
    tries += 1;
    const x = (random() - 0.5) * 2200;
    const z = (random() - 0.5) * 2200 + 80;
    const h = sampleHeight(x, z);
    if (h < 4) continue;
    if (Math.abs(x - WORLD.runway.x) < 44 && Math.abs(z - WORLD.runway.z) < 520) continue;
    const hx = sampleHeight(x + 6, z) - h;
    const hz = sampleHeight(x, z + 6) - h;
    if (Math.hypot(hx, hz) / 6 > 0.28) continue;
    const s = 0.55 + random() * 1.15;
    pos.set(x, h - 0.04, z);
    q.setFromAxisAngle(up, random() * Math.PI);
    scale.set(s, s * (0.7 + random() * 0.6), s);
    m.compose(pos, q, scale);
    a.setMatrixAt(placed, m);
    q.setFromAxisAngle(up, random() * Math.PI + Math.PI / 2);
    m.compose(pos, q, scale);
    b.setMatrixAt(placed, m);
    placed += 1;
  }
  a.count = placed;
  b.count = placed;
  a.instanceMatrix.needsUpdate = true;
  b.instanceMatrix.needsUpdate = true;
  return { a, b };
}
