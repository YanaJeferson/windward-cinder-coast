// Camera work: a chase seat that trails the wing with weight, a cockpit that is bolted to the
// airframe, and a slow orbit used behind the title and the mission board.
import * as THREE from '../../vendor/three.module.min.js';
import { clamp, damp } from '../util/math.js';

export function createCameraRig(camera) {
  const UP = new THREE.Vector3(0, 1, 0);
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const local = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const shake = new THREE.Vector3();
  let mode = 'chase';
  let current = new THREE.Vector3();
  let currentLook = new THREE.Vector3();
  let currentUp = new THREE.Vector3(0, 1, 0);
  let orbit = 0;
  let shakeAmount = 0;

  function snap(flight) {
    mode = 'chase';
    local.set(5.4, 4.6, 16.6).applyQuaternion(flight.quaternion);
    current.copy(flight.position).add(local);
    fwd.set(0, 0, -1).applyQuaternion(flight.quaternion);
    currentLook.copy(flight.position).addScaledVector(fwd, 46);
    currentLook.y += 1.8;
    currentUp.set(0, 1, 0).applyQuaternion(flight.quaternion);
    camera.position.copy(current);
    camera.up.copy(UP);
    camera.lookAt(currentLook);
  }

  function setMode(next) {
    mode = next;
  }

  function update(flight, dt, time) {
    fwd.set(0, 0, -1).applyQuaternion(flight.quaternion);
    up.set(0, 1, 0).applyQuaternion(flight.quaternion);

    if (mode === 'cockpit') {
      local.set(0.3, 1.13, -0.38).applyQuaternion(flight.quaternion);
      desired.copy(flight.position).add(local);
      camera.position.copy(desired);
      const target = flight.position.clone().addScaledVector(fwd, 26);
      target.y -= 0.7;
      camera.up.copy(up);
      camera.lookAt(target);
      camera.fov = damp(camera.fov, 68, 5, dt);
      camera.updateProjectionMatrix();
      return;
    }

    if (mode === 'title') {
      local.set(-16, 7, 30).applyQuaternion(flight.quaternion);
      desired.copy(flight.position).add(local);
      camera.position.copy(desired);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(flight.quaternion);
      look.copy(flight.position).addScaledVector(fwd, 130).addScaledVector(right, 18);
      look.y += 3;
      camera.up.copy(UP);
      camera.lookAt(look);
      camera.fov = 55;
      camera.updateProjectionMatrix();
      return;
    }

    if (mode === 'wing') {
      local.set(6.9, 1.0, 0.55).applyQuaternion(flight.quaternion);
      desired.copy(flight.position).add(local);
      camera.position.copy(desired);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(flight.quaternion);
      const target = flight.position.clone().addScaledVector(fwd, 30).addScaledVector(right, 3.6);
      target.y += 0.3;
      camera.up.copy(up);
      camera.lookAt(target);
      camera.fov = damp(camera.fov, 66, 6, dt);
      camera.updateProjectionMatrix();
      return;
    }

    if (mode === 'orbit') {
      orbit += dt * 0.09;
      const radius = 34;
      const height = 8 + Math.sin(orbit * 0.7) * 1.6;
      desired.set(
        flight.position.x + Math.cos(orbit) * radius,
        flight.position.y + height,
        flight.position.z + Math.sin(orbit) * radius,
      );
      if (camera.position.distanceTo(desired) > 120) camera.position.copy(desired);
      else camera.position.lerp(desired, 1 - Math.exp(-2.4 * dt));
      look.copy(flight.position);
      look.y += 0.6;
      camera.up.copy(UP);
      camera.lookAt(look);
      camera.fov = damp(camera.fov, 46, 2, dt);
      camera.updateProjectionMatrix();
      return;
    }

    if (mode === 'hero') {
      local.set(12.5, 6.4, 23).applyQuaternion(flight.quaternion);
      desired.copy(flight.position).add(local);
      current.copy(desired);
      fwd.set(0, 0, -1).applyQuaternion(flight.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(flight.quaternion);
      look.copy(flight.position).addScaledVector(fwd, 76).addScaledVector(right, 11);
      look.y += 3;
      camera.position.copy(current);
      camera.up.copy(UP);
      camera.lookAt(look);
      camera.fov = 58;
      camera.updateProjectionMatrix();
      return;
    }

    // Chase: behind and above, offset to the wing so the airframe reads in profile.
    local.set(5.4, 4.6, 16.6).applyQuaternion(flight.quaternion);
    desired.copy(flight.position).add(local);
    current.x = damp(current.x, desired.x, 3.4, dt);
    current.y = damp(current.y, desired.y, 2.6, dt);
    current.z = damp(current.z, desired.z, 3.4, dt);

    look.copy(flight.position).addScaledVector(fwd, 52);
    look.y += 2.2;
    currentLook.x = damp(currentLook.x, look.x, 4.2, dt);
    currentLook.y = damp(currentLook.y, look.y, 3.8, dt);
    currentLook.z = damp(currentLook.z, look.z, 4.2, dt);

    currentUp.lerp(up, 1 - Math.exp(-2.2 * dt)).normalize();
    camera.position.copy(current);
    camera.up.copy(currentUp);
    camera.lookAt(currentLook);

    // Speed and load breathe through the lens.
    const speedFov = 58 + clamp((flight.speed - 40) / 55, 0, 1) * 7;
    camera.fov = damp(camera.fov, speedFov, 3, dt);
    const targetShake = flight.stall ? 0.035 : flight.overspeed ? 0.02 : 0.004 + Math.min(flight.gLoad, 3) * 0.0015;
    shakeAmount = damp(shakeAmount, targetShake, 4, dt);
    shake.set(
      Math.sin(time * 8.1) * shakeAmount,
      Math.sin(time * 11.3 + 1.7) * shakeAmount * 0.7,
      Math.sin(time * 6.7 + 0.6) * shakeAmount * 0.4,
    );
    camera.position.add(shake);
    camera.updateProjectionMatrix();
  }

  return { snap, setMode, update, get mode() { return mode; } };
}
