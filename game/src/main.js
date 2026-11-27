// Boot and direction: one renderer, one clock, and the screens a sortie passes through. The
// ?shot=... queries stage the four photographs the entry hands in, using the same game systems.
import * as THREE from '../vendor/three.module.min.js';
import { AIRCRAFT, PALETTE, SCREENS, WORLD } from './config.js';
import { createTerrain, createHeightTexture, sampleHeight } from './world/terrain.js';
import { createSea } from './world/sea.js';
import { createSky } from './world/sky.js';
import { createAirport } from './world/airport.js';
import { createVegetation } from './world/vegetation.js';
import { createGrass } from './world/grass.js';
import { createFields } from './world/fields.js';
import { createLake } from './world/lake.js';
import { createVillage } from './world/village.js';
import { createCrashEffects } from './game/effects.js';
import { createWeather, windVector, WEATHER_CHOICES, WEATHER_LABELS } from './world/weather.js';
import { createGates, createBeacon, updateGates } from './world/gates.js';
import { createAircraft } from './aircraft/plane.js';
import { createCockpit } from './aircraft/cockpit.js';
import { createFlight, altitudeFt, setHeading, speedKts } from './aircraft/flight.js';
import { createCameraRig } from './camera/rig.js';
import { createHud } from './hud/hud.js';
import { createMissions, createMissionState, updateMission, say } from './game/missions.js';
import { createInput, ACTIONS } from './game/input.js';
import { createAudio } from './game/audio.js';
import { clamp, damp, formatTime } from './util/math.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.2;

const sceneCanvas = document.getElementById('scene');
const hudCanvas = document.getElementById('hud');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({
  canvas: sceneCanvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e7b98d');
scene.fog = new THREE.Fog(new THREE.Color('#e8bf97'), WORLD.fog.near, WORLD.fog.far);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.4, 30000);
camera.position.set(0, 240, 3000);

const sky = createSky();
scene.add(sky);
// A photographic sky replaces the painted dome for depth and cloud detail.
for (const child of sky.children) {
  if (!child.isLight) child.visible = false;
}
{
  const img = new Image();
  img.src = new URL('../assets/sky_top.jpg', import.meta.url).href;
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 2048, 512);
    const grad = g.createLinearGradient(0, 512, 0, 1024);
    grad.addColorStop(0, '#c8d6de');
    grad.addColorStop(0.25, '#d6d8d0');
    grad.addColorStop(1, '#d9d3c2');
    g.fillStyle = grad;
    g.fillRect(0, 512, 2048, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.userData.clearBackground = tex;
    scene.environment = tex;
    weather.refreshBackground();
  };
}
const sunLight = sky.userData.sun;
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 2600;
sunLight.shadow.camera.left = -700;
sunLight.shadow.camera.right = 700;
sunLight.shadow.camera.top = 700;
sunLight.shadow.camera.bottom = -700;
sunLight.shadow.bias = -0.0012;
sunLight.shadow.normalBias = 0.9;
const sea = createSea();
scene.add(sea);
const terrain = createTerrain();
const heightTex = createHeightTexture();
sea.material.uniforms.uHeight.value = heightTex;
scene.add(terrain);
const airport = createAirport();
airport.traverse((o) => {
  if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
});
scene.add(airport);
scene.add(createVegetation());
// Grass clumps are kept for close ground views; the terrain shader supplies the field detail.
const grass = createGrass();
grass.a.visible = false;
grass.b.visible = false;
scene.add(createFields());
const lake = createLake();
scene.add(lake);
scene.add(createVillage());

const weather = createWeather({ scene, sky, sea });
const effects = createCrashEffects(scene);
const plane = createAircraft();
plane.traverse((o) => {
  if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
});
scene.add(plane);
const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const shadowBlob = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 15),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.35 }),
);
shadowBlob.rotation.x = -Math.PI / 2;
shadowBlob.renderOrder = 2;
scene.add(shadowBlob);
const cockpit = createCockpit();
plane.add(cockpit.group);

const missions = createMissions();
const missionGroups = missions.map((def) => {
  const { group, gates } = createGates(def.gates);
  group.visible = false;
  scene.add(group);
  let beacon = null;
  if (def.beacon) {
    beacon = createBeacon(new THREE.Vector3(def.beacon.x, sampleHeight(def.beacon.x, def.beacon.z) + 2, def.beacon.z));
    beacon.visible = false;
    scene.add(beacon);
  }
  return { group, gates, beacon };
});

const flight = createFlight({ position: new THREE.Vector3(0, 238, 2050), headingDeg: 0 });
const rig = createCameraRig(camera);
const hud = createHud(hudCanvas);
hudCanvas.addEventListener('click', (event) => {
  if (screen !== SCREENS.TITLE) return;
  if (menuPanel) { menuPanel = null; return; }
  const x = event.clientX;
  const y = event.clientY;
  for (const hit of titleHits) {
    if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
      if (hit.menu !== undefined) { menuIndex = hit.menu; activateTitle(); }
      else if (hit.start) beginMission(selected);
      return;
    }
  }
});
const audio = createAudio();
const input = createInput(sceneCanvas);
sceneCanvas.focus();

let screen = SCREENS.TITLE;
let selected = 2;
let menuIndex = 0;
let menuPanel = null;
let menuToast = '';
let menuToastUntil = 0;
let titleHits = [];
const menuImage = new Image();
menuImage.src = new URL('../assets/menu-valley.jpg', import.meta.url).href;
let weatherChoice = 'auto';
let mission = null;
let activeGroup = null;
let activeGates = [];
let activeBeacon = null;
let elapsed = 0;
let shake = 0;
let resultDelay = 0;
let showHelp = false;
let lastGround = false;
let crashStarted = false;
let crashFlash = 0;
const stick = { roll: 0, pitch: 0, yaw: 0 };
let time = 0;

const titleFlight = {
  position: new THREE.Vector3(-1750, 470, 1450),
  quaternion: new THREE.Quaternion(),
  speed: 60,
  throttle: 0.55,
  fuel: 80,
  damage: 0,
  gearDown: false,
  flaps: 0,
  onGround: false,
  crashed: false,
  stall: false,
  overspeed: false,
  vertical: 0,
  bank: 0,
  heading: 300,
  gLoad: 1,
};
setHeading(titleFlight, 300);
titleFlight.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.08));

function announce(text) {
  statusEl.textContent = text;
}

