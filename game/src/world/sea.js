// The Cinder Sea: a single shader plane with slow swell, a turquoise shelf and a warm sun path.
import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, PALETTE } from '../config.js';

function waterNormalTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const height = (x, y) => {
    const u = (x / S) * Math.PI * 2;
    const v = (y / S) * Math.PI * 2;
    return Math.sin(u * 3 + Math.sin(v * 2) * 0.8) * 0.5
      + Math.sin(v * 5 - u * 2) * 0.3
      + Math.sin((u + v) * 7) * 0.15;
  };
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      let nx = -dx * 1.8;
      let ny = -dy * 1.8;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * S + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

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
    uDeep: { value: new THREE.Color('#2b8fa3') },
    uShallow: { value: new THREE.Color('#7fd8c8') },
    uSky: { value: new THREE.Color('#cfe4f0') },
    uSunColor: { value: new THREE.Color('#ffd9a0') },
    uFogColor: { value: new THREE.Color('#c9d5da') },
    uFogNear: { value: 900 },
    uFogFar: { value: 16000 },
    uHeight: { value: null },
    uWorldSize: { value: WORLD.size },
    uMinH: { value: -80 },
    uMaxH: { value: 920 },
    uNormal: { value: waterNormalTexture() },
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
      uniform sampler2D uHeight;
      uniform float uWorldSize;
      uniform float uMinH;
      uniform float uMaxH;
      uniform sampler2D uNormal;
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
        vec2 nuv1 = vWorld.xz * 0.0035 + vec2(uTime * 0.004, uTime * 0.0026);
        vec2 nuv2 = vWorld.xz * 0.009 - vec2(uTime * 0.006, uTime * 0.0045);
        vec3 n1 = texture2D(uNormal, nuv1).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, nuv2).xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3((n1.x + n2.x) * 0.22, 1.0, (n1.y + n2.y) * 0.22));
        float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.4);
        float shimmer = pow(max(dot(reflect(-viewDir, n), uSun), 0.0), 90.0);
        float glitter = smoothstep(0.72, 1.0, noise(vWorld.xz * 0.42 + uTime * 2.1)) * shimmer;
        vec2 huv = vWorld.xz / uWorldSize + 0.5;
        float terrainH = texture2D(uHeight, huv).r * (uMaxH - uMinH) + uMinH;
        float depth = max(0.0, -terrainH);
        float shallow = smoothstep(0.0, 22.0, depth);
        vec3 col = mix(uShallow, uDeep, shallow * 0.85 + fres * 0.15);
        col = mix(col, uSky, 0.22 + fres * 0.5);
        float chop = smoothstep(0.55, 0.9, noise(vWorld.xz * 0.05 + uTime * 0.9));
        col += vec3(0.04, 0.07, 0.065) * chop * (0.25 + fres * 0.4);
        float foamNoise = smoothstep(0.42, 0.78, noise(vWorld.xz * 0.22 + uTime * 0.65));
        float foam = smoothstep(5.5, 0.0, depth) * foamNoise;
        col = mix(col, vec3(0.93, 0.97, 0.96), foam * 0.45);
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
