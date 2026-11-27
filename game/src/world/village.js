// A small lakeside village for the caldera: warm windows, roofs and a few street lamps. Low-poly
// boxes at distance read as a town; the lights are the important part at dusk.
import * as THREE from '../../vendor/three.module.min.js';
import { createRandom } from '../util/math.js';
import { sampleHeight, LAKE, inLake } from './terrain.js';

export function createVillage() {
  const group = new THREE.Group();
  group.name = 'caldera-village';
  const random = createRandom(4477);
  const wallMats = ['#d8cbb2', '#c8b698', '#b9a487', '#d0c0a4'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: '#7a3f32', roughness: 0.9, flatShading: true });
  const windowMat = new THREE.MeshBasicMaterial({ color: '#ffca7a' });
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,220,150,0.9)');
    grd.addColorStop(0.3, 'rgba(255,170,90,0.35)');
    grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  let placed = 0;
  let tries = 0;
  while (placed < 34 && tries < 500) {
    tries += 1;
    const angle = random() * Math.PI * 2;
    const radius = 1180 + random() * 520;
    const x = LAKE.x + Math.cos(angle) * radius;
    const z = LAKE.z + Math.sin(angle) * radius * 0.86;
    const h = sampleHeight(x, z);
    if (h < LAKE.level + 2 || h > LAKE.level + 170 || inLake(x, z)) continue;
    const w = 5 + random() * 8;
    const d = 6 + random() * 9;
    const height = 4 + random() * 5;
    const house = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), wallMats[Math.floor(random() * wallMats.length)]);
    wall.position.y = height / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    house.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.8, 4), roofMat);
    roof.position.y = height + 1.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    for (let side = 0; side < 2; side += 1) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), windowMat);
      win.position.set((side ? 1 : -1) * (w / 2 + 0.02), height * 0.55, 0);
      win.rotation.y = side ? Math.PI / 2 : -Math.PI / 2;
      house.add(win);
    }
    house.position.set(x, h, z);
    house.rotation.y = random() * Math.PI * 2;
    group.add(house);
    if (placed % 3 === 0) {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: '#ffcf8a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
      }));
      lamp.position.set(x + 4, h + 5, z + 2);
      lamp.scale.setScalar(10);
      group.add(lamp);
    }
    placed += 1;
  }
  return group;
}
