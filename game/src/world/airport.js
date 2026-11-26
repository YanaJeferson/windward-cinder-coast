// Cinder Coast strip: the runway paint, the apron, a corrugated hangar, the windsock and the
// lights that lead a tired pilot home. Everything sits on the flattened shelf the terrain makes.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../config.js';
import { sampleHeight } from './terrain.js';
import { makeApronTexture, makeAsphaltBump, makeHangarTexture, makeRunwayTexture } from '../util/textures.js';
import { radialTexture } from './sky.js';

const E = WORLD.runway.elevation;
const RWY = WORLD.runway;

function stripedSockTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = i % 2 === 0 ? '#ef6a3f' : '#f4ead2';
    g.fillRect(i * 16, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAirport() {
  const group = new THREE.Group();
  group.name = 'cinder-coast-strip';

  // Gravel shoulder under the paved strip.
  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(RWY.width + 12, 0.35, RWY.length + 34),
    new THREE.MeshStandardMaterial({ color: '#716a5c', roughness: 1 }),
  );
  shoulder.position.set(RWY.x, E + 0.02, RWY.z);
  group.add(shoulder);

  // Runway paint, mapped along the strip.
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RWY.width, RWY.length),
    new THREE.MeshStandardMaterial({ map: makeRunwayTexture(), bumpMap: makeAsphaltBump(), bumpScale: 0.045, roughness: 0.92, metalness: 0.02 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(RWY.x, E + 0.22, RWY.z);
  runway.receiveShadow = true;
  group.add(runway);

  // Apron west of the runway.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(92, 128),
    new THREE.MeshStandardMaterial({ map: makeApronTexture(), roughness: 0.96 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(-86, E + 0.18, 34);
  group.add(apron);

  // Hangar with a curved roof and a warm interior light.
  const hangar = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ map: makeHangarTexture(), roughness: 0.72, metalness: 0.35 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(28, 11, 34), wallMat);
  wall.position.y = 5.5;
  hangar.add(wall);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(14.2, 14.2, 35, 16, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#9a988f', roughness: 0.6, metalness: 0.4 }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 11;
  hangar.add(roof);
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 8.5),
    new THREE.MeshStandardMaterial({ color: '#3c403f', roughness: 0.8, metalness: 0.2, emissive: '#1a1206', emissiveIntensity: 0.4 }),
  );
  door.position.set(0, 4.4, 17.02);
  hangar.add(door);
  hangar.position.set(-112, E, 82);
  group.add(hangar);

  // Operations shed and fuel drums.
  const shed = new THREE.Mesh(
    new THREE.BoxGeometry(16, 6.4, 20),
    new THREE.MeshStandardMaterial({ color: '#c9b999', roughness: 0.85 }),
  );
  shed.position.set(-104, E + 3.2, -52);
  group.add(shed);
  const shedRoof = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.5, 22),
    new THREE.MeshStandardMaterial({ color: '#7a4a3a', roughness: 0.8 }),
  );
  shedRoof.position.set(-104, E + 6.5, -52);
  group.add(shedRoof);

  const drumMat = new THREE.MeshStandardMaterial({ color: '#b7472f', roughness: 0.6, metalness: 0.3 });
  for (let i = 0; i < 5; i += 1) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.7, 10), drumMat);
    drum.position.set(-78 + (i % 3) * 1.6, E + 0.85, -18 + Math.floor(i / 3) * 1.7);
    group.add(drum);
  }

  // Windsock: pole, striped cone, and a swivel so it reads in stills.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7.5, 6), new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: 0.5 }));
  pole.position.set(34, E + 3.75, 286);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 3.4, 10, 1, true),
    new THREE.MeshStandardMaterial({ map: stripedSockTexture(), side: THREE.DoubleSide, roughness: 0.85 }),
  );
  sock.rotation.z = -Math.PI / 2 + 0.14;
  sock.rotation.y = 0.35;
  sock.position.set(35.7, E + 7.3, 286);
  group.add(sock);

  // Runway edge lights as instanced emissive lenses.
  const lightGeo = new THREE.SphereGeometry(0.22, 6, 5);
  const lightMat = new THREE.MeshBasicMaterial({ color: '#ffcf87' });
  const count = 30;
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -430 + Math.floor(i / 2) * 62;
    m.makeTranslation(side * (RWY.width / 2 + 1.4), E + 0.65, z);
    lights.setMatrixAt(i, m);
  }
  group.add(lights);

  // PAPI: four boxes on the west side of the 36 threshold.
  const papiWhite = new THREE.MeshBasicMaterial({ color: '#fff4da' });
  const papiRed = new THREE.MeshBasicMaterial({ color: '#ff4d3a' });
  for (let i = 0; i < 4; i += 1) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.6), i < 2 ? papiWhite : papiRed);
    box.position.set(-20 - i * 2.2, E + 0.6, 392);
    group.add(box);
  }

  // Approach lights marching out over the cliff.
  const postMat = new THREE.MeshStandardMaterial({ color: '#5a554c', roughness: 0.9 });
  for (let i = 0; i < 7; i += 1) {
    const z = 510 + i * 62;
    const ground = sampleHeight(0, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.8, 5), postMat);
    post.position.set(0, ground + 0.9, z);
    group.add(post);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: '#ffe9bd' }));
    bar.position.set(0, ground + 1.85, z);
    group.add(bar);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(64, 'rgba(255,228,170,0.9)', 'rgba(255,180,90,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
    }));
    halo.scale.setScalar(2.6);
    halo.position.set(0, ground + 2.0, z);
    group.add(halo);
  }

  // A pair of tied-down crates for scale beside the apron.
  const crateMat = new THREE.MeshStandardMaterial({ color: '#7d6542', roughness: 0.9 });
  for (const [x, z, s] of [[-58, 88, 1.4], [-55, 92, 1.0]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    crate.position.set(x, E + s / 2, z);
    crate.rotation.y = x * 0.1;
    group.add(crate);
  }

  // Control tower on the west side of the apron: concrete base, glass cab, warm windows.
  const tower = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: '#b8ad95', roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(7, 12, 7), concrete);
  base.position.y = 6;
  tower.add(base);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(9, 3.2, 9),
    new THREE.MeshStandardMaterial({ color: '#2b4a50', roughness: 0.18, metalness: 0.35, emissive: '#6b4a22', emissiveIntensity: 0.35 }),
  );
  cab.position.y = 13.6;
  tower.add(cab);
  const towerRoof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.6, 10.4), new THREE.MeshStandardMaterial({ color: '#4a4740', roughness: 0.7, metalness: 0.3 }));
  towerRoof.position.y = 15.5;
  tower.add(towerRoof);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 5), new THREE.MeshStandardMaterial({ color: '#c9c2b0', roughness: 0.5 }));
  mast.position.y = 18.2;
  tower.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff6a4a' }));
  beacon.position.y = 20.7;
  tower.add(beacon);
  tower.position.set(-160, E, -118);
  tower.rotation.y = 0.18;
  group.add(tower);

  // A second windsock at the 36 threshold, where a pilot actually looks for it.
  const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6.5, 6), new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: 0.5 }));
  pole2.position.set(30, E + 3.25, 410);
  group.add(pole2);
  const sock2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 3.0, 10, 1, true),
    new THREE.MeshStandardMaterial({ map: stripedSockTexture(), side: THREE.DoubleSide, roughness: 0.85 }),
  );
  sock2.rotation.z = -Math.PI / 2 + 0.12;
  sock2.rotation.y = 0.5;
  sock2.position.set(31.5, E + 6.3, 410);
  group.add(sock2);

  return group;
}
