// Course furniture: the numbered rings the pilot threads, each with a soft halo and a banner that
// stays readable from a kilometre out. The same object serves every mission.
import * as THREE from '../../vendor/three.module.min.js';
import { radialTexture } from './sky.js';

const IDLE = new THREE.Color('#ffb45c');
const NEXT = new THREE.Color('#7ff0de');
const DONE = new THREE.Color('#5c6a6a');

function ringGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 24, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,180,92,0)');
  grad.addColorStop(0.48, 'rgba(255,180,92,0)');
  grad.addColorStop(0.58, 'rgba(255,190,110,0.5)');
  grad.addColorStop(0.72, 'rgba(255,160,80,0.22)');
  grad.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function numberTexture(n) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(12,18,20,0.65)';
  g.beginPath();
  g.arc(64, 64, 54, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd08a';
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = '#ffe9c0';
  g.font = '700 62px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGate(def, index) {
  const group = new THREE.Group();
  group.name = `gate-${index + 1}`;
  const radius = def.radius ?? 24;

  const ringMat = new THREE.MeshBasicMaterial({ color: IDLE, transparent: true, opacity: 0.92 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.55, 8, 42), ringMat);
  ring.userData.gate = index;
  group.add(ring);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: ringGlowTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.5,
  }));
  glow.scale.setScalar(radius * 2.45);
  group.add(glow);

  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: numberTexture(index + 1), transparent: true, depthWrite: false, depthTest: false,
  }));
  label.scale.setScalar(11);
  label.position.set(0, radius + 9, 0);
  group.add(label);

  // Four studs so the ring reads as a built object, not a decal.
  const studMat = new THREE.MeshBasicMaterial({ color: '#2b2520' });
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const stud = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 1.1), studMat);
    stud.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    stud.rotation.z = a;
    group.add(stud);
  }

  const normal = new THREE.Vector3(
    Math.sin(THREE.MathUtils.degToRad(def.heading ?? 0)),
    0,
    -Math.cos(THREE.MathUtils.degToRad(def.heading ?? 0)),
  ).normalize();
  group.position.copy(def.position);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

  return {
    group, ring, glow, label, normal, radius,
    position: def.position.clone(),
    passed: false,
    pulse: 0,
    def,
  };
}

export function createGates(defs) {
  const group = new THREE.Group();
  group.name = 'course-gates';
  const gates = defs.map((def, i) => {
    const gate = createGate(def, i);
    group.add(gate.group);
    return gate;
  });
  return { group, gates };
}

export function updateGates(gates, targetIndex, elapsed) {
  for (let i = 0; i < gates.length; i += 1) {
    const gate = gates[i];
    const isNext = i === targetIndex;
    gate.group.visible = !gate.passed;
    gate.ring.material.color.copy(gate.passed ? DONE : isNext ? NEXT : IDLE);
    gate.ring.material.opacity = gate.passed ? 0.35 : isNext ? 0.9 + Math.sin(elapsed * 3.5) * 0.1 : 0.58;
    gate.glow.material.opacity = gate.passed ? 0.12 : isNext ? 0.7 + Math.sin(elapsed * 3.5) * 0.16 : 0.28;
    gate.label.material.opacity = gate.passed ? 0.25 : 1;
    if (isNext) {
      gate.group.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.018);
      gate.label.position.y = gate.radius + 9 + Math.sin(elapsed * 1.7) * 1.2;
    } else {
      gate.group.scale.setScalar(1);
    }
  }
}

/** A rescue beacon: a warm column of light that marks the survivor in the last mission. */
export function createBeacon(position) {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 2.6, 90, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ffb15a', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  column.position.y = 45;
  group.add(column);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(128, 'rgba(255,220,160,0.9)', 'rgba(255,120,40,0)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flare.scale.setScalar(22);
  flare.position.y = 3;
  group.add(flare);
  group.position.copy(position);
  group.userData = { column, flare };
  return group;
}