function resolveWeather() {
  if (weatherChoice !== 'auto') return weatherChoice;
  if (screen === SCREENS.TITLE) return 'sunset';
  if (!mission) return 'sunny';
  const w = mission.def.weather ?? 'sunny';
  return w === 'clear' ? 'sunny' : w;
}

function applyWeather() {
  weather.set(resolveWeather());
}

function cycleWeather(direction) {
  const i = WEATHER_CHOICES.indexOf(weatherChoice);
  weatherChoice = WEATHER_CHOICES[(i + direction + WEATHER_CHOICES.length) % WEATHER_CHOICES.length];
  applyWeather();
  announce(`Weather ${WEATHER_LABELS[weatherChoice]}.`);
}

function selectMission(index) {
  selected = (index + missions.length) % missions.length;
}

function beginMission(index) {
  selected = index;
  const def = missions[index];
  mission = createMissionState(def);
  activeGroup = missionGroups[index];
  activeGates = activeGroup.gates;
  activeBeacon = activeGroup.beacon;
  for (const g of missionGroups) g.group.visible = false;
  for (const g of missionGroups) if (g.beacon) g.beacon.visible = false;
  activeGroup.group.visible = true;
  if (activeBeacon) activeBeacon.visible = true;
  for (const gate of activeGates) gate.passed = false;

  const s = def.start;
  flight.state.position.set(s.x, s.y, s.z);
  flight.state.speed = s.speed;
  flight.state.throttle = s.throttle ?? (s.ground ? 0.9 : 0.68);
  flight.state.fuel = s.fuel;
  flight.state.damage = 0;
  flight.state.gearDown = Boolean(s.gear);
  flight.state.flaps = s.flaps ?? 0;
  flight.state.onGround = Boolean(s.ground);
  flight.state.crashed = false;
  flight.state.stopped = false;
  flight.state.vertical = 0;
  flight.state.lastY = s.y;
  flight.state.engineOn = !s.engineOff;
  flight.state.engineStarting = 0;
  flight.state.parkingBrake = Boolean(s.parking);
  flight.state.touchdownAt = null;
  flight.state.landingGrade = null;
  effects.clear();
  plane.visible = true;
  crashStarted = false;
  crashFlash = 0;
  applyWeather();
  setHeading(flight.state, s.heading);
  flight.state.heading = s.heading;
  rig.snap(flight.state);
  rig.setMode('chase');
  elapsed = 0;
  resultDelay = 0;
  screen = SCREENS.BRIEF;
  hudCanvas.style.pointerEvents = 'none';
  say(mission, ...(def.radio?.start ?? ['TOWER', 'Cleared.']));
  announce(`${def.name}. Press Enter to fly.`);
}

function startFlying() {
  screen = SCREENS.FLY;
  hudCanvas.style.pointerEvents = 'none';
  audio.start();
  announce(`${mission.name}. ${mission.objective}.`);
}

function finishMission(success) {
  if (screen === SCREENS.RESULT) return;
  screen = SCREENS.RESULT;
  mission.complete = success && !mission.failed;
  mission.failed = !success || mission.failed;
  announce(success ? `Mission complete. Score ${mission.score}.` : `Mission failed. ${mission.failReason ?? ''}`);
}

function restart() {
  beginMission(selected);
  startFlying();
}

function toTitle() {
  screen = SCREENS.TITLE;
  plane.visible = true;
  cockpit.group.visible = false;
  setCockpitShell(false);
  weather.set(weatherChoice === 'auto' ? 'sunset' : weatherChoice);
  effects.clear();
  hudCanvas.style.pointerEvents = 'auto';
  rig.setMode('title');
  announce('Windward: Cinder Coast. Choose a sortie.');
}

function handleInput() {
  const actions = input.takeActions();
  if (screen === SCREENS.TITLE) {
    if (menuPanel) {
      if (actions & (ACTIONS.CONFIRM | ACTIONS.PAUSE)) menuPanel = null;
      return;
    }
    if (actions & ACTIONS.WEATHER_NEXT) cycleWeather(1);
    if (actions & ACTIONS.WEATHER_PREV) cycleWeather(-1);
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) menuIndex = (menuIndex + 4) % 5;
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) menuIndex = (menuIndex + 1) % 5;
    if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) selectMission(selected - 1);
    if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) selectMission(selected + 1);
    if (actions & ACTIONS.CONFIRM) activateTitle();
  } else if (screen === SCREENS.BRIEF) {
    if (actions & ACTIONS.WEATHER_NEXT) cycleWeather(1);
    if (actions & ACTIONS.WEATHER_PREV) cycleWeather(-1);
    if (actions & ACTIONS.CONFIRM) startFlying();
    if (actions & ACTIONS.PAUSE) toTitle();
  } else if (screen === SCREENS.FLY) {
    if (actions & ACTIONS.WEATHER_NEXT) cycleWeather(1);
    if (actions & ACTIONS.WEATHER_PREV) cycleWeather(-1);
    if (actions & ACTIONS.PAUSE) screen = SCREENS.PAUSE;
    if (actions & ACTIONS.CAMERA) {
      const order = ['chase', 'cockpit', 'wing'];
      rig.setMode(order[(order.indexOf(rig.mode) + 1) % order.length]);
      cockpit.group.visible = rig.mode === 'cockpit';
    }
    if (actions & ACTIONS.FLIGHTMODE) flight.state.assist = !flight.state.assist;
    if (actions & ACTIONS.ENGINE) {
      const wasOff = !flight.state.engineOn;
      flight.toggleEngine();
      if (wasOff && flight.state.engineStarting > 0) audio.tone(150, 0.5, 0.05, 'sawtooth');
    }
    if (actions & ACTIONS.PARK) flight.toggleParkingBrake();
    if (actions & ACTIONS.GEAR) flight.state.gearDown = !flight.state.gearDown;
    if (actions & ACTIONS.FLAPS) flight.state.flaps = flight.state.flaps > 0.7 ? 0 : flight.state.flaps > 0.2 ? 1 : 0.5;
    if (actions & ACTIONS.MUTE) audio.toggleMute();
    if (actions & ACTIONS.RESTART) restart();
    if (actions & ACTIONS.HELP) showHelp = !showHelp;
  } else if (screen === SCREENS.PAUSE) {
    if (actions & ACTIONS.PAUSE) screen = SCREENS.FLY;
    if (actions & ACTIONS.RESTART) restart();
    if (actions & ACTIONS.CONFIRM) toTitle();
  } else if (screen === SCREENS.RESULT) {
    if (actions & ACTIONS.CONFIRM) toTitle();
    if (actions & ACTIONS.RESTART) restart();
  }
  if (screen === SCREENS.FLY || screen === SCREENS.TITLE) input.endFrame();
}

