// Boot and direction: one renderer, one clock, and the screens a sortie passes through. The
// ?shot=... queries stage the four photographs the entry hands in, using the same game systems.
import * as THREE from '../vendor/three.module.min.js';
import { AIRCRAFT, PALETTE, SCREENS, WORLD } from './config.js';
import { createTerrain, createDistantRange, sampleHeight } from './world/terrain.js';
import { createSea } from './world/sea.js';
import { createSky } from './world/sky.js';
import { createAirport } from './world/airport.js';
import { createVegetation } from './world/vegetation.js';
import { createWeather, windVector } from './world/weather.js';
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
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e7b98d');
scene.fog = new THREE.Fog(new THREE.Color('#e8bf97'), WORLD.fog.near, WORLD.fog.far);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.4, 30000);
camera.position.set(0, 240, 3000);

const sky = createSky();
scene.add(sky);
const sea = createSea();
scene.add(sea);
const terrain = createTerrain();
scene.add(terrain);
const airport = createAirport();
scene.add(airport);
scene.add(createVegetation());

const weather = createWeather({ scene, sky, sea });
const plane = createAircraft();
scene.add(plane);
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
const audio = createAudio();
const input = createInput(sceneCanvas);
sceneCanvas.focus();

let screen = SCREENS.TITLE;
let selected = 1;
let mission = null;
let activeGroup = null;
let activeGates = [];
let activeBeacon = null;
let elapsed = 0;
let shake = 0;
let resultDelay = 0;
let showHelp = false;
let lastGround = false;
let time = 0;

const titleFlight = {
  position: new THREE.Vector3(520, 244, 1500),
  quaternion: new THREE.Quaternion(),
  speed: 54,
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
  heading: 318,
  gLoad: 1,
};
setHeading(titleFlight, 318);

function announce(text) {
  statusEl.textContent = text;
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
  weather.set(def.weather ?? 'clear');
  setHeading(flight.state, s.heading);
  flight.state.heading = s.heading;
  rig.snap(flight.state);
  rig.setMode('chase');
  elapsed = 0;
  resultDelay = 0;
  screen = SCREENS.BRIEF;
  say(mission, ...(def.radio?.start ?? ['TOWER', 'Cleared.']));
  announce(`${def.name}. Press Enter to fly.`);
}

function startFlying() {
  screen = SCREENS.FLY;
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
  weather.set('clear');
  rig.setMode('orbit');
  announce('Windward: Cinder Coast. Choose a sortie.');
}

function handleInput() {
  const actions = input.takeActions();
  if (screen === SCREENS.TITLE) {
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) selectMission(selected - 1);
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) selectMission(selected + 1);
    if (actions & ACTIONS.CONFIRM) beginMission(selected);
  } else if (screen === SCREENS.BRIEF) {
    if (actions & ACTIONS.CONFIRM) startFlying();
    if (actions & ACTIONS.PAUSE) toTitle();
  } else if (screen === SCREENS.FLY) {
    if (actions & ACTIONS.PAUSE) screen = SCREENS.PAUSE;
    if (actions & ACTIONS.CAMERA) {
      const order = ['chase', 'cockpit', 'wing'];
      rig.setMode(order[(order.indexOf(rig.mode) + 1) % order.length]);
      cockpit.group.visible = rig.mode === 'cockpit';
    }
    if (actions & ACTIONS.FLIGHTMODE) flight.state.assist = !flight.state.assist;
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
  flight.state.throttle = clamp(flight.state.throttle + input.throttleDelta(dt), 0, 1);
  const controls = { ...a, throttle: flight.state.throttle };
  flight.update(dt, controls, windVector(mission?.wind, time));
  elapsed += dt;
  time += dt;

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

  if (flight.state.onGround && !lastGround) audio.thud(clamp(Math.abs(flight.state.vertical) / 5 + 0.5, 0.4, 1.6));
  lastGround = flight.state.onGround;
  if (flight.state.crashed && screen === SCREENS.FLY) {
    audio.crash();
    resultDelay = 1.9;
  }
}

