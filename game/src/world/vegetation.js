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

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3.4, 6);
  trunkGeo.translate(0, 1.7, 0);
  const coniferGeo = new THREE.ConeGeometry(2.2, 5.4, 7);
  const broadGeo = new THREE.IcosahedronGeometry(2.5, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3929', roughness: 0.95 });
  const coniferMat = new THREE.MeshStandardMaterial({ color: '#3d5a3a', roughness: 0.9, flatShading: true });
  const broadMat = new THREE.MeshStandardMaterial({ color: '#526b3d', roughness: 0.9, flatShading: true });

  const count = 640;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const conifers = new THREE.InstancedMesh(coniferGeo, coniferMat, count * 2);
  const broads = new THREE.InstancedMesh(broadGeo, broadMat, count * 3);
  conifers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 2 * 3), 3);
  broads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3 * 3), 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  let placed = 0;
  let coniferCount = 0;
  let broadCount = 0;
  let tries = 0;
  while (placed < count && tries < count * 50) {
    tries += 1;
    const x = (random() - 0.5) * 8600 - 600;
    const z = (random() - 0.5) * 7600 - 500;
    const h = sampleHeight(x, z);
    const dx = Math.abs(x - WORLD.runway.x);
    const dz = Math.abs(z - WORLD.runway.z);
    if (h < 7 || h > 700) continue;
    if (dx < 360 && dz < 680) continue;
    const hx = sampleHeight(x + 8, z) - h;
    const hz = sampleHeight(x, z + 8) - h;
    const slope = Math.hypot(hx, hz) / 8;
    if (slope > 0.36) continue;
    const s = 0.8 + random() * 1.5;
    pos.set(x, h - 0.15, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2);
    scale.set(s, s * (0.75 + random() * 0.5), s);
    m.compose(pos, q, scale);
    trunks.setMatrixAt(placed, m);

    if (random() < 0.58) {
      // Conifer: two stacked, narrowing crowns.
      for (let layer = 0; layer < 2; layer += 1) {
        const ls = s * (1 - layer * 0.28);
        pos.set(x, h + (3.4 + layer * 2.7) * s, z);
        scale.set(ls, ls * (1 - layer * 0.12), ls);
        m.compose(pos, q, scale);
        conifers.setMatrixAt(coniferCount, m);
        const v = 0.09 + random() * 0.04;
        color.setRGB(v, v + 0.1 + random() * 0.04, v + 0.03);
        conifers.setColorAt(coniferCount, color);
        coniferCount += 1;
      }
    } else {
      // Broadleaf: one large crown and two offset lobes.
      const lobes = [[0, 5.4, 0, 1], [-1.4, 4.6, 0.7, 0.68], [1.2, 4.4, -0.6, 0.58]];
      for (const [ox, oy, oz, ls] of lobes) {
        pos.set(x + ox * s, h + oy * s, z + oz * s);
        scale.set(s * ls, s * ls * (0.85 + random() * 0.25), s * ls);
        m.compose(pos, q, scale);
        broads.setMatrixAt(broadCount, m);
        const v = 0.12 + random() * 0.05;
        color.setRGB(v + 0.03, v + 0.1 + random() * 0.05, v * 0.75);
        broads.setColorAt(broadCount, color);
        broadCount += 1;
      }
    }
    placed += 1;
  }
  trunks.count = placed;
  conifers.count = coniferCount;
  broads.count = broadCount;
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  conifers.castShadow = true;
  broads.castShadow = true;
  conifers.receiveShadow = true;
  broads.receiveShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  conifers.instanceMatrix.needsUpdate = true;
  broads.instanceMatrix.needsUpdate = true;
  if (conifers.instanceColor) conifers.instanceColor.needsUpdate = true;
  if (broads.instanceColor) broads.instanceColor.needsUpdate = true;

  // Soft contact discs under the trees.
  const discGeo = new THREE.CircleGeometry(2.3, 8);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({ color: '#1b2418', transparent: true, opacity: 0.24, depthWrite: false });
  const discs = new THREE.InstancedMesh(discGeo, discMat, count);
  for (let i = 0; i < placed; i += 1) {
    trunks.getMatrixAt(i, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    const sc = new THREE.Vector3().setFromMatrixScale(m);
    const sm = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y + 0.08, p.z), new THREE.Quaternion(), new THREE.Vector3(sc.x * 1.2, 1, sc.z * 1.2));
    discs.setMatrixAt(i, sm);
  }
  discs.count = placed;
  discs.instanceMatrix.needsUpdate = true;
  group.add(trunks, conifers, broads, discs);

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
