// The Petrel's flight model: a forgiving arcade envelope with energy, bank-to-turn coordination,
// a stall that drops the nose, fuel that matters and a landing you can feel. Fixed-step friendly.
import * as THREE from '../../vendor/three.module.min.js';
import { AIRCRAFT, WORLD } from '../config.js';
import { clamp, damp, smoothstep } from '../util/math.js';
import { sampleHeight } from '../world/terrain.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

export function createFlight(initial = {}) {
  const state = {
    position: new THREE.Vector3(0, 260, 1400),
    quaternion: new THREE.Quaternion(),
    speed: AIRCRAFT.cruiseSpeed,
    throttle: 0.72,
    fuel: AIRCRAFT.fuelCapacity,
    damage: 0,
    gearDown: false,
    flaps: 0,
    onGround: false,
    stopped: false,
    crashed: false,
    stall: false,
    overspeed: false,
    vertical: 0,
    bank: 0,
    heading: 0,
    gLoad: 1,
    assist: true,
    lastY: 0,
    time: 0,
    ...initial,
  };
  state.lastY = state.position.y;
  state.heading = headingOf(state.quaternion);
  if (initial.headingDeg !== undefined) {
    setHeading(state, initial.headingDeg);
    state.heading = initial.headingDeg;
  }

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const rate = { pitch: 0, roll: 0, yaw: 0 };
  const sink = new THREE.Vector3();

  function axes() {
    fwd.set(0, 0, -1).applyQuaternion(state.quaternion);
    right.set(1, 0, 0).applyQuaternion(state.quaternion);
    up.set(0, 1, 0).applyQuaternion(state.quaternion);
    return { fwd, right, up };
  }

  function update(dt, controls, wind = null) {
    if (state.crashed) return;
    state.time += dt;
    const a = axes();
    const speedFactor = clamp(state.speed / AIRCRAFT.cruiseSpeed, 0.25, 1.45);
    const authority = state.onGround ? 0.35 : smoothstep(AIRCRAFT.minSpeed, AIRCRAFT.stallSpeed + 8, state.speed);

    if (state.onGround) {
      updateGround(dt, controls, a);
    } else {
      // Pilot input, smoothed so the aircraft has mass. Past 66 degrees of pitch the elevator
      // loses authority, which keeps the arcade envelope out of a vertical hover.
      const pitchNow = Math.asin(clamp(a.fwd.y, -1, 1));
      let pitchTarget = controls.pitch * AIRCRAFT.pitchRate * (0.6 + speedFactor * 0.6) * authority;
      if (pitchNow > 1.05 && pitchTarget > 0) pitchTarget *= 0.12;
      if (pitchNow < -1.05 && pitchTarget < 0) pitchTarget *= 0.12;
      const rollTarget = controls.roll * AIRCRAFT.rollRate * (0.55 + speedFactor * 0.55) * authority;
      const yawTarget = controls.yaw * AIRCRAFT.yawRate * speedFactor * authority;
      rate.pitch = damp(rate.pitch, pitchTarget, 7, dt);
      rate.roll = damp(rate.roll, rollTarget, 8, dt);
      rate.yaw = damp(rate.yaw, yawTarget, 5, dt);

      tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rate.pitch * dt);
      state.quaternion.multiply(tmpQ);
      tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rate.roll * dt);
      state.quaternion.multiply(tmpQ);
      tmpQ.setFromAxisAngle(UP, rate.yaw * dt);
      state.quaternion.premultiply(tmpQ);

      // Bank-to-turn: a rolled wing bends the flight path, as it should.
      axes();
      const bankTurn = -a.right.y * (WORLD.gravity / Math.max(state.speed, 24)) * 1.05;
      tmpQ.setFromAxisAngle(UP, bankTurn * dt);
      state.quaternion.premultiply(tmpQ);

      // Hands-off wing leveller, gentle enough to leave a bank alone.
      if (state.assist && Math.abs(controls.roll) < 0.04 && Math.abs(controls.pitch) < 0.04) {
        const bank = Math.atan2(-a.right.y, a.up.y);
        tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -bank * 0.55 * dt);
        state.quaternion.multiply(tmpQ);
      }

      // Throttle and energy.
      const throttleTarget = clamp(controls.throttle, 0, 1);
      state.throttle = damp(state.throttle, throttleTarget, 4.5, dt);
      const thrust = state.fuel > 0 ? (0.12 + state.throttle * 0.88) * AIRCRAFT.maxThrust : 0;
      const gearDrag = state.gearDown ? 1.22 : 1;
      const flapDrag = 1 + state.flaps * 0.16;
      const drag = AIRCRAFT.drag * state.speed * state.speed * gearDrag * flapDrag;
      const gravityAlong = -WORLD.gravity * a.fwd.y * 0.9;
      const trim = state.assist ? 1 : 0.86;
      state.speed += (thrust - drag + gravityAlong) * trim * dt;
      state.speed = clamp(state.speed, AIRCRAFT.minSpeed, AIRCRAFT.maxSpeed + 8);

      state.fuel = Math.max(0, state.fuel - AIRCRAFT.fuelBurn * (0.22 + state.throttle * 0.78) * dt);

      // Stall: the nose falls and the wing stops carrying.
      state.stall = state.speed < AIRCRAFT.stallSpeed && Math.abs(controls.pitch) < 0.9;
      if (state.stall) {
        tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.55 * dt);
        state.quaternion.multiply(tmpQ);
      }
      if (state.speed < AIRCRAFT.stallSpeed) {
        const fall = (AIRCRAFT.stallSpeed - state.speed) * 0.16;
        sink.set(0, -fall, 0);
        state.position.addScaledVector(sink, dt);
      }

      state.position.addScaledVector(a.fwd, state.speed * dt);
      if (wind) state.position.addScaledVector(wind, dt);
      state.overspeed = state.speed > AIRCRAFT.maxSpeed;
      state.gLoad = 1 + Math.abs(rate.pitch) * state.speed * 0.055;
    }

    // Terrain contact.
    const ground = sampleHeight(state.position.x, state.position.z);
    if (!state.onGround) {
      if (state.position.y <= ground + 1.4) {
        const runway = Math.abs(state.position.x - WORLD.runway.x) < WORLD.runway.width / 2 + 3
          && Math.abs(state.position.z - WORLD.runway.z) < WORLD.runway.length / 2 + 10;
        const descent = (state.position.y - state.lastY) / Math.max(dt, 1e-4);
        if (runway && state.gearDown && state.speed < 78 && descent > -7.5) {
          state.onGround = true;
          state.position.y = WORLD.runway.elevation + 1.55;
          state.quaternion.setFromEuler(new THREE.Euler(0, -THREE.MathUtils.degToRad(headingOf(state.quaternion)), 0));
          state.speed = Math.min(state.speed, 58);
        } else {
          state.crashed = true;
          state.position.y = ground + 0.9;
        }
      }
    }

    // Airspeed changes the camera and the HUD; derived values are refreshed once per step.
    axes();
    state.heading = headingOf(state.quaternion);
    state.pitchDeg = THREE.MathUtils.radToDeg(Math.asin(clamp(a.fwd.y, -1, 1)));
    state.bank = Math.atan2(-a.right.y, a.up.y);
    const vy = (state.position.y - state.lastY) / Math.max(dt, 1e-4);
    state.vertical = damp(state.vertical, vy, 5, dt);
    state.lastY = state.position.y;
  }

  function updateGround(dt, controls, a) {
    state.throttle = damp(state.throttle, clamp(controls.throttle, 0, 1), 4.5, dt);
    const thrust = state.fuel > 0 ? state.throttle * AIRCRAFT.maxThrust * 0.72 : 0;
    const rolling = 0.85 + (controls.brake ? 4.8 : 0);
    state.speed += (thrust - rolling) * dt;
    state.speed = clamp(state.speed, 0, 52);
    state.fuel = Math.max(0, state.fuel - AIRCRAFT.fuelBurn * (0.3 + state.throttle * 0.7) * dt);

    // Nosewheel steering at taxi speed, rudder authority at takeoff speed.
    const steer = controls.yaw * clamp(1 - state.speed / 40, 0.15, 1);
    tmpQ.setFromAxisAngle(UP, -steer * 0.85 * dt);
    state.quaternion.premultiply(tmpQ);
    const heading = headingOf(state.quaternion);
    state.quaternion.setFromEuler(new THREE.Euler(0, -THREE.MathUtils.degToRad(heading), 0));
    state.position.addScaledVector(a.fwd, state.speed * dt);
    state.position.y = WORLD.runway.elevation + 1.55;

    // Rotate on the stick, or let the aeroplane unstick itself once it has flying speed.
    const rotate = controls.pitch > 0.28 || (state.speed > 42 && controls.pitch > -0.4);
    if (rotate && state.speed > AIRCRAFT.stallSpeed + 5) {
      state.onGround = false;
      state.position.y += 1.5;
      tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.16);
      state.quaternion.multiply(tmpQ);
    }
  }

  return { state, update, axes };
}

export function setHeading(state, headingDeg) {
  const e = new THREE.Euler(0, -THREE.MathUtils.degToRad(headingDeg), 0, 'YXZ');
  state.quaternion.setFromEuler(e);
}

export function headingOf(q) {
  const f = tmpV.set(0, 0, -1).applyQuaternion(q);
  let deg = THREE.MathUtils.radToDeg(Math.atan2(f.x, -f.z));
  if (deg < 0) deg += 360;
  return deg;
}

export function speedKts(state) {
  return state.speed * 1.94384;
}

export function altitudeFt(state) {
  return Math.max(0, state.position.y) * 3.28084;
}

export function verticalFpm(state) {
  return state.vertical * 196.85;
}