function stepFlight(dt) {
  const a = input.axes();
  stick.roll = a.roll;
  stick.pitch = a.pitch;
  stick.yaw = a.yaw;
  flight.state.throttle = clamp(flight.state.throttle + input.throttleDelta(dt), 0, 1);
  const controls = { ...a, throttle: flight.state.throttle };
  flight.update(dt, controls, windVector(weather.wind, time));
  audio.update(flight.state, dt);
  elapsed += dt;
  time += dt;

  if (flight.state.crashed && !crashStarted) {
    crashStarted = true;
    crashFlash = 1;
    audio.crash();
    const ground = sampleHeight(flight.state.position.x, flight.state.position.z);
    effects.burst(flight.state.position, ground);
    plane.visible = false;
    resultDelay = 3.0;
  }

  if (mission && screen === SCREENS.FLY) {
    const before = mission.gateIndex;
    updateMission(mission, flight.state, dt);
    if (mission.gateIndex !== before) {
      for (let i = 0; i < mission.gateIndex; i += 1) activeGates[i].passed = true;
      audio.gate(before);
    }
    if (mission.complete) finishMission(true);
    else if (mission.failed) finishMission(false);
  }

  if (flight.state.onGround && !lastGround) {
    audio.thud(clamp(Math.abs(flight.state.vertical) / 5 + 0.5, 0.4, 1.6));
    effects.dust(flight.state.position);
  }
  lastGround = flight.state.onGround;
}

function updateTitle(dt) {
  time += dt;
  plane.position.copy(titleFlight.position);
  plane.quaternion.copy(titleFlight.quaternion);
  plane.userData.propeller.rotation.z += dt * 26;
  plane.userData.propDisc.rotation.z += dt * 3;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(titleFlight.quaternion);
  titleFlight.position.addScaledVector(fwd, dt * 20);
  if (titleFlight.position.distanceTo(new THREE.Vector3(-2500, 470, 700)) > 1700) {
    titleFlight.position.set(-1750, 470, 1450);
  }
  rig.update(titleFlight, dt, time);
  weather.update(dt, camera, titleFlight);
  cockpit.group.visible = false;
}

function activeGateScreen() {
  if (!mission) return null;
  if (mission.gateIndex >= activeGates.length) return null;
  const gate = activeGates[mission.gateIndex];
  if (!gate) return null;
  const p = gate.group.position.clone();
  const d = flight.state.position.distanceTo(p);
  const ndc = p.clone().project(camera);
  const behind = ndc.z > 1 || ndc.z < -1;
  const onScreen = !behind && Math.abs(ndc.x) < 1.1 && Math.abs(ndc.y) < 1.1;
  const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
  return { x: onScreen ? x : (x < 0 ? 44 : window.innerWidth - 44), y: onScreen ? y : (y < 0 ? 80 : window.innerHeight - 120), distance: d, offscreen: !onScreen };
}

function groundPrompt() {
  const f = flight.state;
  if (!f.onGround || screen !== SCREENS.FLY) return null;
  const kt = speedKts(f);
  if (f.engineStarting > 0) return { text: 'STARTING ENGINE…', color: PALETTE.teal };
  if (!f.engineOn) return { text: 'ENGINE OUT · PRESS X TO START', color: PALETTE.warning };
  if (f.parkingBrake) return { text: 'PARKING BRAKE · PRESS B TO RELEASE', color: PALETTE.amber };
  if (mission?.airborne && mission.gateIndex >= mission.gates.length && mission.def.landing && kt > 4) {
    return { text: 'BRAKE · SPACE · OR B FOR PARKING BRAKE', color: PALETTE.teal };
  }
  if (f.throttle < 0.75) return { text: `HOLD SHIFT FOR POWER · ${Math.round(kt)} KT`, color: PALETTE.amber };
  if (kt < 58) return { text: `TAKEOFF · PULL S / ↓ TO ROTATE · ${Math.round(kt)} KT`, color: PALETTE.cream };
  return { text: 'ROTATE · PULL S / ↓', color: PALETTE.amber };
}

function warnings() {
  const out = [];
  const f = flight.state;
  if (f.stall) out.push({ text: 'STALL', color: PALETTE.warning });
  else if (!f.onGround && f.speed < AIRCRAFT.stallSpeed + 6) out.push({ text: 'LOW SPEED', color: PALETTE.amber });
  const ground = sampleHeight(f.position.x, f.position.z);
  if (!f.onGround && f.position.y - ground < 45 && f.vertical < -6) out.push({ text: 'TERRAIN', color: PALETTE.warning });
  if (!f.engineOn && !f.onGround) out.push({ text: 'ENGINE OUT · GLIDE 75 KT', color: PALETTE.amber });
  if (f.fuel < 18) out.push({ text: 'FUEL LOW', color: PALETTE.amber });
  if (mission && mission.gateIndex >= activeGates.length && mission.def.landing && !f.gearDown && f.position.y < 260) {
    out.push({ text: 'GEAR UP', color: PALETTE.amber });
  }
  if (showHelp) out.push({ text: 'W/S PITCH  A/D ROLL  SHIFT/CTRL THROTTLE  C CAMERA  G GEAR  F FLAPS', color: 'rgba(255,241,210,0.75)' });
  return out;
}

function setCockpitShell(on) {
  for (const child of plane.children) {
    if (child !== cockpit.group) child.visible = !on;
  }
  cockpit.group.visible = on;
}

