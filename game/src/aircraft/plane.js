// The Petrel: a high-wing bush plane built from a lofted fuselage, a strut-braced wing and
// over-sized tundra tyres. All geometry is generated here; the livery is a painted canvas.
import * as THREE from '../../vendor/three.module.min.js';

const CREAM = new THREE.MeshStandardMaterial({ color: '#f2e4c6', roughness: 0.58, metalness: 0.06 });
const CORAL = new THREE.MeshStandardMaterial({ color: '#e8613f', roughness: 0.55, metalness: 0.03 });
const TEAL = new THREE.MeshStandardMaterial({ color: '#2f6d72', roughness: 0.5, metalness: 0.12 });
const DARK = new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.72, metalness: 0.18 });
const METAL = new THREE.MeshStandardMaterial({ color: '#9aa0a4', roughness: 0.32, metalness: 0.7 });
const GLASS = new THREE.MeshStandardMaterial({
  color: '#16333d', roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.82,
  side: THREE.DoubleSide,
});

function liveryTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f0e2c4';
  g.fillRect(0, 0, 512, 256);
  // Panel seams.
  g.strokeStyle = 'rgba(120,104,80,0.25)';
  g.lineWidth = 2;
  for (let x = 24; x < 512; x += 48) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
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
    map: liveryTexture(), roughness: 0.56, metalness: 0.07,
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
  const wing = new THREE.Group();
  wing.position.set(0, 0.94, -0.55);
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.16, 1.62), CREAM);
    panel.position.set(side * 2.7, 0.18 * Math.abs(1), 0);
    panel.rotation.z = side * 0.035;
    panel.castShadow = true;
    wing.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 1.5), CORAL);
    tip.position.set(side * 5.18, 0.36, 0);
    tip.rotation.z = side * 0.035;
    wing.add(tip);
    const aileron = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.3), CREAM);
    aileron.position.set(side * 4.1, 0.12, 0.86);
    wing.add(aileron);
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
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.34), CREAM);
  rudder.position.set(0, 0.84, 4.28);
  group.add(rudder);
  const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 0.86), CREAM);
  stabilizer.position.set(0, 0.34, 3.8);
  group.add(stabilizer);
  for (const side of [-1, 1]) {
    const elevator = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.32), CORAL);
    elevator.position.set(side * 0.96, 0.34, 4.28);
    group.add(elevator);
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

  group.userData = { propeller, propDisc, flaps, gear, wing, body, canopy, canopyFrame };
  return group;
}