function updateTitle(dt) {
  time += dt;
  plane.position.copy(titleFlight.position);
  plane.quaternion.copy(titleFlight.quaternion);
  plane.userData.propeller.rotation.z += dt * 26;
  plane.userData.propDisc.rotation.z += dt * 3;
  rig.update(titleFlight, dt, time);
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
  weather.update(dt, camera, flight.state);
  updateGates(activeGates, mission ? mission.gateIndex : 0, time);
  if (activeBeacon && mission && mission.gateIndex >= 2) {
    activeBeacon.userData.column.material.opacity = 0.28 + Math.sin(time * 4) * 0.1;
    activeBeacon.userData.flare.scale.setScalar(18 + Math.sin(time * 3.1) * 3);
  }
  plane.userData.propeller.rotation.z += dt * (18 + flight.state.throttle * 46);
  plane.userData.propDisc.rotation.z += dt * 2.5;
  plane.userData.propDisc.material.opacity = 0.28 + flight.state.throttle * 0.62;
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
        wind: mission?.wind,
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

function drawTitle(g, W, H, s) {
  const grad = g.createLinearGradient(0, 0, W * 0.7, 0);
  grad.addColorStop(0, 'rgba(6,10,12,0.86)');
  grad.addColorStop(0.42, 'rgba(6,10,12,0.6)');
  grad.addColorStop(0.68, 'rgba(6,10,12,0.14)');
  grad.addColorStop(1, 'rgba(6,10,12,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  const x = 92 * s;
  g.textAlign = 'left';
  g.fillStyle = PALETTE.cream;
  g.font = `700 ${74 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.letterSpacing = `${8 * s}px`;
  g.fillText('WINDWARD', x, H * 0.32);
  g.letterSpacing = `${5 * s}px`;
  g.fillStyle = PALETTE.amber;
  g.font = `600 ${15 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('CINDER COAST', x + 3 * s, H * 0.32 + 30 * s);
  g.letterSpacing = '0px';
  g.fillStyle = 'rgba(255,241,210,0.6)';
  g.font = `400 ${14 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('A coastal flight in seven sorties.', x + 3 * s, H * 0.32 + 62 * s);

  g.strokeStyle = 'rgba(255,180,92,0.6)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x + 3 * s, H * 0.32 + 78 * s);
  g.lineTo(x + 330 * s, H * 0.32 + 78 * s);
  g.stroke();

  missions.forEach((m, i) => {
    const y = H * 0.5 + i * 40 * s;
    const active = i === selected;
    if (active) {
      g.fillStyle = 'rgba(255,180,92,0.14)';
      g.fillRect(x - 10 * s, y - 19 * s, 388 * s, 32 * s);
      g.fillStyle = PALETTE.amber;
      g.fillRect(x - 10 * s, y - 19 * s, 2.5 * s, 32 * s);
    }
    g.fillStyle = active ? PALETTE.cream : 'rgba(255,241,210,0.55)';
    g.font = `${active ? 700 : 500} ${17 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(`0${i + 1}`, x, y);
    g.font = `${active ? 600 : 400} ${15 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(m.name.toUpperCase(), x + 44 * s, y);
    g.fillStyle = active ? 'rgba(255,241,210,0.7)' : 'rgba(255,241,210,0.3)';
    g.font = `400 ${10.5 * s}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(m.objective, x + 44 * s, y + 17 * s);
  });

  g.fillStyle = 'rgba(255,241,210,0.45)';
  g.font = `500 ${10.5 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('↑ ↓ SELECT     ENTER FLY     MOUSE FLY · WHEEL THROTTLE', x, H - 46 * s);
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,241,210,0.28)';
  g.fillText('A MAKE.FUN FLIGHT GAME', W - 34 * s, H - 46 * s);
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
  const wx = mission.weather === 'storm' ? 'STORM' : 'CLEAR';
  g.fillText(`${rings}   ${clock}   ${finish}   ${wx}`, x + 38 * s, y + h - 86 * s);
  g.fillStyle = PALETTE.amber;
  g.font = `700 ${12 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('ENTER  FLY', x + 38 * s, y + h - 48 * s);
  g.fillStyle = 'rgba(255,241,210,0.4)';
  g.font = `500 ${11 * s}px "Helvetica Neue", Arial, sans-serif`;
  g.fillText('W/↑ PUSH · S/↓ PULL · A/D ROLL · IJKL ALSO FLY · SHIFT THROTTLE · C CAMERA · V ASSIST · F FLAPS', x + 160 * s, y + h - 47 * s);
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
  g.fillStyle = 'rgba(8,12,14,0.6)';
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
    landing: { mission: 2, position: [-8, 64, 624], heading: 0, speed: 46, roll: 0.0, pitch: -0.04, camera: 'hero', gate: 5 },
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
      wind: mission.wind,
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
  debug: { scene, camera, renderer, flight, sampleHeight, THREE, plane, rig, weather, get gates() { return activeGates; } },
};
