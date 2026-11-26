// Trees and shore rocks: instanced low-poly silhouettes that give the island scale without a
// single image file. Placement rejects the runway shelf and slopes too steep to hold soil.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../config.js';
import { createRandom } from '../util/math.js';
import { sampleHeight } from './terrain.js';

export function createVegetation() {
  const group = new THREE.Group();
  group.name = 'cinder-coast-vegetation';
  const random = createRandom(9182);

  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 3.2, 5);
  trunkGeo.translate(0, 1.6, 0);
  const crownGeo = new THREE.ConeGeometry(2.6, 6.2, 6);
  crownGeo.translate(0, 5.4, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3a2b', roughness: 0.95 });
  const crownMat = new THREE.MeshStandardMaterial({ color: '#4c6b40', roughness: 0.92, flatShading: true });

  const count = 520;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  crowns.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 40) {
    tries += 1;
    const x = (random() - 0.5) * 8600 - 600;
    const z = (random() - 0.5) * 7600 - 500;
    const h = sampleHeight(x, z);
    const dx = Math.abs(x - WORLD.runway.x);
    const dz = Math.abs(z - WORLD.runway.z);
    if (h < 7 || h > 690) continue;
    if (dx < 420 && dz < 780) continue;
    const hx = sampleHeight(x + 8, z) - h;
    const hz = sampleHeight(x, z + 8) - h;
    const slope = Math.hypot(hx, hz) / 8;
    if (slope > 0.34) continue;
    const s = 0.9 + random() * 1.35;
    pos.set(x, h - 0.2, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
    scale.set(s, s * (0.8 + random() * 0.55), s);
    m.compose(pos, q, scale);
    trunks.setMatrixAt(placed, m);
    crowns.setMatrixAt(placed, m);
    color.setRGB(0.22 + random() * 0.1, 0.36 + random() * 0.12, 0.2 + random() * 0.08);
    crowns.setColorAt(placed, color);
    placed += 1;
  }
  trunks.count = placed;
  crowns.count = placed;
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  // Soft contact discs under the trees: cheap grounding that survives distance.
  const discGeo = new THREE.CircleGeometry(2.3, 8);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({ color: '#1b2418', transparent: true, opacity: 0.24, depthWrite: false });
  const discs = new THREE.InstancedMesh(discGeo, discMat, count);
  for (let i = 0; i < placed; i += 1) {
    trunks.getMatrixAt(i, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    const sc = new THREE.Vector3().setFromMatrixScale(m);
    const q = new THREE.Quaternion();
    const sm = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y + 0.08, p.z), q, new THREE.Vector3(sc.x * 1.05, 1, sc.z * 1.05));
    discs.setMatrixAt(i, sm);
  }
  discs.count = placed;
  discs.instanceMatrix.needsUpdate = true;
  group.add(trunks, crowns, discs);

  // Shore rocks: dark boulders at the waterline and along the cliffs.
  const rockGeo = new THREE.DodecahedronGeometry(1.6, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#4d443c', roughness: 0.98, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 180);
  let rc = 0;
  let rt = 0;
  while (rc < 180 && rt < 5000) {
    rt += 1;
    const angle = random() * Math.PI * 2;
    const dist = 1200 + random() * 3600;
    const x = Math.cos(angle) * dist + 200;
    const z = Math.sin(angle) * dist + 200;
    const h = sampleHeight(x, z);
    if (h < -3 || h > 26) continue;
    const s = 0.5 + random() * 2.6;
    pos.set(x, h + s * 0.2, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * 6.28);
    scale.set(s, s * (0.5 + random() * 0.5), s);
    m.compose(pos, q, scale);
    rocks.setMatrixAt(rc, m);
    rc += 1;
  }
  rocks.count = rc;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.instanceMatrix.needsUpdate = true;
  group.add(rocks);
  return group;
}
