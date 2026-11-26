// The Cinder Sea: a single shader plane with slow swell, a turquoise shelf and a warm sun path.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, PALETTE } from '../config.js';

export function createSea() {
  const geo = new THREE.PlaneGeometry(36000, 36000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const sun = new THREE.Vector3(
    Math.cos(THREE.MathUtils.degToRad(WORLD.sun.elevation)) * Math.sin(THREE.MathUtils.degToRad(WORLD.sun.azimuth)),
    Math.sin(THREE.MathUtils.degToRad(WORLD.sun.elevation)),
    -Math.cos(THREE.MathUtils.degToRad(WORLD.sun.elevation)) * Math.cos(THREE.MathUtils.degToRad(WORLD.sun.azimuth)),
  ).normalize();

  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: sun },
    uDeep: { value: new THREE.Color('#1e7084') },
    uShallow: { value: new THREE.Color('#63c5ba') },
    uSky: { value: new THREE.Color('#c9d5da') },
    uSunColor: { value: new THREE.Color('#ffd9a0') },
    uFogColor: { value: new THREE.Color('#c9d5da') },
    uFogNear: { value: 900 },
    uFogFar: { value: 16000 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSun;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorld;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 n = normalize(vec3(
          sin(vWorld.x * 0.021 + uTime * 0.55) * 0.055 + sin(vWorld.z * 0.017 - uTime * 0.42) * 0.045,
          1.0,
          cos(vWorld.z * 0.019 + uTime * 0.37) * 0.05 + cos(vWorld.x * 0.013 - uTime * 0.31) * 0.04
        ));
        float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.4);
        float shimmer = pow(max(dot(reflect(-viewDir, n), uSun), 0.0), 90.0);
        float glitter = smoothstep(0.72, 1.0, noise(vWorld.xz * 0.42 + uTime * 2.1)) * shimmer;
        float shelf = smoothstep(4600.0, 700.0, length(vWorld.xz - vec2(150.0, 400.0)));
        float chop = smoothstep(0.55, 0.9, noise(vWorld.xz * 0.05 + uTime * 0.9));
        vec3 col = mix(uDeep, uShallow, shelf * 0.8 + fres * 0.25);
        col = mix(col, uSky, fres * 0.58);
        col += vec3(0.05, 0.08, 0.07) * chop * (0.25 + fres * 0.5);
        col += uSunColor * (shimmer * 0.7 + glitter * 1.3);
        float dist = length(vWorld.xz - cameraPosition.xz);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist) * 0.9);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'cinder-sea';
  mesh.position.y = WORLD.seaLevel - 0.6;
  mesh.receiveShadow = false;
  mesh.userData.uniforms = uniforms;
  return mesh;
}
