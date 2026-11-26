// Weather over the Cinder Coast: a clear golden afternoon, or the front that turns the sea grey
// and throws rain across the windshield. Rain is a ring of line segments carried with the camera.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../config.js';
import { createRandom } from '../util/math.js';

const CLEAR = {
  fog: '#e9c49c',
  fogNear: 5000,
  fogFar: 17000,
  zenith: '#3a7090',
  horizon: '#f7c795',
  low: '#e7a273',
  sunColor: '#ffe9c6',
  sunLight: '#ffd9a8',
  sunIntensity: 2.9,
  hemiSky: '#ffd5ac',
  hemiGround: '#4d4034',
  hemiIntensity: 1.75,
  seaDeep: '#1e7084',
  seaShallow: '#63c5ba',
  seaSky: '#efcf9f',
  seaFog: '#ecc59c',
  seaFogNear: 900,
  seaFogFar: 16000,
};

const STORM = {
  fog: '#7e878b',
  fogNear: 500,
  fogFar: 5400,
  zenith: '#2e3a41',
  horizon: '#8c8f8d',
  low: '#565d5f',
  sunColor: '#b9bdb6',
  sunLight: '#b9c6cc',
  sunIntensity: 0.55,
  hemiSky: '#839197',
  hemiGround: '#343a38',
  hemiIntensity: 0.95,
  seaDeep: '#24434a',
  seaShallow: '#4d6f70',
  seaSky: '#7e898b',
  seaFog: '#7a8488',
  seaFogNear: 250,
  seaFogFar: 6000,
};

function rainSystem() {
  const random = createRandom(5150);
  const count = 520;
  const positions = new Float32Array(count * 6);
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    seeds.push({
      x: (random() - 0.5) * 220,
      y: random() * 110,
      z: (random() - 0.5) * 220,
      len: 1.6 + random() * 2.6,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: '#b9d0d6', transparent: true, opacity: 0.42, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.name = 'storm-rain';
  lines.visible = false;
  return { lines, seeds, positions, geo, count };
}

export function createWeather({ scene, sky, sea }) {
  const rain = rainSystem();
  scene.add(rain.lines);
  const sun = sky.userData.sun;
  const hemi = sky.userData.hemi;
  const dome = sky.children[0];
  const seaUniforms = sea.userData.uniforms;
  let kind = 'clear';
  let flash = 0;

  function apply(preset) {
    scene.fog.color.set(preset.fog);
    scene.fog.near = preset.fogNear;
    scene.fog.far = preset.fogFar;
    scene.background.set(preset.fog);
    dome.material.uniforms.uZenith.value.set(preset.zenith);
    dome.material.uniforms.uHorizon.value.set(preset.horizon);
    dome.material.uniforms.uLow.value.set(preset.low);
    dome.material.uniforms.uSunColor.value.set(preset.sunColor);
    sun.color.set(preset.sunLight);
    sun.intensity = preset.sunIntensity;
    hemi.color.set(preset.hemiSky);
    hemi.groundColor.set(preset.hemiGround);
    hemi.intensity = preset.hemiIntensity;
    seaUniforms.uDeep.value.set(preset.seaDeep);
    seaUniforms.uShallow.value.set(preset.seaShallow);
    seaUniforms.uSky.value.set(preset.seaSky);
    seaUniforms.uFogColor.value.set(preset.seaFog);
    seaUniforms.uFogNear.value = preset.seaFogNear;
    seaUniforms.uFogFar.value = preset.seaFogFar;
  }

  function set(next) {
    kind = next === 'storm' ? 'storm' : 'clear';
    apply(kind === 'storm' ? STORM : CLEAR);
    rain.lines.visible = kind === 'storm';
    if (kind === 'storm') flash = 4 + Math.random() * 6;
  }

  function update(dt, camera, flight) {
    if (kind !== 'storm') return;
    const pos = rain.positions;
    const windX = -14;
    const windZ = 5;
    for (let i = 0; i < rain.count; i += 1) {
      const s = rain.seeds[i];
      s.y -= dt * (34 + i % 9);
      s.x += dt * windX;
      s.z += dt * windZ;
      if (s.y < -12) {
        s.y += 110;
        s.x = (Math.random() - 0.5) * 220;
        s.z = (Math.random() - 0.5) * 220;
      }
      const x = camera.position.x + s.x;
      const y = camera.position.y + s.y - 55;
      const z = camera.position.z + s.z;
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + 0.6;
      pos[i * 6 + 4] = y + s.len;
      pos[i * 6 + 5] = z + 0.25;
    }
    rain.geo.attributes.position.needsUpdate = true;

    // A lightning flash every so often, kept soft so it reads as weather, not a strobe.
    flash -= dt;
    if (flash <= 0) {
      flash = 7 + Math.random() * 9;
      sun.intensity = 2.2;
      hemi.intensity = 1.6;
      setTimeout(() => {
        if (kind === 'storm') {
          sun.intensity = STORM.sunIntensity;
          hemi.intensity = STORM.hemiIntensity;
        }
      }, 90);
    }
  }

  set('clear');
  return { set, update, get kind() { return kind; } };
}

/** Crosswind vector for a mission, in metres per second, blowing toward the reciprocal heading. */
export function windVector(wind, time = 0) {
  if (!wind) return new THREE.Vector3();
  const to = (wind.from + 180) * (Math.PI / 180);
  const gust = Math.sin(time * 0.9) * (wind.gust ?? 0) + Math.sin(time * 2.3 + 1.7) * (wind.gust ?? 0) * 0.35;
  const speed = Math.max(0, wind.speed + gust);
  return new THREE.Vector3(Math.sin(to) * speed, 0, -Math.cos(to) * speed);
}

export const WEATHER_PRESETS = { CLEAR, STORM, WORLD };
