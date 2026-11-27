// Weather over the Cinder Coast: sun, wind, rain, storm, fog, snow and night. One preset owns the
// sky, fog, lights, sea, precipitation, wind and snow cover, so every system changes together.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../config.js';
import { createRandom } from '../util/math.js';

export const WEATHER_CHOICES = ['auto', 'sunny', 'sunset', 'windy', 'rain', 'storm', 'fog', 'snow', 'night'];
export const WEATHER_LABELS = {
  auto: 'AUTO', sunny: 'SOL', sunset: 'ATARDECER', windy: 'VIENTO', rain: 'LLUVIA', storm: 'TORMENTA', fog: 'NIEBLA', snow: 'NIEVE', night: 'NOCHE',
};

const PRESETS = {
  sunny: {
    label: 'SOL', bg: 'photo', bgInt: 1,
    fog: '#c9d5da', fogNear: 5000, fogFar: 22000,
    sunColor: '#fff0d2', sunIntensity: 3.2, hemiSky: '#c8dcea', hemiGround: '#5b4a36', hemiIntensity: 1.5,
    seaDeep: '#2b8fa3', seaShallow: '#7fd8c8', seaSky: '#cfe4f0', seaFog: '#c9d5da', seaFogNear: 900, seaFogFar: 18000,
    rain: false, snow: false, snowGround: 0, lightning: false, env: 0.24, landingLight: false,
    wind: { from: 250, speed: 3, gust: 1.2 },
  },
  sunset: {
    label: 'ATARDECER', bg: 'sunset', bgInt: 1, bgBlur: 0, sunAzimuth: 300, sunElevation: 11.5, envKind: 'sunset',
    fog: '#d89d7c', fogNear: 1700, fogFar: 15500,
    sunColor: '#ffb178', sunIntensity: 2.6, hemiSky: '#ffd3b0', hemiGround: '#5c3d33', hemiIntensity: 1.2,
    seaDeep: '#1d5162', seaShallow: '#69b4ad', seaSky: '#ffc08a', seaFog: '#d59a76', seaFogNear: 700, seaFogFar: 13000,
    rain: false, snow: false, snowGround: 0, lightning: false, env: 0.14, landingLight: false,
    wind: { from: 250, speed: 4, gust: 1.5 },
  },
  windy: {
    label: 'VIENTO', bg: 'photo', bgInt: 1,
    fog: '#c4d2d9', fogNear: 4500, fogFar: 20000,
    sunColor: '#fff0d2', sunIntensity: 2.7, hemiSky: '#c8dcea', hemiGround: '#5b4a36', hemiIntensity: 1.15,
    seaDeep: '#287f93', seaShallow: '#79d4c4', seaSky: '#cfe4f0', seaFog: '#c9d5da', seaFogNear: 800, seaFogFar: 17000,
    rain: false, snow: false, snowGround: 0, lightning: false, env: 0.3, landingLight: false,
    wind: { from: 262, speed: 14, gust: 7 },
  },
  rain: {
    label: 'LLUVIA', bg: 'photo', bgInt: 0.55,
    fog: '#8b979d', fogNear: 800, fogFar: 7500,
    sunColor: '#d8e2e6', sunIntensity: 0.8, hemiSky: '#9fb2bd', hemiGround: '#3f443d', hemiIntensity: 0.85,
    seaDeep: '#244b56', seaShallow: '#5e8b8d', seaSky: '#9baeb6', seaFog: '#8b979d', seaFogNear: 300, seaFogFar: 7000,
    rain: true, snow: false, snowGround: 0, lightning: false, env: 0.35, landingLight: true,
    wind: { from: 245, speed: 8, gust: 3 },
  },
  storm: {
    label: 'TORMENTA', bg: 'photo', bgInt: 0.25,
    fog: '#5f6b72', fogNear: 350, fogFar: 4800,
    sunColor: '#b9c6cc', sunIntensity: 0.35, hemiSky: '#829298', hemiGround: '#343a38', hemiIntensity: 0.7,
    seaDeep: '#1d3a45', seaShallow: '#416f72', seaSky: '#7f8f94', seaFog: '#5f6b72', seaFogNear: 180, seaFogFar: 5000,
    rain: true, snow: false, snowGround: 0, lightning: true, env: 0.22, landingLight: true,
    wind: { from: 250, speed: 12, gust: 6 },
  },
  fog: {
    label: 'NIEBLA', bg: 'fog', bgInt: 1,
    fog: '#c3ced1', fogNear: 100, fogFar: 3000,
    sunColor: '#e7edf0', sunIntensity: 1.0, hemiSky: '#c7d5dc', hemiGround: '#5a5a50', hemiIntensity: 1.05,
    seaDeep: '#4d6f78', seaShallow: '#8aa6a6', seaSky: '#c3ced1', seaFog: '#c3ced1', seaFogNear: 60, seaFogFar: 2600,
    rain: false, snow: false, snowGround: 0, lightning: false, env: 0.4, landingLight: true,
    wind: { from: 230, speed: 2, gust: 1 },
  },
  snow: {
    label: 'NIEVE', bg: 'overcast', bgInt: 1,
    fog: '#cfd8dc', fogNear: 300, fogFar: 5200,
    sunColor: '#eaf1f5', sunIntensity: 0.85, hemiSky: '#dbe8f2', hemiGround: '#60625c', hemiIntensity: 1.35,
    seaDeep: '#3f6570', seaShallow: '#83a8aa', seaSky: '#cfd8dc', seaFog: '#cfd8dc', seaFogNear: 200, seaFogFar: 5000,
    rain: false, snow: true, snowGround: 0.85, lightning: false, env: 0.4, landingLight: true,
    wind: { from: 280, speed: 5, gust: 2 },
  },
  night: {
    label: 'NOCHE', bg: 'night', bgInt: 1,
    fog: '#0a141c', fogNear: 1600, fogFar: 12000,
    sunColor: '#9bb8d8', sunIntensity: 0.18, hemiSky: '#24384d', hemiGround: '#0a0f12', hemiIntensity: 0.32,
    seaDeep: '#06161f', seaShallow: '#163640', seaSky: '#1d3040', seaFog: '#0a141c', seaFogNear: 700, seaFogFar: 9000,
    rain: false, snow: false, snowGround: 0, lightning: false, env: 0.15, landingLight: true,
    wind: { from: 260, speed: 2, gust: 1 },
  },
};

