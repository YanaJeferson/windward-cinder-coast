// A small Radiance RGBE (.hdr) reader, so the game can use a real HDRI environment without a
// heavyweight loader. Enough of the format for equirectangular sky captures.
import * as THREE from '../../vendor/three.module.min.js';

function readLine(bytes, state) {
  let s = '';
  while (state.p < bytes.length && bytes[state.p] !== 10) {
    s += String.fromCharCode(bytes[state.p]);
    state.p += 1;
  }
  state.p += 1;
  return s;
}

export async function loadHDR(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HDR ${url}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const state = { p: 0 };
  let line = readLine(bytes, state);
  if (!line.startsWith('#?')) throw new Error('not a Radiance HDR');
  while (line !== '') line = readLine(bytes, state);
  const resLine = readLine(bytes, state);
  const match = /^[-+]Y (\d+) [+-]X (\d+)$/.exec(resLine);
  if (!match) throw new Error(`unsupported HDR orientation: ${resLine}`);
  const height = Number(match[1]);
  const width = Number(match[2]);
  const data = new Float32Array(width * height * 4);
  let p = state.p;
  for (let y = 0; y < height; y += 1) {
    if (bytes[p] === 2 && bytes[p + 1] === 2 && ((bytes[p + 2] << 8) | bytes[p + 3]) === width) {
      p += 4;
      const channel = new Uint8Array(width);
      for (let c = 0; c < 4; c += 1) {
        let x = 0;
        while (x < width) {
          let count = bytes[p++];
          if (count > 128) {
            count -= 128;
            const value = bytes[p++];
            for (let i = 0; i < count; i += 1) channel[x++] = value;
          } else {
            for (let i = 0; i < count; i += 1) channel[x++] = bytes[p++];
          }
        }
        for (let x2 = 0; x2 < width; x2 += 1) data[(y * width + x2) * 4 + c] = channel[x2];
      }
    } else {
      for (let x = 0; x < width; x += 1) {
        for (let c = 0; c < 4; c += 1) data[(y * width + x) * 4 + c] = bytes[p++];
      }
    }
  }
  for (let i = 0; i < data.length; i += 4) {
    const e = data[i + 3];
    if (e === 0) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 1;
    } else {
      const f = Math.pow(2, e - 136);
      data[i] *= f; data[i + 1] *= f; data[i + 2] *= f; data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

export async function environmentFromHDR(renderer, url) {
  const hdr = await loadHDR(url);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(hdr).texture;
  pmrem.dispose();
  hdr.dispose();
  return env;
}