function updateWorld(dt) {
  sea.userData.uniforms.uTime.value = time;
  {
    const gx = flight.state.position.x;
    const gz = flight.state.position.z;
    const gh = sampleHeight(gx, gz);
    const alt = flight.state.position.y - gh;
    shadowBlob.position.set(gx, gh + 0.28, gz);
    shadowBlob.visible = gh > 2 && alt < 320;
    shadowBlob.material.opacity = Math.max(0.04, 0.42 - alt / 700);
    const s = 1 + Math.min(alt / 260, 1.7);
    shadowBlob.scale.set(s, s, s);
  }
  if (sunLight && plane) {
    const p = plane.position;
    sunLight.target.position.copy(p);
    sunLight.position.copy(p).addScaledVector(sky.userData.sunDir, 1500);
    sunLight.target.updateMatrixWorld();
    sunLight.updateMatrixWorld();
  }
  if (plane.userData.ailerons) {
    for (const a of plane.userData.ailerons) {
      a.hinge.rotation.x = damp(a.hinge.rotation.x, -stick.roll * 0.42 * a.side, 8, dt);
    }
    for (const e of plane.userData.elevators) {
      e.rotation.x = damp(e.rotation.x, -stick.pitch * 0.32, 8, dt);
    }
    plane.userData.rudder.rotation.y = damp(plane.userData.rudder.rotation.y, -stick.yaw * 0.42, 8, dt);
  }
  weather.update(dt, camera, flight.state);
  effects.update(dt);
  crashFlash = Math.max(0, crashFlash - dt * 1.4);
  updateGates(activeGates, mission ? mission.gateIndex : 0, time);
  if (activeBeacon && mission && mission.gateIndex >= 2) {
    activeBeacon.userData.column.material.opacity = 0.28 + Math.sin(time * 4) * 0.1;
    activeBeacon.userData.flare.scale.setScalar(18 + Math.sin(time * 3.1) * 3);
  }
  const propRate = flight.state.engineOn
    ? 18 + flight.state.throttle * 46
    : flight.state.engineStarting > 0 ? 9 : Math.max(0, flight.state.speed * 0.55);
  plane.userData.propeller.rotation.z += dt * propRate;
  plane.userData.propDisc.rotation.z += dt * 2.5;
  plane.userData.propDisc.material.opacity = flight.state.engineOn ? 0.28 + flight.state.throttle * 0.62 : 0.08;
  const flapTarget = flight.state.flaps * 0.62;
  for (const flap of plane.userData.flaps) flap.rotation.x = damp(flap.rotation.x, flapTarget, 6, dt);
}

function renderFrame(dt) {
  handleInput();

  if (screen === SCREENS.TITLE) {
    updateTitle(dt);
    hud.draw({ hideHud: true, stage: drawTitle });
  } else if (screen === SCREENS.BRIEF) {
    plane.position.copy(flight.state.position);
    plane.quaternion.copy(flight.state.quaternion);
    rig.update(flight.state, dt, time);
    updateWorld(dt);
    hud.draw({ hideHud: true, stage: drawBrief });
  } else if (screen === SCREENS.FLY || screen === SCREENS.PAUSE) {
    if (screen === SCREENS.FLY) stepFlight(dt);
    plane.position.copy(flight.state.position);
    plane.quaternion.copy(flight.state.quaternion);
    cockpit.group.visible = rig.mode === 'cockpit';
    setCockpitShell(rig.mode === 'cockpit');
    rig.update(flight.state, dt, time);
    updateWorld(dt);
    cockpit.update(flight.state, dt, activeGates, mission ? mission.gateIndex : 0);
    if (screen === SCREENS.FLY) {
      hud.draw({
        flight: flight.state,
        mission,
        gateScreen: activeGateScreen(),
        warnings: warnings(),
        radio: mission?.radio,
        wind: weather.wind,
        weatherLabel: weather.label,
        flash: crashFlash,
        engine: flight.state.engineOn ? (flight.state.engineStarting > 0 ? 'START' : 'ON') : 'OUT',
        touchdown: flight.state.onGround && flight.state.touchdownAt !== null && flight.state.time - flight.state.touchdownAt < 4
          ? `TOUCHDOWN · ${flight.state.landingGrade} · ${Math.round(flight.state.touchdownRate * 196.85)} FPM`
          : null,
        groundPrompt: groundPrompt(),
        keys: elapsed < 10 || showHelp ? input.activeKeys() : null,
      });
    } else {
      hud.draw({
        flight: flight.state,
        mission,
        gateScreen: activeGateScreen(),
        warnings: [],
        stage: drawPause,
      });
    }
  } else if (screen === SCREENS.RESULT) {
    plane.position.copy(flight.state.position);
    plane.quaternion.copy(flight.state.quaternion);
    rig.update(flight.state, dt, time);
    updateWorld(dt);
    hud.draw({
      flight: flight.state,
      mission,
      gateScreen: activeGateScreen(),
      warnings: [],
      stage: drawResult,
    });
  }
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------------------------
// Typography for the title, briefing, pause and result cards.

function wrap(g, text, x, y, maxWidth, lineHeight, align = 'left') {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  g.textAlign = align;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxWidth && line) {
      g.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) g.fillText(line, x, yy);
  return yy;
}

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function activateTitle() {
  if (menuIndex === 0 || menuIndex === 1) beginMission(selected);
  else if (menuIndex === 2) menuPanel = 'settings';
  else if (menuIndex === 3) menuPanel = 'achievements';
  else { menuToast = 'Cierra la pestaña para salir'; menuToastUntil = performance.now() + 4000; }
}

