// The Petrel: a high-wing bush plane built from a lofted fuselage, a strut-braced wing and
// over-sized tundra tyres. All geometry is generated here; the livery is a painted canvas.
import * as THREE from '../../vendor/three.module.min.js';

const CREAM = new THREE.MeshStandardMaterial({ color: '#f2e4c6', roughness: 0.58, metalness: 0.06, envMapIntensity: 0.5 });
const CORAL = new THREE.MeshStandardMaterial({ color: '#e8613f', roughness: 0.55, metalness: 0.03 });
const TEAL = new THREE.MeshStandardMaterial({ color: '#2f6d72', roughness: 0.5, metalness: 0.12 });
const DARK = new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.72, metalness: 0.18 });
const METAL = new THREE.MeshStandardMaterial({ color: '#9aa0a4', roughness: 0.3, metalness: 0.75, envMapIntensity: 1.1 });
const GLASS = new THREE.MeshPhysicalMaterial({
  color: '#1c3d47', roughness: 0.04, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04,
  transparent: true, opacity: 0.86, side: THREE.DoubleSide, envMapIntensity: 1.4,
});

function liveryTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f0e2c4';
  g.fillRect(0, 0, 512, 256);
  // Panel seams and rivets.
  g.strokeStyle = 'rgba(88,76,58,0.42)';
  g.lineWidth = 1.6;
  for (let x = 24; x < 512; x += 48) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  for (let y = 36; y < 256; y += 46) {
    g.strokeStyle = 'rgba(88,76,58,0.22)';
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  g.fillStyle = 'rgba(90,78,60,0.5)';
  for (let x = 24; x < 512; x += 48) {
    for (let y = 10; y < 256; y += 13) g.fillRect(x - 1, y, 1.4, 1.4);
  }
  // Grime along the belly and behind the exhaust.
  for (let i = 0; i < 40; i += 1) {
    const x = 20 + Math.random() * 472;
    const y = 180 + Math.random() * 70;
    g.fillStyle = `rgba(70,58,44,${0.03 + Math.random() * 0.05})`;
    g.fillRect(x, y, 2 + Math.random() * 10, 8 + Math.random() * 40);
  }
  g.fillStyle = 'rgba(50,42,32,0.18)';
  g.fillRect(0, 205, 512, 30);
  // Coral cheatline down both flanks (u wraps the fuselage, so two bands).
  g.fillStyle = '#df5a39';
  g.fillRect(0, 118, 512, 26);
  g.fillStyle = '#2f6d72';
  g.fillRect(0, 148, 512, 8);
  // Registration on the port and starboard sides.
  g.fillStyle = '#2a2622';
  g.font = '700 34px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('WW-07', 128, 96);
  g.fillText('WW-07', 384, 96);
  g.font = '600 17px "Helvetica Neue", Arial, sans-serif';
  g.fillText('CINDER COAST AIR', 128, 184);
  g.fillText('CINDER COAST AIR', 384, 184);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Loft elliptical cross-sections along the fuselage, nose at -Z. */
function loftFuselage(sections, radial = 10) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const rings = [];
  for (const s of sections) {
    const ring = [];
    for (let i = 0; i <= radial; i += 1) {
      const a = (i / radial) * Math.PI * 2;
      ring.push(new THREE.Vector3(Math.cos(a) * s.w, Math.sin(a) * s.h + (s.y ?? 0), s.z));
    }
    rings.push(ring);
  }
  for (let r = 0; r < rings.length - 1; r += 1) {
    const a = rings[r];
    const b = rings[r + 1];
    for (let i = 0; i < radial; i += 1) {
      const v00 = a[i];
      const v01 = a[i + 1];
      const v10 = b[i];
      const v11 = b[i + 1];
      const v0 = (r / (rings.length - 1));
      const v1 = ((r + 1) / (rings.length - 1));
      const u0 = i / radial;
      const u1 = (i + 1) / radial;
      positions.push(...v00.toArray(), ...v10.toArray(), ...v01.toArray());
      uvs.push(u0, v0, u0, v1, u1, v0);
      positions.push(...v01.toArray(), ...v10.toArray(), ...v11.toArray());
      uvs.push(u1, v0, u0, v1, u1, v1);
      const base = indices.length;
      indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function strut(from, to, radius = 0.055) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 5);
  const mesh = new THREE.Mesh(geo, METAL);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function tyre(x, y, z, radius = 0.42) {
  const group = new THREE.Group();
  const t = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.36, 6, 12), DARK);
  t.rotation.y = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.34, radius * 0.34, 0.18, 8), METAL);
  hub.rotation.z = Math.PI / 2;
  group.add(t, hub);
  group.position.set(x, y, z);
  return group;
}

