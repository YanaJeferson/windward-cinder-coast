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
    engineOn: true,
    engineStarting: 0,
    parkingBrake: false,
    touchdownRate: 0,
    touchdownAt: null,
    landingGrade: null,
    landingOffset: 0,
    groundY: WORLD.runway.elevation + 1.55,
    rotateCall: false,
    takeoffGrace: 0,
    turnRate: 0,
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
    if (state.engineStarting > 0) {
      state.engineStarting = Math.max(0, state.engineStarting - dt);
      if (state.engineStarting === 0) state.engineOn = true;
    }
    if (state.takeoffGrace > 0) state.takeoffGrace = Math.max(0, state.takeoffGrace - dt);
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
      if (pitchNow > 0.98 && pitchTarget > 0) pitchTarget *= 0.05;
      if (pitchNow < -0.98 && pitchTarget < 0) pitchTarget *= 0.05;
      // A hard back-stop keeps the arcade envelope out of a vertical hover.
      if (pitchNow > 1.08) {
        tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(pitchNow - 1.08) * 5 * dt);
        state.quaternion.multiply(tmpQ);
      } else if (pitchNow < -1.08) {
        tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(pitchNow + 1.08) * 5 * dt);
        state.quaternion.multiply(tmpQ);
      }
      const rollTarget = controls.roll * AIRCRAFT.rollRate * (0.5 + speedFactor * 0.5) * authority;
      const yawTarget = controls.yaw * AIRCRAFT.yawRate * speedFactor * authority;
      rate.pitch = damp(rate.pitch, pitchTarget, 7, dt);
      rate.roll = damp(rate.roll, rollTarget, 8, dt);
      rate.yaw = damp(rate.yaw, yawTarget, 5, dt);

      tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rate.pitch * dt);
      state.quaternion.multiply(tmpQ);
      tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rate.roll * dt);
      state.quaternion.multiply(tmpQ);
      tmpQ.setFromAxisAngle(UP, -rate.yaw * dt);
      state.quaternion.premultiply(tmpQ);

      // Bank-to-turn: the horizontal component of lift bends the flight path toward the low wing.
      // A coordinated turn rate is g*tan(bank)/v; clamp it near knife-edge so the sim stays sane.
      axes();
      const bankSin = -a.right.y;             // > 0 when the right wing is down
      // The horizontal part of the wing's lift is what curves the path; using the signed cross
      // product keeps the turn correct in a bank and quiet when inverted.
      const crossY = a.fwd.z * a.up.x - a.fwd.x * a.up.z;
      const turnRate = (WORLD.gravity / Math.max(state.speed, 24))
        * clamp(crossY / Math.max(Math.abs(a.up.y), 0.35), -2.4, 2.4);
      state.turnRate = turnRate;
      tmpQ.setFromAxisAngle(UP, turnRate * dt);
      state.quaternion.premultiply(tmpQ);

      // A steep wing cannot hold the aircraft up: the vertical lift falls away with bank.
      const liftLoss = Math.max(0, 1 - a.up.y);
      if (liftLoss > 0.02) state.position.y -= liftLoss * liftLoss * (4.2 + state.speed * 0.05) * dt;

      // Hands-off wing leveller, gentle enough to leave a bank alone, decisive when inverted.
      if (state.assist && Math.abs(controls.roll) < 0.04 && Math.abs(controls.pitch) < 0.04) {
        const bankErr = Math.atan2(-a.right.y, a.up.y);
        // Roll about the aircraft's own flight path (the world-space forward axis): that is the
        // axis a wings-leveler actually turns on, and it stays well behaved when inverted.
        const rollCmd = Math.abs(bankErr) > 2.6 ? 2.6 : -bankErr * 0.55;
        tmpQ.setFromAxisAngle(a.fwd, rollCmd * dt);
        state.quaternion.premultiply(tmpQ);
      }
      // Hands-off pitch trim: the arcade envelope settles toward the horizon instead of
      // freezing wherever the last input left it.
      if (state.assist && Math.abs(controls.pitch) < 0.04 && !state.stall) {
        const pitchErr = Math.asin(clamp(a.fwd.y, -1, 1));
        if (Math.abs(pitchErr) > 0.1) {
          tmpQ.setFromAxisAngle(a.right, -pitchErr * 0.45 * dt);
          state.quaternion.premultiply(tmpQ);
        }
      }

      // Below best-glide speed the wing needs more angle than the arcade model gives it: sink.
      const liftDeficit = clamp((AIRCRAFT.stallSpeed + 8 - state.speed) / 14, 0, 1);
      if (liftDeficit > 0) state.position.y -= liftDeficit * 3.4 * dt;

      // Throttle and energy.
      const throttleTarget = clamp(controls.throttle, 0, 1);
      state.throttle = damp(state.throttle, throttleTarget, 4.5, dt);
      const thrust = state.engineOn && state.fuel > 0 ? (0.16 + state.throttle * 0.84) * AIRCRAFT.maxThrust : 0;
      const gearDrag = state.gearDown ? 1.15 : 1;
      const flapDrag = 1 + state.flaps * 0.11;
      const propDrag = state.engineOn ? 1 : 0.55;
      const turnDrag = 1 + Math.abs(bankSin) * (state.speed < AIRCRAFT.cruiseSpeed ? 0.42 : 0.22);
      const drag = AIRCRAFT.drag * state.speed * state.speed * gearDrag * flapDrag * propDrag * turnDrag;
      const gravityAlong = -WORLD.gravity * a.fwd.y * 0.9;
      const trim = state.assist ? 1 : 0.86;
      state.speed += (thrust - drag + gravityAlong) * trim * dt;
      state.speed = clamp(state.speed, AIRCRAFT.minSpeed, AIRCRAFT.maxSpeed + 8);

      if (state.engineOn) state.fuel = Math.max(0, state.fuel - AIRCRAFT.fuelBurn * (0.3 + state.throttle * 0.7) * dt);
      if (state.fuel <= 0) state.engineOn = false;

      // Stall: the wing stops carrying, the nose falls and one wing drops. Easing the stick
      // forward and adding power recovers it, as it should.
      state.stall = state.speed < AIRCRAFT.stallSpeed;
      if (state.stall) {
        const severity = clamp((AIRCRAFT.stallSpeed - state.speed) / 9, 0.3, 1);
        tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.62 * severity * dt);
        state.quaternion.multiply(tmpQ);
        const bankNow = Math.atan2(-a.right.y, a.up.y);
        if (Math.abs(bankNow) < 1.15) {
          const wingDrop = Math.sin(state.time * 1.9) * 0.42 * severity;
          tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), wingDrop * dt);
          state.quaternion.multiply(tmpQ);
        }
        sink.set(0, -(1.6 + severity * 5.2), 0);
        state.position.addScaledVector(sink, dt);
        state.speed = Math.max(AIRCRAFT.minSpeed, state.speed - 1.2 * dt);
      }

      state.position.addScaledVector(a.fwd, state.speed * dt);
      if (wind) state.position.addScaledVector(wind, dt);
      if (!state.engineOn) state.position.y -= (1.6 + Math.max(0, AIRCRAFT.cruiseSpeed - state.speed) * 0.02) * dt;
      state.overspeed = state.speed > AIRCRAFT.maxSpeed;
      state.gLoad = 1 + Math.abs(rate.pitch) * state.speed * 0.055;
    }

    // Terrain contact. A landing counts when the wheels are down, the wings are level and the
    // runway heading is tracked; grass is survivable only as a slow, flat off-field arrival.
    const ground = sampleHeight(state.position.x, state.position.z);
    state.rotateCall = state.onGround && state.speed > AIRCRAFT.stallSpeed * 1.14 && state.speed < AIRCRAFT.stallSpeed * 1.55;
    if (!state.onGround) {
      if (state.takeoffGrace <= 0 && state.position.y <= ground + 1.4) {
        const dx = state.position.x - WORLD.runway.x;
        const dz = state.position.z - WORLD.runway.z;
        const onRunway = Math.abs(dx) < WORLD.runway.width / 2 + 4
          && Math.abs(dz) < WORLD.runway.length / 2 + 12;
        const descent = (state.position.y - state.lastY) / Math.max(dt, 1e-4);
        const headingErr = Math.min(
          Math.abs(((state.heading - 0 + 540) % 360) - 180),
          Math.abs(((state.heading - 180 + 540) % 360) - 180),
        );
        const slope = Math.max(
          Math.abs(sampleHeight(state.position.x + 6, state.position.z) - ground),
          Math.abs(sampleHeight(state.position.x, state.position.z + 6) - ground),
        ) / 6;
        const rate = Math.abs(descent);
        if (onRunway && state.gearDown && headingErr < 30 && state.speed < 84 && descent > -10) {
          state.touchdownRate = rate;
          state.touchdownAt = state.time;
          state.landingOffset = Math.abs(dx);
          state.landingGrade = rate < 1.8 && headingErr < 14 && Math.abs(dx) < 9
            ? 'SUAVE'
            : rate < 4.2 && headingErr < 22
              ? 'FIRME'
              : 'DURO';
          if (rate > 5.5 || headingErr > 18) {
            state.damage = Math.min(AIRCRAFT.maxDamage, state.damage + Math.max(0, (rate - 5.5) * 7) + (headingErr > 18 ? 6 : 0));
          }
          state.onGround = true;
          state.groundY = WORLD.runway.elevation + 1.55;
          state.position.y = state.groundY;
          state.quaternion.setFromEuler(new THREE.Euler(0, -THREE.MathUtils.degToRad(state.heading), 0));
          state.speed = Math.min(state.speed, 62);
        } else if (state.gearDown && descent > -3.4 && state.speed < 44 && slope < 0.14) {
          // A flat, slow arrival in a field: no fire, but the aeroplane has had a day.
          state.touchdownRate = rate;
          state.touchdownAt = state.time;
          state.landingGrade = 'CAMPO';
          state.damage = Math.min(AIRCRAFT.maxDamage, state.damage + 18);
          state.onGround = true;
          state.groundY = ground + 1.5;
          state.position.y = state.groundY;
          state.quaternion.setFromEuler(new THREE.Euler(0, -THREE.MathUtils.degToRad(state.heading), 0));
          state.speed = Math.min(state.speed, 26);
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
    if (state.parkingBrake) {
      state.speed = 0;
      state.position.y = state.groundY;
      return;
    }
    const thrust = state.engineOn && state.fuel > 0 ? state.throttle * AIRCRAFT.maxThrust * 0.72 : 0;
    const rolling = 0.85 + (controls.brake ? 6.5 : 0);
    state.speed += (thrust - rolling) * dt;
    state.speed = Math.max(0, clamp(state.speed, 0, 52));
    if (state.engineOn) state.fuel = Math.max(0, state.fuel - AIRCRAFT.fuelBurn * (0.3 + state.throttle * 0.7) * dt);
    if (state.fuel <= 0) state.engineOn = false;

    // Nosewheel steering at taxi speed, rudder authority at takeoff speed.
    const steer = (controls.yaw + controls.roll * 0.3) * clamp(1 - state.speed / 44, 0.2, 1);
    tmpQ.setFromAxisAngle(UP, -steer * 0.85 * dt);
    state.quaternion.premultiply(tmpQ);
    const heading = headingOf(state.quaternion);
    state.quaternion.setFromEuler(new THREE.Euler(0, -THREE.MathUtils.degToRad(heading), 0));
    state.position.addScaledVector(a.fwd, state.speed * dt);
    state.position.y = state.groundY;

    // Rotate on the stick, or let the aeroplane unstick itself once it has flying speed.
    const rotate = controls.pitch > 0.26 || (state.speed > 46 && controls.pitch > -0.3);
    if (rotate && state.speed > AIRCRAFT.stallSpeed + 2) {
      state.onGround = false;
      state.groundY = WORLD.runway.elevation + 1.55;
      state.position.y += 1.5;
      state.lastY = state.position.y;
      state.takeoffGrace = 0.9;
      tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.16);
      state.quaternion.multiply(tmpQ);
    }
  }

  function toggleEngine() {
    if (state.engineOn || state.engineStarting > 0) {
      state.engineOn = false;
      state.engineStarting = 0;
    } else if (state.fuel > 0) {
      state.engineStarting = 1.4;
    }
  }

  function toggleParkingBrake() {
    state.parkingBrake = !state.parkingBrake;
    if (state.parkingBrake) state.speed = 0;
  }

  return { state, update, axes, toggleEngine, toggleParkingBrake };
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
