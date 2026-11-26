// The cockpit: a dark tub, a riveted panel of six lit gauges with real needles, a moving map and
// the frame of a high-wing canopy. Everything is mounted in the airframe, so the view rolls with it.
import * as THREE from '../../vendor/three.module.min.js';
import { gaugeAngle, makeGaugeFace } from '../util/textures.js';
import { altitudeFt, speedKts, verticalFpm } from './flight.js';

const GAUGE_LAYOUT = [
  { kind: 'asi', x: -0.3, y: 0.09 },
  { kind: 'alt', x: 0, y: 0.09 },
  { kind: 'vsi', x: 0.3, y: 0.09 },
  { kind: 'rpm', x: -0.3, y: -0.1 },
  { kind: 'fuel', x: 0, y: -0.1 },
  { kind: 'hdg', x: 0.3, y: -0.1 },
];

function tube(from, to, radius = 0.014, material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6), material);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function mapCanvas() {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  return { c, g: c.getContext('2d') };
}

export function createCockpit() {
  const group = new THREE.Group();
  group.name = 'petrel-cockpit';

  const shellMat = new THREE.MeshStandardMaterial({ color: '#191d1f', roughness: 0.94, metalness: 0.05 });
  const panelMat = new THREE.MeshStandardMaterial({ color: '#23282b', roughness: 0.7, metalness: 0.28 });
  const bezelMat = new THREE.MeshStandardMaterial({ color: '#0d1012', roughness: 0.38, metalness: 0.7 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#b9ab8e', roughness: 0.5, metalness: 0.25 });

  // Dark cockpit tub: floor, door sills, rear bulkhead and headliner.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, 1.55), shellMat);
  floor.position.set(0, 0.4, -0.35);
  group.add(floor);

  const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.1, 0.06), shellMat);
  bulkhead.position.set(0, 0.95, 0.42);
  group.add(bulkhead);

  // Panel on a tilted mount, with a padded coaming.
  const panelGroup = new THREE.Group();
  panelGroup.position.set(0, 0.66, -1.5);
  panelGroup.rotation.x = -0.4;
  group.add(panelGroup);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.46, 0.06), panelMat);
  panelGroup.add(panel);
  const coaming = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.07, 0.2), shellMat);
  coaming.position.set(0, 0.255, 0.05);
  coaming.rotation.x = 0.12;
  panelGroup.add(coaming);

  // Panel floodlight: a warm wash across the dials.
  const backCanvas = document.createElement('canvas');
  backCanvas.width = 256;
  backCanvas.height = 128;
  const bg = backCanvas.getContext('2d');
  const halo = bg.createRadialGradient(128, 66, 8, 128, 66, 126);
  halo.addColorStop(0, 'rgba(255,178,96,0.35)');
  halo.addColorStop(0.55, 'rgba(255,150,70,0.12)');
  halo.addColorStop(1, 'rgba(255,140,60,0)');
  bg.fillStyle = halo;
  bg.fillRect(0, 0, 256, 128);
  const backTex = new THREE.CanvasTexture(backCanvas);
  backTex.colorSpace = THREE.SRGBColorSpace;
  const backlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.52),
    new THREE.MeshBasicMaterial({ map: backTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  backlight.position.set(0, 0, 0.031);
  panelGroup.add(backlight);

  // Placard strip along the top of the panel.
  {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 32;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 32);
    g.fillStyle = 'rgba(225,212,184,0.6)';
    g.font = '600 17px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('MASTER   ·   FUEL PUMP   ·   AVIONICS   ·   TRIM', 256, 17);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const placard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.045),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    placard.position.set(0, 0.215, 0.042);
    panelGroup.add(placard);
  }

  // Radio stack, with a warm green display.
  for (let i = 0; i < 2; i += 1) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#101a15';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#26352b';
    g.strokeRect(2, 2, 124, 60);
    g.fillStyle = '#7fe0a4';
    g.font = '600 19px "SF Mono", Consolas, monospace';
    g.textAlign = 'center';
    g.fillText(i === 0 ? 'COM1 121.90' : 'NAV1 108.30', 64, 28);
    g.fillStyle = 'rgba(127,224,164,0.55)';
    g.font = '500 12px "SF Mono", Consolas, monospace';
    g.fillText(i === 0 ? 'STBY 121.50' : 'STBY 109.00', 64, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.095, 0.045),
      new THREE.MeshStandardMaterial({ color: '#1a1f21', roughness: 0.7, metalness: 0.3 }),
    );
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.075),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    box.position.set(0.58 + i * 0.0, 0.86 - i * 0.1, -1.3);
    screen.position.set(0.58, 0.86 - i * 0.1, -1.275);
    group.add(box, screen);
  }

  const gauges = [];
  for (const item of GAUGE_LAYOUT) {
    const face = makeGaugeFace(item.kind);
    const pivot = new THREE.Group();
    pivot.position.set(item.x, item.y, 0.032);

    const faceMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.089, 28),
      new THREE.MeshBasicMaterial({ map: face.texture }),
    );
    pivot.add(faceMesh);

    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.008, 6, 24), bezelMat);
    bezel.position.z = 0.004;
    pivot.add(bezel);

    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.078, 0.0042, 0.002),
      new THREE.MeshBasicMaterial({ color: '#ffd89a' }),
    );
    needle.geometry.translate(0.03, 0, 0);
    needle.position.z = 0.009;
    pivot.add(needle);
    const hub = new THREE.Mesh(new THREE.CircleGeometry(0.009, 10), new THREE.MeshBasicMaterial({ color: '#f7e9c8' }));
    hub.position.z = 0.011;
    pivot.add(hub);

    panelGroup.add(pivot);
    gauges.push({ ...item, needle, face });
  }

  // Moving map, set low in the panel.
  const { c: mapC, g: mapG } = mapCanvas();
  const mapTex = new THREE.CanvasTexture(mapC);
  mapTex.colorSpace = THREE.SRGBColorSpace;


  // Warning strip: three lamps that light with the aircraft's state.
  const lamps = {};
  const lampDefs = [
    ['stall', -0.14, '#ff4a3a'],
    ['gear', 0, '#61d6c9'],
    ['fuel', 0.14, '#ffb45c'],
  ];
  for (const [key, x, color] of lampDefs) {
    const lamp = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.02),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12 }),
    );
    lamp.position.set(x, 0.31, 0.04);
    panelGroup.add(lamp);
    lamps[key] = lamp;
  }

  // Yoke and throttle quadrant, low in frame.
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.34, 6), bezelMat);
  column.rotation.x = 1.05;
  column.position.set(0.3, 0.4, -1.05);
  group.add(column);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.014, 6, 18, Math.PI * 1.3),
    new THREE.MeshStandardMaterial({ color: '#15181a', roughness: 0.82 }),
  );
  wheel.position.set(0.3, 0.54, -0.93);
  wheel.rotation.x = -1.05;
  wheel.rotation.z = 0.35;
  group.add(wheel);
  const throttleBase = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.2), panelMat);
  throttleBase.position.set(-0.44, 0.37, -1.08);
  group.add(throttleBase);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: '#c9b68c', metalness: 0.5, roughness: 0.4 }));
  lever.position.set(-0.44, 0.45, -1.08);
  lever.rotation.x = 0.3;
  group.add(lever);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshStandardMaterial({ color: '#1b1e20' }));
  knob.position.set(-0.44, 0.53, -1.06);
  group.add(knob);

  // Canopy frame: thin A-pillars, a header and sill rails around the windshield opening.
  for (const side of [-1, 1]) {
    group.add(tube(new THREE.Vector3(side * 0.96, 1.0, -1.5), new THREE.Vector3(side * 0.78, 1.5, -0.85), 0.011, frameMat));
    group.add(tube(new THREE.Vector3(side * 0.78, 1.5, -0.85), new THREE.Vector3(side * 0.84, 0.94, -0.75), 0.008, frameMat));
  }
  group.add(tube(new THREE.Vector3(-0.78, 1.5, -0.85), new THREE.Vector3(0.78, 1.5, -0.85), 0.012, frameMat));

  // A narrow fascia under the panel, so the dials sit in a dashboard.
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.26, 0.08), shellMat);
  fascia.position.set(0, 0.4, -1.55);
  group.add(fascia);

  // Glareshield and low side sills: they close the cockpit around the view without blocking it.
  const glare = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.09, 0.3), shellMat);
  glare.position.set(0, 0.94, -1.4);
  glare.rotation.x = -0.08;
  group.add(glare);
  const dashBase = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.36, 1.0), shellMat);
  dashBase.position.set(0, 0.27, -0.82);
  group.add(dashBase);


  // A faint tint on the windshield, enough to catch the sun.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.52),
    new THREE.MeshBasicMaterial({ color: '#cfe6ea', transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false }),
  );
  glass.position.set(0, 1.26, -1.12);
  glass.rotation.x = -0.55;
  group.add(glass);

  const state = { mapC, mapG, mapTex };
  let mapTick = 0;

  function drawMap(flight, gates, target) {
    const g = mapG;
    const S = 160;
    const cx = S / 2;
    const cy = S / 2;
    const scale = 0.075;
    g.fillStyle = '#0c2226';
    g.fillRect(0, 0, S, S);
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = 'rgba(97,214,201,0.18)';
    g.lineWidth = 1;
    for (let i = -4; i <= 4; i += 1) {
      g.beginPath(); g.moveTo(i * 20, -S); g.lineTo(i * 20, S); g.stroke();
      g.beginPath(); g.moveTo(-S, i * 20); g.lineTo(S, i * 20); g.stroke();
    }
    for (const gate of gates) {
      const dx = (gate.position.x - flight.position.x) * scale;
      const dz = (gate.position.z - flight.position.z) * scale;
      g.beginPath();
      g.arc(dx, dz, gate === gates[target] ? 3.6 : 2.2, 0, Math.PI * 2);
      g.fillStyle = gate.passed ? 'rgba(120,140,140,0.5)' : gate === gates[target] ? '#7ff0de' : '#ffb45c';
      g.fill();
    }
    g.restore();
    g.save();
    g.translate(cx, cy);
    g.rotate((-flight.heading * Math.PI) / 180 + Math.PI);
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(4.6, 5);
    g.lineTo(0, 2.6);
    g.lineTo(-4.6, 5);
    g.closePath();
    g.fillStyle = '#fff1d2';
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,241,210,0.35)';
    g.strokeRect(3, 3, S - 6, S - 6);
    g.fillStyle = '#ffcf87';
    g.font = '600 9px monospace';
    g.fillText('CINDER COAST', 8, 16);
    state.mapTex.needsUpdate = true;
  }

  function update(flight, dt, gates, target) {
    for (const gauge of gauges) {
      let value = 0;
      if (gauge.kind === 'asi') value = speedKts(flight);
      else if (gauge.kind === 'alt') value = altitudeFt(flight);
      else if (gauge.kind === 'vsi') value = verticalFpm(flight);
      else if (gauge.kind === 'rpm') value = 700 + flight.throttle * 2100;
      else if (gauge.kind === 'fuel') value = flight.fuel;
      else if (gauge.kind === 'hdg') value = flight.heading;
      gauge.needle.rotation.z = -gaugeAngle(gauge.kind, value);
    }
    lamps.stall.material.opacity = flight.stall ? 0.95 : 0.1;
    lamps.gear.material.opacity = flight.gearDown ? 0.85 : 0.1;
    lamps.fuel.material.opacity = flight.fuel < 22 ? 0.95 : 0.1;
    mapTick += dt;
    if (mapTick > 0.2) {
      mapTick = 0;
      drawMap(flight, gates, Math.min(target, gates.length - 1));
    }
    lever.rotation.x = 0.3 - flight.throttle * 0.5;
    knob.position.y = 0.53 - flight.throttle * 0.05;
  }

  drawMap({ position: new THREE.Vector3(), heading: 0 }, [], 0);

  return { group, update, gauges, lamps, drawMap };
}