function liveryBump() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7c7c7c';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#2e2e2e';
  g.lineWidth = 2;
  for (let x = 24; x < 512; x += 48) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
  }
  g.fillStyle = '#e2e2e2';
  for (let x = 24; x < 512; x += 48) {
    for (let y = 10; y < 256; y += 13) g.fillRect(x - 1, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wingTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e7d9bd';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = 'rgba(94,82,64,0.38)';
  g.lineWidth = 1.5;
  for (let x = 16; x < 512; x += 40) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke();
  }
  g.strokeStyle = 'rgba(94,82,64,0.26)';
  g.beginPath(); g.moveTo(0, 18); g.lineTo(512, 18); g.stroke();
  g.beginPath(); g.moveTo(0, 112); g.lineTo(512, 112); g.stroke();
  for (let i = 0; i < 30; i += 1) {
    g.fillStyle = `rgba(80,66,48,${0.03 + Math.random() * 0.05})`;
    g.fillRect(Math.random() * 512, 20 + Math.random() * 80, 3 + Math.random() * 14, 2 + Math.random() * 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAircraft() {
  const group = new THREE.Group();
  group.name = 'petrel-aircraft';

  const fuselage = loftFuselage([
    { z: -4.35, w: 0.1, h: 0.12, y: 0.06 },
    { z: -4.0, w: 0.42, h: 0.4, y: 0.03 },
    { z: -3.3, w: 0.68, h: 0.62, y: 0 },
    { z: -2.4, w: 0.86, h: 0.78, y: 0.02 },
    { z: -1.35, w: 0.98, h: 0.86, y: 0.03 },
    { z: -0.2, w: 1.0, h: 0.9, y: 0.02 },
    { z: 0.9, w: 0.86, h: 0.82, y: 0.04 },
    { z: 2.0, w: 0.6, h: 0.62, y: 0.1 },
    { z: 3.1, w: 0.34, h: 0.42, y: 0.18 },
    { z: 4.15, w: 0.12, h: 0.22, y: 0.28 },
  ], 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: liveryTexture(), bumpMap: liveryBump(), bumpScale: 0.012, roughness: 0.52, metalness: 0.08, envMapIntensity: 0.25,
  });
  const body = new THREE.Mesh(fuselage, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Canopy and cabin windows.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.62, 1.65), GLASS);
  canopy.position.set(0, 0.78, -1.55);
  canopy.rotation.x = -0.06;
  group.add(canopy);
  const canopyFrame = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 1.7), TEAL);
  canopyFrame.position.set(0, 1.1, -1.55);
  group.add(canopyFrame);
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.72), GLASS);
    window.position.set(side * 0.9, 0.52, 0.02);
    group.add(window);
  }

  // High wing with dihedral, one panel a side.
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTexture(), roughness: 0.56, metalness: 0.05, envMapIntensity: 0.25 });
  const ailerons = [];
  const wing = new THREE.Group();
  wing.position.set(0, 0.94, -0.55);
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.16, 1.62), wingMat);
    panel.position.set(side * 2.7, 0.18 * Math.abs(1), 0);
    panel.rotation.z = side * 0.035;
    panel.castShadow = true;
    wing.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 1.5), CORAL);
    tip.position.set(side * 5.18, 0.36, 0);
    tip.rotation.z = side * 0.035;
    wing.add(tip);
    const aileronHinge = new THREE.Group();
    aileronHinge.position.set(side * 4.1, 0.12, 0.86);
    const aileron = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.3), wingMat);
    aileron.position.z = 0.15;
    aileronHinge.add(aileron);
    wing.add(aileronHinge);
    ailerons.push({ hinge: aileronHinge, side });
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 8, 6),
      new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff4a3d' : '#54ff9e' }),
    );
    nav.position.set(side * 5.55, 0.38, -0.05);
    wing.add(nav);
    wing.add(strut(new THREE.Vector3(side * 0.55, -0.65, 0.1), new THREE.Vector3(side * 2.4, 0.25, 0.15)));
    wing.add(strut(new THREE.Vector3(side * 0.55, -0.65, -0.1), new THREE.Vector3(side * 2.4, 0.25, -1.05)));
  }
  group.add(wing);

  // Flaps: hinged at the trailing edge, lowered for landing shots.
  const flaps = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 2.35, 0.11, 0.86);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.06, 0.62), CREAM);
    flap.position.z = 0.31;
    hinge.add(flap);
    wing.add(hinge);
    flaps.push(hinge);
  }

  // Tail surfaces.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.28, 1.15), CORAL);
  fin.position.set(0, 0.95, 3.62);
  fin.rotation.x = -0.1;
  group.add(fin);
  const rudderHinge = new THREE.Group();
  rudderHinge.position.set(0, 0.84, 4.12);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.34), CREAM);
  rudder.position.z = 0.18;
  rudderHinge.add(rudder);
  group.add(rudderHinge);
  const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 0.86), CREAM);
  stabilizer.position.set(0, 0.34, 3.8);
  group.add(stabilizer);
  const elevators = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.96, 0.34, 4.15);
    const elevator = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.32), CORAL);
    elevator.position.z = 0.17;
    hinge.add(elevator);
    group.add(hinge);
    elevators.push(hinge);
  }

  // Nose spinner, propeller and its motion disc.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 12), CORAL);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.set(0, 0.03, -4.55);
  group.add(spinner);
  const propeller = new THREE.Group();
  propeller.position.set(0, 0.03, -4.72);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.55, 0.05), DARK);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.14, 0.05), DARK);
  propeller.add(blade, blade2);
  group.add(propeller);

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = 256;
  blurCanvas.height = 256;
  const bctx = blurCanvas.getContext('2d');
  const blurGrad = bctx.createRadialGradient(128, 128, 10, 128, 128, 126);
  blurGrad.addColorStop(0, 'rgba(40,40,40,0.0)');
  blurGrad.addColorStop(0.45, 'rgba(40,40,40,0.16)');
  blurGrad.addColorStop(0.72, 'rgba(30,30,30,0.3)');
  blurGrad.addColorStop(1, 'rgba(30,30,30,0)');
  bctx.fillStyle = blurGrad;
  bctx.fillRect(0, 0, 256, 256);
  const blurTex = new THREE.CanvasTexture(blurCanvas);
  const propDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 2.7),
    new THREE.MeshBasicMaterial({ map: blurTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.85 }),
  );
  propDisc.position.set(0, 0.03, -4.74);
  group.add(propDisc);

  // Landing gear: two tundra tyres and a tailwheel.
  const gear = new THREE.Group();
  for (const side of [-1, 1]) {
    gear.add(strut(new THREE.Vector3(side * 1.02, -0.62, -0.75), new THREE.Vector3(side * 1.52, -1.42, -0.85), 0.075));
    gear.add(tyre(side * 1.52, -1.52, -0.85, 0.46));
  }
  gear.add(strut(new THREE.Vector3(0, -0.42, 3.1), new THREE.Vector3(0, -1.12, 3.55), 0.05));
  gear.add(tyre(0, -1.18, 3.58, 0.24));
  group.add(gear);

  // Aerial and pitot, small readable details.
  const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), DARK);
  aerial.position.set(0.2, 1.45, 1.1);
  group.add(aerial);
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 4), METAL);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(4.0, 0.35, -0.9);
  group.add(pitot);

  // Glowing navigation lights, exhausts, caps and handles: the details that read up close.
  const glowC = document.createElement('canvas');
  glowC.width = 64; glowC.height = 64;
  const glowG = glowC.getContext('2d');
  const glowR = glowG.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowR.addColorStop(0, 'rgba(255,255,255,1)');
  glowR.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  glowR.addColorStop(1, 'rgba(255,255,255,0)');
  glowG.fillStyle = glowR; glowG.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(glowC);
  for (const side of [-1, 1]) {
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: side < 0 ? '#ff4a3d' : '#54ff9e', transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35,
    }));
    lamp.position.set(side * 5.55, 0.38, -0.12);
    lamp.scale.setScalar(0.45);
    group.add(lamp);
  }
  const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: '#fff0d0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
  }));
  tailGlow.position.set(0, 0.6, 4.4);
  tailGlow.scale.setScalar(0.8);
  group.add(tailGlow);

  const exhaustMat = new THREE.MeshStandardMaterial({ color: '#39342f', roughness: 0.5, metalness: 0.8, envMapIntensity: 1.1 });
  for (const side of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.0, 7), exhaustMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.58, -0.18, -2.35);
    group.add(pipe);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 10), METAL);
    cap.position.set(side * 2.35, 1.04, -0.08);
    group.add(cap);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 5, 8), METAL);
    tie.rotation.x = Math.PI / 2;
    tie.position.set(side * 2.6, 0.79, 0.42);
    group.add(tie);
    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.34), CREAM);
    fairing.position.set(side * 2.4, 1.02, 0.12);
    group.add(fairing);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.035), METAL);
  handle.position.set(0.99, 0.2, -0.42);
  group.add(handle);
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.12), METAL);
  step.position.set(0.86, -0.62, 0.1);
  group.add(step);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff5a3a' }));
  beacon.position.set(0, 1.02, 1.0);
  group.add(beacon);

  // Registration on the fin, one each side.
  {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 96);
    g.fillStyle = 'rgba(240,232,212,0.96)';
    g.font = '700 38px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('WW-07', 128, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.82, 0.3),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      decal.position.set(side * 0.065, 0.9, 3.62);
      decal.rotation.y = side * Math.PI / 2;
      group.add(decal);
    }
  }

  const landingLight = new THREE.SpotLight('#fff0d0', 55, 700, 0.38, 0.5, 1.3);
  landingLight.name = 'petrel-landing-light';
  landingLight.position.set(0, -0.35, -4.1);
  landingLight.target.position.set(0, -3.5, -90);
  landingLight.visible = false;
  group.add(landingLight, landingLight.target);

  group.userData = { propeller, propDisc, flaps, gear, wing, body, canopy, canopyFrame, ailerons, elevators, rudder: rudderHinge, landingLight };
  return group;
}
