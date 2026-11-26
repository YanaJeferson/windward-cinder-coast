// Crash and touchdown effects: a fireball, smoke, debris, a ground scar and tyre dust. Everything
// is generated here; no particle texture files.
import * as THREE from '../../vendor/three.module.min.js';

function radial(size, stops) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) grd.addColorStop(at, color);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCrashEffects(scene) {
  const group = new THREE.Group();
  group.name = 'crash-effects';
  scene.add(group);
  const fireTex = radial(128, [[0, 'rgba(255,250,210,1)'], [0.3, 'rgba(255,190,80,0.9)'], [0.7, 'rgba(255,90,30,0.45)'], [1, 'rgba(255,60,0,0)']]);
  const smokeTex = radial(128, [[0, 'rgba(60,56,52,0.7)'], [0.55, 'rgba(70,66,62,0.35)'], [1, 'rgba(70,66,62,0)']]);
  const dustTex = radial(128, [[0, 'rgba(190,170,130,0.7)'], [0.6, 'rgba(170,150,110,0.3)'], [1, 'rgba(160,140,100,0)']]);
  const debrisGeo = new THREE.BoxGeometry(0.5, 0.4, 0.7);
  const debrisMat = new THREE.MeshStandardMaterial({ color: '#2b2420', roughness: 0.9, metalness: 0.3 });
  const parts = [];
  const scars = [];
  let flash = null;
  let flashLife = 0;

  function addSprite(tex, position, velocity, scale, life, color, additive = true) {
    const mat = new THREE.SpriteMaterial({
      map: tex, color, transparent: true, opacity: 0.9,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.setScalar(scale);
    group.add(sprite);
    parts.push({ sprite, velocity, life, maxLife: life, type: 'sprite', grow: 1 });
  }

  function burst(position, groundY) {
    for (let i = 0; i < 34; i += 1) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 46, Math.random() * 30 + 4, (Math.random() - 0.5) * 46);
      addSprite(fireTex, position, v, 3 + Math.random() * 7, 0.5 + Math.random() * 0.9, i % 3 ? '#ffb347' : '#ff6a2e');
    }
    for (let i = 0; i < 30; i += 1) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 14, 3 + Math.random() * 12, (Math.random() - 0.5) * 14);
      addSprite(smokeTex, position, v, 5 + Math.random() * 10, 1.6 + Math.random() * 2.2, '#6d6862', false);
    }
    for (let i = 0; i < 16; i += 1) {
      const mesh = new THREE.Mesh(debrisGeo, debrisMat);
      mesh.position.copy(position);
      mesh.scale.setScalar(0.4 + Math.random() * 0.9);
      group.add(mesh);
      parts.push({
        sprite: mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 34, 8 + Math.random() * 18, (Math.random() - 0.5) * 34),
        life: 2.2, maxLife: 2.2, type: 'debris', grow: 0,
      });
    }
    flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fireTex, color: '#fff3cf', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flash.position.copy(position);
    flash.scale.setScalar(8);
    group.add(flash);
    flashLife = 0.35;

    const scar = new THREE.Mesh(
      new THREE.CircleGeometry(9, 20),
      new THREE.MeshBasicMaterial({ color: '#1a1510', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    scar.rotation.x = -Math.PI / 2;
    scar.position.set(position.x, groundY + 0.07, position.z);
    group.add(scar);
    scars.push({ mesh: scar, life: 18 });
  }

  function dust(position) {
    for (let i = 0; i < 12; i += 1) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 12, 1 + Math.random() * 4, (Math.random() - 0.5) * 12);
      addSprite(dustTex, position, v, 2 + Math.random() * 4, 0.8 + Math.random() * 1.2, '#b9a27c', false);
    }
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life -= dt;
      p.sprite.position.addScaledVector(p.velocity, dt);
      if (p.type === 'debris') {
        p.velocity.y -= 19 * dt;
        p.sprite.rotation.x += dt * 4;
        p.sprite.rotation.z += dt * 3;
      } else {
        p.velocity.y -= 4 * dt;
        p.sprite.material.opacity = Math.max(0, p.life / p.maxLife) * 0.85;
        p.sprite.scale.multiplyScalar(1 + dt * 0.9);
      }
      if (p.life <= 0) {
        group.remove(p.sprite);
        if (p.sprite.material) p.sprite.material.dispose();
        parts.splice(i, 1);
      }
    }
    if (flash) {
      flashLife -= dt;
      flash.material.opacity = Math.max(0, flashLife / 0.35);
      flash.scale.multiplyScalar(1 + dt * 6);
      if (flashLife <= 0) {
        group.remove(flash);
        flash.material.dispose();
        flash = null;
      }
    }
    for (let i = scars.length - 1; i >= 0; i -= 1) {
      scars[i].life -= dt;
      scars[i].mesh.material.opacity = Math.min(0.5, scars[i].life / 6);
      if (scars[i].life <= 0) {
        group.remove(scars[i].mesh);
        scars[i].mesh.material.dispose();
        scars.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const p of parts) {
      group.remove(p.sprite);
      if (p.sprite.material) p.sprite.material.dispose();
    }
    parts.length = 0;
    for (const s of scars) {
      group.remove(s.mesh);
      s.mesh.material.dispose();
    }
    scars.length = 0;
    if (flash) { group.remove(flash); flash.material.dispose(); flash = null; }
  }

  return { burst, dust, update, clear };
}
