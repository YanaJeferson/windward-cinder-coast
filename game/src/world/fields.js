// Farmland around the strip: two crop fields with hedges and fences, a dirt track to the hangar
// and a few round bales. Flat shelf only, so the fields sit on the ground without clipping.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../config.js';
import { createRandom } from '../util/math.js';
import { sampleHeight } from './terrain.js';

const E = WORLD.runway.elevation;

function cropTexture(gold) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const random = createRandom(gold ? 331 : 227);
  g.fillStyle = gold ? '#6b5636' : '#443d29';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 28; i += 1) {
    const x = (i / 28) * 512;
    g.fillStyle = gold
      ? `rgba(${155 + random() * 35},${130 + random() * 30},${60 + random() * 20},${0.55 + random() * 0.25})`
      : `rgba(${90 + random() * 30},${120 + random() * 35},${55 + random() * 25},${0.55 + random() * 0.25})`;
    g.fillRect(x, 0, 8 + random() * 5, 512);
    g.fillStyle = 'rgba(45,38,25,0.35)';
    g.fillRect(x - 2, 0, 2, 512);
  }
  for (let i = 0; i < 9000; i += 1) {
    const v = random();
    g.fillStyle = `rgba(${60 + v * 80},${55 + v * 70},${35 + v * 50},${0.03 + random() * 0.07})`;
    g.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function dirtTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const random = createRandom(81);
  g.fillStyle = '#78654a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 12000; i += 1) {
    const v = random();
    g.fillStyle = `rgba(${90 + v * 60},${75 + v * 50},${50 + v * 40},${0.06 + random() * 0.12})`;
    g.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 3);
  }
  for (let i = 0; i < 12; i += 1) {
    g.fillStyle = 'rgba(70,58,40,0.18)';
    g.fillRect(0, random() * 256, 256, 2 + random() * 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function fieldPatch(x, z, w, d, gold, random) {
  const h = Math.max(
    sampleHeight(x, z),
    sampleHeight(x - w / 2, z - d / 2),
    sampleHeight(x + w / 2, z - d / 2),
    sampleHeight(x - w / 2, z + d / 2),
    sampleHeight(x + w / 2, z + d / 2),
  );
  const tex = cropTexture(gold);
  tex.repeat.set(Math.max(1, w / 60), Math.max(1, d / 60));
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.98, metalness: 0 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, h + 0.09, z);
  mesh.receiveShadow = true;
  return mesh;
}

export function createFields() {
  const group = new THREE.Group();
  group.name = 'cinder-coast-fields';
  const random = createRandom(6612);

  // Three crop patches on the flat shelf, clear of the runway and taxiway.
  group.add(fieldPatch(-270, -220, 220, 250, false, random));
  group.add(fieldPatch(250, -170, 160, 230, true, random));
  group.add(fieldPatch(-300, 300, 180, 150, true, random));
  group.add(fieldPatch(150, 20, 130, 290, false, random));
  group.add(fieldPatch(150, 390, 120, 150, true, random));

  // Dirt track from the apron to the runway shoulder.
  const dirt = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 155),
    new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1, metalness: 0 }),
  );
  dirt.rotation.x = -Math.PI / 2;
  dirt.rotation.z = Math.PI / 2;
  const dh = sampleHeight(-72, 0);
  dirt.position.set(-72, dh + 0.12, 0);
  dirt.receiveShadow = true;
  group.add(dirt);

  // Hedge rows around the patches and along the track.
  const hedgeGeo = new THREE.IcosahedronGeometry(1.9, 0);
  const hedgeMat = new THREE.MeshStandardMaterial({ color: '#3d5b33', roughness: 0.96, flatShading: true });
  const hedges = new THREE.InstancedMesh(hedgeGeo, hedgeMat, 260);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let hc = 0;
  const hedgeLine = (x0, z0, x1, z1, step) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / step);
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const h = sampleHeight(x, z);
      const s = 0.65 + random() * 0.8;
      pos.set(x, h + s * 0.55, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * 6.28);
      scale.set(s * 1.25, s * 0.9, s * 1.25);
      m.compose(pos, q, scale);
      hedges.setMatrixAt(hc, m);
      hc += 1;
    }
  };
  hedgeLine(-380, -345, -160, -345, 11);
  hedgeLine(-380, -95, -160, -95, 11);
  hedgeLine(-380, -345, -380, -95, 11);
  hedgeLine(160, -285, 340, -285, 11);
  hedgeLine(160, -55, 340, -55, 11);
  hedgeLine(340, -285, 340, -55, 11);
  hedgeLine(-390, 225, -210, 225, 11);
  hedgeLine(85, -125, 215, -125, 10);
  hedgeLine(85, 165, 215, 165, 10);
  hedgeLine(85, -125, 85, 165, 10);
  hedgeLine(-390, 375, -210, 375, 11);
  hedges.count = Math.min(hc, 260);
  hedges.castShadow = true;
  hedges.receiveShadow = true;
  hedges.instanceMatrix.needsUpdate = true;
  group.add(hedges);

  // Fence posts along the west field and the runway edge.
  const postGeo = new THREE.CylinderGeometry(0.09, 0.12, 1.6, 5);
  postGeo.translate(0, 0.8, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: '#6e5b41', roughness: 0.95 });
  const posts = new THREE.InstancedMesh(postGeo, postMat, 120);
  let pc = 0;
  const postLine = (x0, z0, x1, z1, step) => {
    const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / step);
    for (let i = 0; i <= n && pc < 120; i += 1) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const h = sampleHeight(x, z);
      pos.set(x, h, z);
      scale.set(1, 1, 1);
      m.compose(pos, new THREE.Quaternion(), scale);
      posts.setMatrixAt(pc, m);
      pc += 1;
    }
  };
  postLine(-380, -360, -160, -360, 12);
  postLine(-380, -110, -380, -360, 12);
  posts.count = pc;
  posts.castShadow = true;
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  // Round bales in the stubble field.
  const baleGeo = new THREE.CylinderGeometry(1.15, 1.15, 1.6, 10);
  baleGeo.rotateZ(Math.PI / 2);
  const baleMat = new THREE.MeshStandardMaterial({ color: '#b39a58', roughness: 0.98 });
  for (let i = 0; i < 10; i += 1) {
    const x = -490 + random() * 120;
    const z = 300 + random() * 110;
    const h = sampleHeight(x, z);
    const bale = new THREE.Mesh(baleGeo, baleMat);
    bale.position.set(x, h + 1.15, z);
    bale.rotation.y = random() * 3;
    bale.castShadow = true;
    bale.receiveShadow = true;
    group.add(bale);
  }

  return group;
}
