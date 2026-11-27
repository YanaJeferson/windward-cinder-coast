// Late-afternoon sky over the Cinder Coast: a warm horizon, a deep zenith, a low sun and slow
// banks of cloud. Built from three.js primitives and canvas-drawn cloud sprites, no image files.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, PALETTE } from '../config.js';
import { createRandom } from '../util/math.js';

export function sunDirection() {
  const az = THREE.MathUtils.degToRad(WORLD.sun.azimuth);
  const el = THREE.MathUtils.degToRad(WORLD.sun.elevation);
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    -Math.cos(el) * Math.cos(az),
  ).normalize();
}

function cloudTexture(seed) {
  const random = createRandom(seed);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 34; i += 1) {
    const x = 60 + random() * 392;
    const y = 92 + random() * 96;
    const r = 26 + random() * 82;
    const grade = g.createRadialGradient(x, y, r * 0.1, x, y, r);
    grade.addColorStop(0, `rgba(255, 238, 214, ${0.22 + random() * 0.16})`);
    grade.addColorStop(0.55, `rgba(255, 214, 172, ${0.1 + random() * 0.1})`);
    grade.addColorStop(1, 'rgba(255, 200, 160, 0)');
    g.fillStyle = grade;
    g.beginPath();
    g.ellipse(x, y, r * 1.5, r * 0.52, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Feather the canvas edges so the billboard never shows its square boundary.
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(256, 128, 30, 256, 128, 244);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.7, 'rgba(0,0,0,0.9)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, 512, 256);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSky() {
  const group = new THREE.Group();
  group.name = 'cinder-sky';
  const sunDir = sunDirection();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(26000, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSun: { value: sunDir },
        uZenith: { value: new THREE.Color('#2e6a94') },
        uHorizon: { value: new THREE.Color('#f7c795') },
        uLow: { value: new THREE.Color('#e7a273') },
        uSunColor: { value: new THREE.Color('#ffe9c6') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uZenith, uHorizon, uLow, uSunColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.08, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.56));
          col = mix(col, uLow, smoothstep(0.12, -0.04, vDir.y) * 0.55);
          float d = max(dot(normalize(vDir), uSun), 0.0);
          col += uSunColor * pow(d, 520.0) * 1.5;
          col += uSunColor * pow(d, 22.0) * 0.2;
          col += uSunColor * pow(d, 5.0) * 0.045;
          float band = smoothstep(0.02, 0.16, vDir.y) * smoothstep(0.34, 0.2, vDir.y);
          col += vec3(0.03, 0.014, 0.004) * band * (0.5 + 0.5 * sin(vDir.x * 12.0 + vDir.z * 9.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  dome.renderOrder = -20;
  group.add(dome);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(256, 'rgba(255,244,214,1)', 'rgba(255,173,96,0)'),
    color: '#ffd9a2',
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
    opacity: 0.5,
  }));
  glow.position.copy(sunDir).multiplyScalar(21000);
  glow.scale.setScalar(8000);
  glow.renderOrder = -19;
  group.add(glow);

  const disc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(128, 'rgba(255,252,236,1)', 'rgba(255,220,160,0.0)'),
    color: '#fff6dd',
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
  }));
  disc.position.copy(sunDir).multiplyScalar(22000);
  disc.scale.setScalar(1450);
  disc.renderOrder = -18;
  group.add(disc);

  const random = createRandom(404);
  const cloudMats = [1, 2, 3].map((i) => new THREE.SpriteMaterial({
    map: cloudTexture(900 + i * 71),
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    fog: false,
    color: new THREE.Color('#ffd6ac'),
  }));
  for (let i = 0; i < 18; i += 1) {
    const sprite = new THREE.Sprite(cloudMats[i % 3]);
    const angle = random() * Math.PI * 2;
    const dist = 4200 + random() * 12500;
    sprite.position.set(
      Math.cos(angle) * dist,
      620 + random() * 1250,
      Math.sin(angle) * dist,
    );
    const s = 900 + random() * 2200;
    sprite.scale.set(s * 2.1, s * 0.72, 1);
    sprite.material = cloudMats[i % 3].clone();
    sprite.material.opacity = 0.4 + random() * 0.35;
    sprite.renderOrder = -15;
    group.add(sprite);
  }

  // A fixed bank over the northern horizon, so the sky has volume at every heading.
  for (let i = 0; i < 7; i += 1) {
    const sprite = new THREE.Sprite(cloudMats[i % 3].clone());
    sprite.position.set(-5200 + i * 1750, 760 + (i % 3) * 230, -5200 - (i % 4) * 700);
    sprite.scale.set(3400 + (i % 3) * 900, 780 + (i % 2) * 260, 1);
    sprite.material.opacity = 0.42 + (i % 3) * 0.09;
    sprite.renderOrder = -15;
    group.add(sprite);
  }

  const hemi = new THREE.HemisphereLight('#d4e6f4', '#5b4a36', 1.35);
  group.add(hemi);

  const sun = new THREE.DirectionalLight('#fff0d2', 3.6);
  sun.position.copy(sunDir).multiplyScalar(4000);
  sun.target.position.set(0, 0, 0);
  group.add(sun);
  group.add(sun.target);

  const rim = new THREE.DirectionalLight('#ffcf9f', 0.85);
  rim.position.set(1500, 1200, 2600);
  group.add(rim);

  group.userData = { sunDir, sun, hemi };
  return group;
}

export function radialTexture(size, inner, outer) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grade = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grade.addColorStop(0, inner);
  grade.addColorStop(0.42, inner);
  grade.addColorStop(1, outer);
  g.fillStyle = grade;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