function drawTitle(g, W, H, s) {
  titleHits = [];
  const panel = (x, y, w, h, r = 12, fill = 'rgba(9,15,18,0.62)') => {
    roundRect(g, x, y, w, h, r);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 1;
    g.stroke();
  };
  const icon = (kind, x, y, size, color = '#f3ead8') => {
    g.save();
    g.translate(x, y);
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = Math.max(1.4, size * 0.09);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (kind === 'play') {
      g.beginPath(); g.arc(0, 0, size * 0.5, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-size * 0.13, -size * 0.22); g.lineTo(size * 0.24, 0); g.lineTo(-size * 0.13, size * 0.22); g.closePath(); g.fill();
    } else if (kind === 'mountain') {
      g.beginPath(); g.moveTo(-size * 0.48, size * 0.28); g.lineTo(-size * 0.08, -size * 0.3); g.lineTo(size * 0.13, 0); g.lineTo(size * 0.28, -size * 0.16); g.lineTo(size * 0.5, size * 0.28); g.closePath(); g.stroke();
    } else if (kind === 'gear') {
      g.beginPath(); g.arc(0, 0, size * 0.22, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath(); g.moveTo(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3); g.lineTo(Math.cos(a) * size * 0.48, Math.sin(a) * size * 0.48); g.stroke();
      }
    } else if (kind === 'bars') {
      g.strokeStyle = color; g.lineWidth = size * 0.12;
      for (let i = 0; i < 3; i += 1) { const h = size * (0.22 + i * 0.14); g.beginPath(); g.moveTo(-size * 0.25 + i * size * 0.25, size * 0.3); g.lineTo(-size * 0.25 + i * size * 0.25, size * 0.3 - h); g.stroke(); }
    } else if (kind === 'exit') {
      g.strokeRect(-size * 0.38, -size * 0.4, size * 0.45, size * 0.8);
      g.beginPath(); g.moveTo(-size * 0.02, 0); g.lineTo(size * 0.42, 0); g.stroke();
      g.beginPath(); g.moveTo(size * 0.2, -size * 0.16); g.lineTo(size * 0.42, 0); g.lineTo(size * 0.2, size * 0.16); g.stroke();
    } else if (kind === 'person') {
      g.beginPath(); g.arc(0, -size * 0.18, size * 0.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, size * 0.3, size * 0.38, Math.PI, 0); g.fill();
    } else if (kind === 'pin') {
      g.beginPath(); g.arc(0, -size * 0.12, size * 0.22, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(0, size * 0.42); g.lineTo(-size * 0.18, size * 0.05); g.lineTo(size * 0.18, size * 0.05); g.closePath(); g.fill();
    } else if (kind === 'coin') {
      g.beginPath(); g.arc(0, 0, size * 0.36, 0, Math.PI * 2); g.fillStyle = '#ffc65c'; g.fill();
      g.fillStyle = '#8a6420'; g.font = `700 ${size * 0.4}px "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 0);
    } else if (kind === 'arrow') {
      g.beginPath(); g.moveTo(-size * 0.4, 0); g.lineTo(size * 0.38, 0); g.stroke();
      g.beginPath(); g.moveTo(size * 0.1, -size * 0.22); g.lineTo(size * 0.4, 0); g.lineTo(size * 0.1, size * 0.22); g.stroke();
    } else if (kind === 'plane') {
      g.beginPath(); g.moveTo(-size * 0.45, 0); g.lineTo(size * 0.35, 0); g.lineTo(size * 0.45, size * 0.08); g.lineTo(size * 0.05, size * 0.08); g.lineTo(0, size * 0.32); g.lineTo(-size * 0.08, size * 0.32); g.lineTo(-size * 0.04, size * 0.08); g.lineTo(-size * 0.28, size * 0.08); g.lineTo(-size * 0.38, size * 0.2); g.lineTo(-size * 0.45, size * 0.2); g.closePath(); g.fill();
    }
    g.restore();
  };

  const grad = g.createLinearGradient(0, 0, W * 0.56, 0);
  grad.addColorStop(0, 'rgba(5,9,12,0.7)');
  grad.addColorStop(0.55, 'rgba(5,9,12,0.24)');
  grad.addColorStop(1, 'rgba(5,9,12,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Wordmark and wing.
  const lx = 48 * s;
  const ly = 42 * s;
  g.save();
  g.translate(lx, ly);
  g.fillStyle = '#f7efe0';
  g.beginPath();
  g.moveTo(0, 26 * s);
  g.bezierCurveTo(42 * s, -8 * s, 112 * s, -7 * s, 158 * s, 16 * s);
  g.bezierCurveTo(118 * s, 7 * s, 58 * s, 9 * s, 22 * s, 34 * s);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(95 * s, 5 * s); g.lineTo(111 * s, -26 * s); g.lineTo(120 * s, -3 * s); g.lineTo(144 * s, -12 * s); g.lineTo(128 * s, 14 * s); g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = '#f7efe0';
  g.font = `italic 900 ${43 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'left';
  g.letterSpacing = `${2 * s}px`;
  g.fillText('WINDWARD', 226 * s, 74 * s);
  g.letterSpacing = `${5 * s}px`;
  g.fillStyle = 'rgba(247,239,224,0.75)';
  g.font = `600 ${10 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('FLY  ·  EXPLORE  ·  SURVIVE', 228 * s, 96 * s);
  g.letterSpacing = '0px';

  // Profile card.
  const pw = 356 * s;
  const px = W - pw - 30 * s;
  const py = 26 * s;
  panel(px, py, pw, 78 * s, 12, 'rgba(14,20,24,0.62)');
  g.fillStyle = 'rgba(255,255,255,0.1)';
  g.beginPath(); g.arc(px + 36 * s, py + 39 * s, 24 * s, 0, Math.PI * 2); g.fill();
  icon('person', px + 36 * s, py + 39 * s, 30 * s, '#d6d0c2');
  g.textAlign = 'left';
  g.fillStyle = '#f3ead8';
  g.font = `700 ${14 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('JefersonYaan', px + 70 * s, py + 32 * s);
  g.fillStyle = 'rgba(255,241,210,0.55)';
  g.font = `500 ${10 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('Nivel 12', px + 70 * s, py + 47 * s);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(px + 70 * s, py + 54 * s, 190 * s, 4 * s);
  g.fillStyle = '#6fdcae';
  g.fillRect(px + 70 * s, py + 54 * s, 126 * s, 4 * s);
  icon('coin', px + pw - 62 * s, py + 38 * s, 22 * s);
  g.fillStyle = '#ffd479';
  g.font = `700 ${13 * s}px "SF Mono", Consolas, monospace`;
  g.textAlign = 'right';
  g.fillText('2,450', px + pw - 14 * s, py + 43 * s);

  // Left menu.
  const mx = 34 * s;
  const mw = 400 * s;
  const my = 286 * s;
  const items = [
    ['play', 'Continuar', `Misión: ${missions[selected].name}`],
    ['mountain', 'Nueva Partida', 'Elige una misión'],
    ['gear', 'Configuración', 'Clima, cámara y controles'],
    ['bars', 'Logros', 'Progreso del piloto'],
    ['exit', 'Salir', 'Cerrar la sesión'],
  ];
  items.forEach(([kind, label, sub], i) => {
    const y = my + i * 58 * s;
    const active = i === menuIndex;
    titleHits.push({ x: mx, y, w: mw, h: 54 * s, menu: i });
    if (active) {
      roundRect(g, mx, y, mw, 54 * s, 8);
      const hg = g.createLinearGradient(mx, y, mx + mw, y);
      hg.addColorStop(0, 'rgba(72,142,101,0.42)');
      hg.addColorStop(1, 'rgba(26,48,40,0.2)');
      g.fillStyle = hg; g.fill();
      g.strokeStyle = 'rgba(126,230,177,0.28)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#76e0af';
      g.fillRect(mx, y + 7 * s, 3 * s, 40 * s);
    }
    g.fillStyle = active ? '#f5edda' : 'rgba(245,237,218,0.78)';
    icon(kind, mx + 34 * s, y + 27 * s, 22 * s, active ? '#f5edda' : 'rgba(245,237,218,0.7)');
    g.textAlign = 'left';
    g.font = `${active ? 700 : 500} ${17 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillStyle = active ? '#f5edda' : 'rgba(245,237,218,0.78)';
    g.fillText(label, mx + 62 * s, y + 24 * s);
    g.font = `400 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillStyle = active ? 'rgba(245,237,218,0.6)' : 'rgba(245,237,218,0.34)';
    g.fillText(sub, mx + 62 * s, y + 40 * s);
    if (active) {
      g.strokeStyle = 'rgba(245,237,218,0.5)';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(mx + mw - 22 * s, y + 22 * s); g.lineTo(mx + mw - 14 * s, y + 27 * s); g.lineTo(mx + mw - 22 * s, y + 32 * s); g.stroke();
    }
  });

  // Mission card.
  const cw = 340 * s;
  const cx = W - cw - 30 * s;
  const cy = 120 * s;
  const ch = 360 * s;
  panel(cx, cy, cw, ch, 12, 'rgba(12,18,22,0.66)');
  const imgH = 155 * s;
  g.save();
  roundRect(g, cx, cy, cw, imgH, 12);
  g.clip();
  if (menuImage.complete && menuImage.naturalWidth) {
    const scale = Math.max(cw / menuImage.naturalWidth, imgH / menuImage.naturalHeight);
    const dw = menuImage.naturalWidth * scale;
    const dh = menuImage.naturalHeight * scale;
    g.drawImage(menuImage, cx + (cw - dw) / 2, cy + (imgH - dh) / 2, dw, dh);
  } else {
    const imgGrad = g.createLinearGradient(cx, cy, cx + cw, cy + imgH);
    imgGrad.addColorStop(0, '#3b4a5c'); imgGrad.addColorStop(1, '#b07855');
    g.fillStyle = imgGrad; g.fillRect(cx, cy, cw, imgH);
  }
  const shade = g.createLinearGradient(0, cy + imgH * 0.35, 0, cy + imgH);
  shade.addColorStop(0, 'rgba(8,12,15,0)'); shade.addColorStop(1, 'rgba(8,12,15,0.78)');
  g.fillStyle = shade; g.fillRect(cx, cy, cw, imgH);
  g.restore();
  icon('pin', cx + 22 * s, cy + imgH + 22 * s, 13 * s, '#ffd08a');
  g.textAlign = 'left';
  g.fillStyle = '#ffcb86';
  g.font = `600 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('MISIÓN PRINCIPAL', cx + 36 * s, cy + imgH + 26 * s);
  g.fillStyle = '#f5edda';
  g.font = `700 ${19 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText(missions[selected].name, cx + 18 * s, cy + imgH + 51 * s);
  g.fillStyle = 'rgba(245,237,218,0.62)';
  g.font = `400 ${10 * s}px "Helvetica Neue", Arial, sans-serif`;
  wrap(g, missions[selected].brief, cx + 18 * s, cy + imgH + 70 * s, cw - 36 * s, 14 * s);
  g.fillStyle = 'rgba(245,237,218,0.4)';
  g.font = `500 ${8.5 * s}px "SF Mono", Consolas, monospace`;
  g.textAlign = 'right';
  g.fillText('◀ ▶  CAMBIAR MISIÓN', cx + cw - 16 * s, cy + imgH + 51 * s);
  const by = cy + ch - 46 * s;
  titleHits.push({ x: cx + 16 * s, y: by, w: cw - 32 * s, h: 32 * s, start: true });
  roundRect(g, cx + 16 * s, by, cw - 32 * s, 32 * s, 6);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.stroke();
  icon('arrow', cx + 40 * s, by + 16 * s, 12 * s, '#f5edda');
  g.textAlign = 'center';
  g.fillStyle = '#f5edda';
  g.font = `600 ${11 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('Iniciar Misión', cx + cw / 2 + 8 * s, by + 20 * s);

  // Quick controls.
  const qx = 34 * s;
  const qy = H - 134 * s;
  const qw = 660 * s;
  panel(qx, qy, qw, 88 * s, 10, 'rgba(12,18,22,0.62)');
  g.textAlign = 'left';
  g.fillStyle = 'rgba(245,237,218,0.72)';
  g.font = `600 ${10 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('Controles Rápidos', qx + 16 * s, qy + 20 * s);
  const key = (label, x, y) => {
    roundRect(g, x, y, 22 * s, 22 * s, 4);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.stroke();
    g.fillStyle = '#f5edda';
    g.font = `600 ${10 * s}px "SF Mono", Consolas, monospace`;
    g.textAlign = 'center';
    g.fillText(label, x + 11 * s, y + 15 * s);
  };
  let kx = qx + 18 * s;
  ['W', 'A', 'S', 'D'].forEach((k) => { key(k, kx, qy + 34 * s); kx += 26 * s; });
  g.fillStyle = 'rgba(245,237,218,0.58)';
  g.font = `500 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'left';
  g.fillText('Mover', qx + 18 * s, qy + 72 * s);
  key('↑', qx + 150 * s, qy + 34 * s);
  g.fillText('Ascender', qx + 178 * s, qy + 49 * s);
  key('↓', qx + 276 * s, qy + 34 * s);
  g.fillText('Descender', qx + 304 * s, qy + 49 * s);
  roundRect(g, qx + 412 * s, qy + 34 * s, 34 * s, 22 * s, 4);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.2)'; g.stroke();
  g.fillStyle = '#f5edda'; g.font = `600 ${9 * s}px "SF Mono", Consolas, monospace`; g.textAlign = 'center';
  g.fillText('Esc', qx + 429 * s, qy + 49 * s);
  g.textAlign = 'left'; g.fillStyle = 'rgba(245,237,218,0.58)'; g.font = `500 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('Menú', qx + 454 * s, qy + 49 * s);

  // Speed / altitude dial.
  const gx = W - 146 * s;
  const gy = H - 108 * s;
  const gr = 82 * s;
  g.fillStyle = 'rgba(10,16,20,0.62)';
  g.beginPath(); g.arc(gx, gy, gr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.13)';
  g.lineWidth = 6 * s;
  g.beginPath(); g.arc(gx, gy, gr - 12 * s, Math.PI * 0.72, Math.PI * 2.28); g.stroke();
  g.strokeStyle = '#6fdcae';
  g.beginPath(); g.arc(gx, gy, gr - 12 * s, Math.PI * 0.72, Math.PI * 1.48); g.stroke();
  icon('plane', gx + 2 * s, gy + 2 * s, 34 * s, '#f5edda');
  g.textAlign = 'right';
  g.fillStyle = '#f5edda';
  g.font = `700 ${24 * s}px "SF Mono", Consolas, monospace`;
  g.fillText('248', gx - 38 * s, gy + 4 * s);
  g.fillStyle = 'rgba(245,237,218,0.55)';
  g.font = `600 ${8 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('KM/H', gx - 38 * s, gy + 18 * s);
  g.textAlign = 'left';
  g.fillStyle = '#f5edda';
  g.font = `700 ${19 * s}px "SF Mono", Consolas, monospace`;
  g.fillText('2,430', gx + 34 * s, gy + 4 * s);
  g.fillStyle = 'rgba(245,237,218,0.55)';
  g.font = `600 ${8 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('ALT', gx + 34 * s, gy + 18 * s);

  g.textAlign = 'left';
  g.fillStyle = 'rgba(245,237,218,0.48)';
  g.font = `italic 400 ${13 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('Surca los cielos, descubre un mundo lleno de secretos…', 34 * s, H - 18 * s);

  if (menuPanel) {
    g.fillStyle = 'rgba(5,9,12,0.62)';
    g.fillRect(0, 0, W, H);
    const pw2 = 560 * s;
    const ph2 = 300 * s;
    const x2 = (W - pw2) / 2;
    const y2 = (H - ph2) / 2;
    panel(x2, y2, pw2, ph2, 14, 'rgba(12,18,22,0.92)');
    g.textAlign = 'left';
    g.fillStyle = '#f5edda';
    g.font = `700 ${22 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(menuPanel === 'settings' ? 'Configuración' : 'Logros', x2 + 28 * s, y2 + 44 * s);
    g.fillStyle = 'rgba(245,237,218,0.7)';
    g.font = `400 ${12 * s}px "Helvetica Neue", Arial, sans-serif`;
    if (menuPanel === 'settings') {
      g.fillText(`Clima: ${weather.label}   (T cambia)`, x2 + 28 * s, y2 + 86 * s);
      g.fillText('Sombras y texturas: completas', x2 + 28 * s, y2 + 112 * s);
      g.fillText('Cámara: C   ·   Motor: X   ·   Freno: B', x2 + 28 * s, y2 + 138 * s);
      g.fillText('ENTER o ESC para cerrar', x2 + 28 * s, y2 + ph2 - 28 * s);
    } else {
      g.fillText('· Primer vuelo', x2 + 28 * s, y2 + 88 * s);
      g.fillText('· Aterrizaje suave', x2 + 28 * s, y2 + 114 * s);
      g.fillText('· Motor en marcha', x2 + 28 * s, y2 + 140 * s);
      g.fillText('· Vuelo nocturno', x2 + 28 * s, y2 + 166 * s);
      g.fillText('ENTER o ESC para cerrar', x2 + 28 * s, y2 + ph2 - 28 * s);
    }
  }

  if (menuToast && performance.now() < menuToastUntil) {
    g.textAlign = 'center';
    g.fillStyle = 'rgba(10,16,20,0.8)';
    g.font = `600 ${12 * s}px "Helvetica Neue", Arial, sans-serif`;
    const tw = g.measureText(menuToast).width + 30 * s;
    roundRect(g, W / 2 - tw / 2, H - 86 * s, tw, 28 * s, 5);
    g.fill();
    g.fillStyle = '#f5edda';
    g.fillText(menuToast, W / 2, H - 68 * s);
  }
}

function drawBrief(g, W, H, s) {
  const w = Math.min(760 * s, W - 80 * s);
  const h = 404 * s;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  g.fillStyle = 'rgba(10,15,17,0.82)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,180,92,0.45)';
  g.strokeRect(x + 0.5, y + 0.5, w, h);
  g.fillStyle = PALETTE.amber;
  g.fillRect(x, y, 3 * s, h);

  g.textAlign = 'left';
  g.fillStyle = PALETTE.amber;
  g.font = `700 ${10 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('SORTIE BRIEF', x + 38 * s, y + 44 * s);
  g.fillStyle = PALETTE.cream;
  g.font = `700 ${34 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText(mission.name.toUpperCase(), x + 38 * s, y + 86 * s);
  g.fillStyle = 'rgba(255,241,210,0.82)';
  g.font = `500 ${13.5 * s}px "Helvetica Neue", Arial, sans-serif`;
  wrap(g, mission.brief, x + 38 * s, y + 124 * s, w - 76 * s, 22 * s);
  g.fillStyle = 'rgba(255,241,210,0.5)';
  g.font = `600 ${11 * s}px "SF Mono", Consolas, monospace`;
  const rings = mission.gates.length ? `${mission.gates.length} RINGS` : 'NO RINGS';
  const clock = mission.timeLimit !== null ? formatTime(mission.timeLimit) : 'NO CLOCK';
  const finish = mission.def.landing ? 'LANDING REQUIRED' : 'TIMED RUN';
  const wx = weather.label;
  g.fillText(`${rings}   ${clock}   ${finish}   ${wx}`, x + 38 * s, y + h - 96 * s);
  g.fillStyle = PALETTE.amber;
  g.font = `700 ${12 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('ENTER  FLY', x + 38 * s, y + h - 64 * s);
  g.fillStyle = 'rgba(255,241,210,0.4)';
  g.font = `500 ${11 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.font = `500 ${9.5 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('W/↑ PUSH · S/↓ PULL · A/D ROLL · SHIFT THROTTLE · X ENGINE · B PARK · G GEAR · F FLAPS · C CAMERA · V ASSIST · T WEATHER', x + 38 * s, y + h - 38 * s);
}

function drawPause(g, W, H, s) {
  g.fillStyle = 'rgba(8,12,14,0.55)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.fillStyle = PALETTE.cream;
  g.font = `700 ${46 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('PAUSED', W / 2, H * 0.44);
  g.fillStyle = 'rgba(255,241,210,0.6)';
  g.font = `500 ${13 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('P RESUME     R RESTART     ENTER QUIT TO MENU', W / 2, H * 0.44 + 40 * s);
}

function drawResult(g, W, H, s) {
  const ok = mission?.complete;
  g.fillStyle = 'rgba(8,12,14,0.42)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.fillStyle = ok ? PALETTE.teal : PALETTE.warning;
  g.font = `700 ${12 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText(ok ? 'SORTIE COMPLETE' : 'SORTIE FAILED', W / 2, H * 0.36);
  g.fillStyle = PALETTE.cream;
  g.font = `700 ${44 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText(ok ? 'Home before dark.' : (mission?.failReason ?? 'The coast wins.'), W / 2, H * 0.36 + 56 * s);
  g.fillStyle = 'rgba(255,241,210,0.75)';
  g.font = `600 ${14 * s}px "SF Mono", Consolas, monospace`;
  const score = mission ? mission.score : 0;
  g.fillText(`SCORE ${score}     RINGS ${mission ? mission.gateIndex : 0}/${mission ? mission.gates.length : 0}`, W / 2, H * 0.36 + 102 * s);
  g.fillStyle = PALETTE.amber;
  g.font = `700 ${12 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('ENTER  MENU       R  FLY AGAIN', W / 2, H * 0.36 + 150 * s);
}

// ---------------------------------------------------------------------------------------------
// Screenshot staging: each query is a real game state rendered by the same loop.

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

function stageShot(name) {
  const setups = {
    cover: { mission: 2, position: [-20, 124, 1500], heading: 1, speed: 58, roll: -0.1, pitch: 0.015, camera: 'hero', gate: 0 },
    cockpit: { mission: 2, position: [10, 190, 1700], heading: 0, speed: 57, roll: 0.0, pitch: 0.03, camera: 'cockpit', gate: 0 },
    canyon: { mission: 3, position: [canyonPoint(-1000), 0, -1000], heading: 358, speed: 72, roll: -0.05, pitch: 0.01, camera: 'chase', gate: 4 },
    landing: { mission: 2, position: [-8, 54, 610], heading: 0, speed: 46, roll: 0.0, pitch: -0.04, camera: 'hero', gate: 5 },
    storm: { mission: 6, position: [0, 210, 2300], heading: 0, speed: 60, roll: -0.04, pitch: 0.02, camera: 'hero', gate: 0 },
  };
  const setup = setups[name];
  if (!setup) return false;
  beginMission(setup.mission);
  screen = SCREENS.FLY;
  mission.gateIndex = setup.gate;
  mission.objective = name === 'landing' ? 'Land at Cinder Coast on 36' : mission.def.objective;
  const [x, y0, z] = setup.position;
  const y = name === 'canyon' ? sampleHeight(x, z) + 135 : y0;
  flight.state.position.set(x, y, z);
  flight.state.speed = setup.speed;
  flight.state.throttle = 0.78;
  flight.state.fuel = name === 'landing' ? 28 : 74;
  flight.state.gearDown = name === 'landing' || Boolean(setup.gear);
  flight.state.flaps = setup.flaps ?? (name === 'landing' ? 1 : 0);
  flight.state.crashed = false;
  flight.state.onGround = false;
  flight.state.lastY = y;
  setHeading(flight.state, setup.heading);
  flight.state.heading = setup.heading;
  const e = new THREE.Euler(setup.pitch, THREE.MathUtils.degToRad(-setup.heading), setup.roll, 'YXZ');
  flight.state.quaternion.setFromEuler(e);
  flight.state.bank = setup.roll;
  flight.state.pitchDeg = THREE.MathUtils.radToDeg(setup.pitch);
  plane.position.copy(flight.state.position);
  plane.quaternion.copy(flight.state.quaternion);
  rig.setMode(setup.camera);
  cockpit.group.visible = name === 'cockpit';
  rig.snap(flight.state);
  rig.setMode(setup.camera);
  mission.timeLeft = mission.timeLimit - 63;
  mission.elapsed = 63;
  say(mission, 'TOWER', setup.gear ? 'Runway 36, cleared to land.' : 'Cleared down the coast. Keep her steady.');
  mission.radio = { speaker: 'TOWER', text: setup.gear ? 'Runway 36, cleared to land.' : 'Cleared down the coast. Keep her steady.', age: 0.2 };
  scene.userData.shot = true;
  return true;
}

function canyonPoint(z) {
  return -1520 + Math.sin(z / 690) * 330 + Math.sin(z / 233) * 65;
}

const staged = shot ? stageShot(shot) : false;
if (staged) {
  // Settle the chase camera and let the HUD draw a steady frame.
  for (let i = 0; i < 8; i += 1) rig.update(flight.state, STEP, i * STEP);
  plane.position.copy(flight.state.position);
  plane.quaternion.copy(flight.state.quaternion);
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw, MAX_FRAME);
  accumulator += dt;

  if (staged) {
    time += dt;
    updateWorld(dt);
    plane.position.copy(flight.state.position);
    plane.quaternion.copy(flight.state.quaternion);
    cockpit.group.visible = rig.mode === 'cockpit';
    setCockpitShell(rig.mode === 'cockpit');
    cockpit.update(flight.state, dt, activeGates, mission.gateIndex);
    rig.update(flight.state, 0, time);
    if (window.__camOverride) {
      camera.position.set(...window.__camOverride.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(...window.__camOverride.look);
      camera.fov = window.__camOverride.fov ?? 55;
      camera.updateProjectionMatrix();
    }
    hud.draw({
      flight: flight.state,
      mission,
      gateScreen: activeGateScreen(),
      warnings: [],
      radio: shot === 'cockpit' ? null : mission.radio,
      compact: shot === 'cockpit',
      wind: weather.wind,
      weatherLabel: weather.label,
    });
    renderer.render(scene, camera);
    window.__shotFrames = (window.__shotFrames ?? 0) + 1;
    if (window.__shotFrames > 4) window.__shotReady = true;
    return;
  }

  while (accumulator >= STEP) {
    accumulator -= STEP;
    if (screen === SCREENS.FLY) {
      stepFlight(STEP);
      if (flight.state.crashed && resultDelay > 0) {
        resultDelay -= STEP;
        if (resultDelay <= 0) finishMission(false);
      }
    } else {
      time += STEP;
    }
    updateWorld(STEP);
  }
  if (screen === SCREENS.FLY && flight.state.crashed) {
    // Freeze the sim under the result card once the fireball settles.
  }
  renderFrame(dt);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  hud.resize();
});

window.addEventListener('keydown', () => audio.start(), { once: true });
window.addEventListener('mousedown', () => audio.start(), { once: true });

toTitle();
if (staged) {
  screen = SCREENS.FLY;
  weather.set(mission?.weather ?? 'clear');
  rig.setMode(shot === 'cockpit' ? 'cockpit' : shot === 'canyon' ? 'chase' : 'hero');
  setCockpitShell(shot === 'cockpit');
}
requestAnimationFrame(frame);

// A small handle for play-testing and the screenshot script; not used by the game itself.
window.__windward = {
  start: beginMission,
  fly: startFlying,
  shot: stageShot,
  get screen() { return screen; },
  get mission() { return mission; },
  debug: { scene, camera, renderer, flight, sampleHeight, THREE, plane, rig, weather, get gates() { return activeGates; }, get warnings() { return warnings(); } },
};