function canvas(size, height) {
  const c = document.createElement('canvas');
  c.width = size; c.height = height;
  return { c, g: c.getContext('2d') };
}

function skyBackdrop(kind) {
  const { c, g } = canvas(2048, 1024);
  if (kind === 'night') {
    const grad = g.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#02060f');
    grad.addColorStop(0.55, '#0a1826');
    grad.addColorStop(0.72, '#172a3a');
    grad.addColorStop(1, '#0a1218');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2048, 1024);
    const random = createRandom(8842);
    for (let i = 0; i < 520; i += 1) {
      const x = random() * 2048;
      const y = random() * 640;
      const a = 0.25 + random() * 0.75;
      g.fillStyle = `rgba(220,235,255,${a})`;
      g.fillRect(x, y, 1 + random() * 1.8, 1 + random() * 1.8);
    }
    const mx = 1380; const my = 300;
    const glow = g.createRadialGradient(mx, my, 4, mx, my, 90);
    glow.addColorStop(0, 'rgba(230,240,255,0.9)');
    glow.addColorStop(0.2, 'rgba(210,225,250,0.35)');
    glow.addColorStop(1, 'rgba(180,200,240,0)');
    g.fillStyle = glow;
    g.fillRect(mx - 100, my - 100, 200, 200);
    g.fillStyle = '#e9f1ff';
    g.beginPath(); g.arc(mx, my, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(180,200,225,0.6)';
    g.beginPath(); g.arc(mx - 7, my - 4, 5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(mx + 8, my + 7, 3, 0, Math.PI * 2); g.fill();
  } else if (kind === 'sunset') {
    const grad = g.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#1c2842');
    grad.addColorStop(0.3, '#3e4b68');
    grad.addColorStop(0.5, '#b5675c');
    grad.addColorStop(0.6, '#f28b52');
    grad.addColorStop(0.68, '#ffc178');
    grad.addColorStop(0.78, '#e99a68');
    grad.addColorStop(1, '#432f34');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2048, 1024);
    const sx = 1080; const sy = 610;
    const glow = g.createRadialGradient(sx, sy, 4, sx, sy, 210);
    glow.addColorStop(0, 'rgba(255,244,210,0.95)');
    glow.addColorStop(0.18, 'rgba(255,198,120,0.6)');
    glow.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = glow;
    g.fillRect(sx - 220, sy - 220, 440, 440);
    g.fillStyle = '#fff2c9';
    g.beginPath(); g.arc(sx, sy, 30, 0, Math.PI * 2); g.fill();
    const random = createRandom(7719);
    for (let i = 0; i < 26; i += 1) {
      const x = random() * 2048;
      const y = 420 + random() * 240;
      const w = 240 + random() * 620;
      const h = 12 + random() * 36;
      const band = g.createRadialGradient(x, y, 2, x, y, w * 0.5);
      band.addColorStop(0, `rgba(255,190,150,${0.1 + random() * 0.13})`);
      band.addColorStop(1, 'rgba(255,150,110,0)');
      g.fillStyle = band;
      g.save(); g.translate(x, y); g.scale(1, h / (w * 0.5)); g.beginPath(); g.arc(0, 0, w * 0.5, 0, Math.PI * 2); g.fill(); g.restore();
    }
    for (let i = 0; i < 55; i += 1) {
      const x = random() * 2048;
      const y = 90 + random() * 470;
      const r = 70 + random() * 260;
      const cloud = g.createRadialGradient(x, y, 3, x, y, r);
      cloud.addColorStop(0, `rgba(255,188,142,${0.1 + random() * 0.14})`);
      cloud.addColorStop(1, 'rgba(255,150,110,0)');
      g.fillStyle = cloud;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  } else if (kind === 'fog') {
    const grad = g.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#aab8be');
    grad.addColorStop(0.55, '#c7d1d4');
    grad.addColorStop(0.75, '#d8dfe0');
    grad.addColorStop(1, '#d8dfe0');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2048, 1024);
  } else {
    const grad = g.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#84939b');
    grad.addColorStop(0.45, '#b8c3c6');
    grad.addColorStop(0.72, '#d3dadb');
    grad.addColorStop(1, '#d3dadb');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2048, 1024);
    const random = createRandom(3311);
    for (let i = 0; i < 90; i += 1) {
      const x = random() * 2048;
      const y = 120 + random() * 420;
      const r = 60 + random() * 220;
      const grd = g.createRadialGradient(x, y, 2, x, y, r);
      grd.addColorStop(0, `rgba(220,226,228,${0.18 + random() * 0.15})`);
      grd.addColorStop(1, 'rgba(200,210,214,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function rainSystem() {
  const random = createRandom(5150);
  const count = 520;
  const positions = new Float32Array(count * 6);
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    seeds.push({ x: (random() - 0.5) * 220, y: random() * 110, z: (random() - 0.5) * 220, len: 1.6 + random() * 2.6 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: '#b9d0d6', transparent: true, opacity: 0.42, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  return { lines, seeds, positions, geo, count };
}

function snowSystem() {
  const random = createRandom(9101);
  const count = 1200;
  const positions = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    seeds.push({ x: (random() - 0.5) * 260, y: random() * 120, z: (random() - 0.5) * 260, speed: 2 + random() * 4 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({ map: tex, color: '#ffffff', size: 1.4, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return { points, seeds, positions, geo, count };
}

export function createWeather({ scene, sky, sea }) {
  const rain = rainSystem();
  const snow = snowSystem();
  scene.add(rain.lines, snow.points);
  const backdrops = { overcast: skyBackdrop('overcast'), fog: skyBackdrop('fog'), night: skyBackdrop('night'), sunset: skyBackdrop('sunset') };
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = 128; sunCanvas.height = 128;
  const sg = sunCanvas.getContext('2d');
  const sunGrad = sg.createRadialGradient(64, 64, 2, 64, 64, 64);
  sunGrad.addColorStop(0, 'rgba(255,250,225,1)');
  sunGrad.addColorStop(0.18, 'rgba(255,228,165,0.85)');
  sunGrad.addColorStop(0.55, 'rgba(255,180,95,0.22)');
  sunGrad.addColorStop(1, 'rgba(255,150,70,0)');
  sg.fillStyle = sunGrad; sg.fillRect(0, 0, 128, 128);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sunCanvas), color: '#ffe9c2', transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0.45,
  }));
  sunSprite.scale.setScalar(1900);
  sunSprite.visible = false;
  sunSprite.renderOrder = 3;
  scene.add(sunSprite);

  // Sunset cloud bank: soft billboards on a ring so the sky has depth instead of a clean gradient.
  function cloudTexture(seed) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    const random = createRandom(seed);
    // Underside first: cool shadow, then warm lit tops, so the bank reads as volume.
    for (let i = 0; i < 22; i += 1) {
      const x = 24 + random() * 208;
      const y = 62 + random() * 34;
      const r = 18 + random() * 40;
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, `rgba(126,92,104,${0.30 + random() * 0.22})`);
      grad.addColorStop(1, 'rgba(126,92,104,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 26; i += 1) {
      const x = 22 + random() * 212;
      const y = 38 + random() * 38;
      const r = 16 + random() * 38;
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, `rgba(255,228,206,${0.55 + random() * 0.3})`);
      grad.addColorStop(0.6, `rgba(255,205,178,${0.3 + random() * 0.18})`);
      grad.addColorStop(1, 'rgba(255,190,160,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Feather the canvas edges so a sprite never shows its square boundary.
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createRadialGradient(128, 64, 20, 128, 64, 120);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.72, 'rgba(0,0,0,0.85)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, 256, 128);
    g.globalCompositeOperation = 'source-over';
    return new THREE.CanvasTexture(c);
  }
  const cloudTextures = [cloudTexture(881), cloudTexture(1723), cloudTexture(3301)];
  const cloudGroup = new THREE.Group();
  cloudGroup.visible = false;
  const randomCloud = createRandom(5511);
  for (let i = 0; i < 22; i += 1) {
    const a = (i / 22) * Math.PI * 2 + randomCloud() * 0.24;
    const r = 6200 + randomCloud() * 3600;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTextures[i % 3], color: i % 4 === 0 ? '#ffcdb2' : '#f6bda4',
      transparent: true, depthWrite: false, fog: false,
      opacity: 0.4 + randomCloud() * 0.26,
    }));
    sprite.position.set(-2500 + Math.sin(a) * r, 900 + randomCloud() * 1700, 700 + Math.cos(a) * r);
    sprite.scale.set(3200 + randomCloud() * 3800, 700 + randomCloud() * 700, 1);
    sprite.renderOrder = 2;
    cloudGroup.add(sprite);
  }
  scene.add(cloudGroup);
  const sun = sky.userData.sun;
  const hemi = sky.userData.hemi;
  const dome = sky.children[0];
  const seaUniforms = sea.userData.uniforms;
  let kind = 'sunny';
  let preset = PRESETS.sunny;
  let flash = 0;
  const terrainSnow = scene.getObjectByName('cinder-coast-terrain')?.userData.snowUniform;

  function apply(p) {
    const az = ((p.sunAzimuth ?? 74) * Math.PI) / 180;
    const el = ((p.sunElevation ?? 26) * Math.PI) / 180;
    sky.userData.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
    seaUniforms.uSun.value.copy(sky.userData.sunDir);
    const lakeMesh = scene.getObjectByName('caldera-lake');
    if (lakeMesh?.userData.uniforms) lakeMesh.userData.uniforms.uSun.value.copy(sky.userData.sunDir);
    sunSprite.position.copy(sky.userData.sunDir).multiplyScalar(22000);
    sunSprite.visible = p.bg === 'sunset';
    cloudGroup.visible = p.bg === 'sunset' || p.bg === 'overcast';
    scene.fog.color.set(p.fog);
    scene.fog.near = p.fogNear;
    scene.fog.far = p.fogFar;
    dome.material.uniforms.uZenith.value.set(p.zenith ?? '#2e6a94');
    dome.material.uniforms.uHorizon.value.set(p.horizon ?? '#f7c795');
    dome.material.uniforms.uLow.value.set(p.low ?? '#e7a273');
    dome.material.uniforms.uSunColor.value.set(p.sunColor);
    sun.color.set(p.sunColor);
    sun.intensity = p.sunIntensity;
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
    seaUniforms.uDeep.value.set(p.seaDeep);
    seaUniforms.uShallow.value.set(p.seaShallow);
    seaUniforms.uSky.value.set(p.seaSky);
    seaUniforms.uFogColor.value.set(p.seaFog);
    seaUniforms.uFogNear.value = p.seaFogNear;
    seaUniforms.uFogFar.value = p.seaFogFar;
    const envMap = p.envKind === 'sunset' ? scene.userData.envSunset : scene.userData.envDay;
    if (envMap) scene.environment = envMap;
    scene.environmentIntensity = p.env;
    if (terrainSnow) terrainSnow.value = p.snowGround;
    const fields = scene.getObjectByName('cinder-coast-fields');
    if (fields) fields.visible = p.snowGround < 0.4;
    const landing = scene.getObjectByName('petrel-landing-light');
    if (landing) landing.visible = p.landingLight;
  }

  function setBackground(p) {
    const photo = scene.userData.clearBackground;
    let tex = null;
    if (p.bg === 'photo' && photo) tex = photo;
    else if (p.bg === 'overcast') tex = backdrops.overcast;
    else if (p.bg === 'fog') tex = backdrops.fog;
    else if (p.bg === 'night') tex = backdrops.night;
    else if (p.bg === 'sunset') tex = backdrops.sunset;
    if (tex) {
      scene.background = tex;
      scene.backgroundBlurriness = p.bgBlur ?? 0;
      scene.backgroundIntensity = p.bgInt;
    } else if (photo) {
      scene.background = photo;
      scene.backgroundIntensity = p.bgInt;
    } else {
      scene.background = new THREE.Color(p.fog);
      scene.backgroundIntensity = 1;
    }
  }

  function set(next) {
    const name = next === 'clear' ? 'sunny' : next === 'auto' ? 'sunny' : next;
    kind = PRESETS[name] ? name : 'sunny';
    preset = PRESETS[kind];
    apply(preset);
    setBackground(preset);
    rain.lines.visible = preset.rain;
    snow.points.visible = preset.snow;
    if (preset.lightning) flash = 4 + Math.random() * 6;
  }

  function refreshBackground() {
    if (preset) setBackground(preset);
  }

  function update(dt, camera, flight) {
    if (preset.rain) {
      const pos = rain.positions;
      for (let i = 0; i < rain.count; i += 1) {
        const s = rain.seeds[i];
        s.y -= dt * (34 + (i % 9));
        s.x += dt * -14;
        s.z += dt * 5;
        if (s.y < -12) { s.y += 110; s.x = (Math.random() - 0.5) * 220; s.z = (Math.random() - 0.5) * 220; }
        const x = camera.position.x + s.x;
        const y = camera.position.y + s.y - 55;
        const z = camera.position.z + s.z;
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x + 0.6; pos[i * 6 + 4] = y + s.len; pos[i * 6 + 5] = z + 0.25;
      }
      rain.geo.attributes.position.needsUpdate = true;
    }
    if (preset.snow) {
      const pos = snow.positions;
      for (let i = 0; i < snow.count; i += 1) {
        const s = snow.seeds[i];
        s.y -= dt * s.speed;
        s.x += dt * 2.4;
        s.z += dt * 0.8;
        if (s.y < -18) { s.y += 120; s.x = (Math.random() - 0.5) * 260; s.z = (Math.random() - 0.5) * 260; }
        pos[i * 3] = camera.position.x + s.x;
        pos[i * 3 + 1] = camera.position.y + s.y - 58;
        pos[i * 3 + 2] = camera.position.z + s.z;
      }
      snow.geo.attributes.position.needsUpdate = true;
    }
    if (preset.lightning) {
      flash -= dt;
      if (flash <= 0) {
        flash = 7 + Math.random() * 9;
        sun.intensity = 2.0;
        hemi.intensity = 1.5;
        setTimeout(() => {
          if (kind === 'storm') {
            sun.intensity = PRESETS.storm.sunIntensity;
            hemi.intensity = PRESETS.storm.hemiIntensity;
          }
        }, 90);
      }
    }
  }

  set('sunny');
  return {
    set, update, refreshBackground,
    get kind() { return kind; },
    get label() { return preset.label; },
    get wind() { return preset.wind; },
  };
}

export function windVector(wind, time = 0) {
  if (!wind) return new THREE.Vector3();
  const to = (wind.from + 180) * (Math.PI / 180);
  const gust = Math.sin(time * 0.9) * (wind.gust ?? 0) + Math.sin(time * 2.3 + 1.7) * (wind.gust ?? 0) * 0.35;
  const speed = Math.max(0, wind.speed + gust);
  return new THREE.Vector3(Math.sin(to) * speed, 0, -Math.cos(to) * speed);
}
