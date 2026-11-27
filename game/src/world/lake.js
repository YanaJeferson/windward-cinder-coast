// The caldera lake: a still, reflective sheet inside the old volcano, warm at sunset and cold at
// night. It uses its own small shader rather than the ocean's depth map.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../config.js';
import { LAKE } from './terrain.js';
import { sunDirection } from './sky.js';

export function createLake() {
  const geo = new THREE.PlaneGeometry(2300, 1950);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: sunDirection() },
    uDeep: { value: new THREE.Color('#1b4b5e') },
    uShallow: { value: new THREE.Color('#5aa9aa') },
    uSky: { value: new THREE.Color('#ffb47a') },
    uSunColor: { value: new THREE.Color('#ffd6a0') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSun, uDeep, uShallow, uSky, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vec3(
          sin(vWorld.x * 0.05 + uTime * 0.35) * 0.035 + sin(vWorld.z * 0.08 - uTime * 0.27) * 0.025,
          1.0,
          cos(vWorld.z * 0.045 + uTime * 0.3) * 0.035
        ));
        float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.2);
        float shimmer = pow(max(dot(reflect(-viewDir, n), uSun), 0.0), 110.0);
        float ripple = smoothstep(0.6, 0.9, noise(vWorld.xz * 0.08 + uTime * 0.8)) * shimmer;
        vec3 col = mix(uDeep, uShallow, 0.42 + fres * 0.18);
        col = mix(col, uSky, fres * 0.72);
        col += uSunColor * (shimmer * 0.38 + ripple * 0.65);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(LAKE.x, LAKE.level, LAKE.z);
  mesh.name = 'caldera-lake';
  mesh.userData.uniforms = uniforms;
  return mesh;
}
