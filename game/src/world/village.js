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

  // Three hamlets hugging the waterline on the northern and western shore, the side the sunset
  // menu looks across. The shore is solved for, so the houses sit a few metres above the lake.
  const clusters = [
    { angle: -1.98, spread: 0.15, count: 12 },
    { angle: -1.42, spread: 0.17, count: 11 },
    { angle: -0.62, spread: 0.12, count: 7 },
  ];
  const at = (angle, e) => [
    LAKE.x + Math.cos(angle) * LAKE.rx * e,
    LAKE.z + Math.sin(angle) * LAKE.rz * e,
  ];
  const shoreE = (angle) => {
    let e = 0.99;
    while (e < 1.3) {
      const [x, z] = at(angle, e);
      if (sampleHeight(x, z) >= LAKE.level + 2.2) return e;
      e += 0.004;
    }
    return 1.15;
  };
  let placed = 0;
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i += 1) {
      const angle = cluster.angle + (random() - 0.5) * cluster.spread * 2;
      const e = shoreE(angle) + 0.004 + random() * 0.018;
      const [x, z] = at(angle, e);
      const h = sampleHeight(x, z);
      if (h < LAKE.level + 1.2 || h > LAKE.level + 70) continue;
      const w = 5 + random() * 7;
      const d = 6 + random() * 8;
      const height = 3.6 + random() * 4.2;
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
      house.position.set(x, h - 0.3, z);
      house.rotation.y = angle + Math.PI / 2 + (random() - 0.5) * 0.4;
      group.add(house);
      if (i % 2 === 0) {
        const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: '#ffcf8a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
        }));
        lamp.position.set(x, h + 4.2, z);
        lamp.scale.setScalar(11);
        group.add(lamp);
      }
      placed += 1;
    }
  }

  // A timber pier and three moored boats: the small human detail that reads at dusk.
  {
    const angle = -1.7;
    const e = shoreE(angle) - 0.005;
    const [dx, dz] = at(angle, e);
    const yaw = Math.atan2(Math.cos(angle) * LAKE.rx, Math.sin(angle) * LAKE.rz);
    const plankMat = new THREE.MeshStandardMaterial({ color: '#6b5a44', roughness: 0.95 });
    const length = 34;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, length), plankMat);
    deck.position.set(dx, LAKE.level + 1.1, dz);
    deck.rotation.y = yaw;
    deck.castShadow = true;
    group.add(deck);
    for (let i = 0; i < 5; i += 1) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.2, 5), plankMat);
        post.position.set(
          dx + Math.cos(yaw) * (i * (length - 8) / 4 - 12) + Math.sin(yaw) * side * 1.5,
          LAKE.level - 0.9,
          dz - Math.sin(yaw) * (i * (length - 8) / 4 - 12) + Math.cos(yaw) * side * 1.5,
        );
        group.add(post);
      }
    }
    const boatMat = new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.8 });
    for (let i = 0; i < 3; i += 1) {
      const bx = dx + Math.cos(yaw) * (-2 + i * 4.5) + Math.sin(yaw) * (i - 1) * 2.4;
      const bz = dz - Math.sin(yaw) * (-2 + i * 4.5) + Math.cos(yaw) * (i - 1) * 2.4;
      const boat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 5.2), boatMat);
      boat.position.set(bx, LAKE.level + 0.45, bz);
      boat.rotation.y = yaw + 0.12 * (i - 1);
      group.add(boat);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4), plankMat);
      mast.position.set(bx, LAKE.level + 2.2, bz);
      group.add(mast);
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: '#ffd9a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95,
      }));
      lamp.position.set(bx, LAKE.level + 3.9, bz);
      lamp.scale.setScalar(7);
      group.add(lamp);
    }
  }
  return group;
}
