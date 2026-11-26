// Every way to fly the Cinder Coast: a free patrol, a first solo, the mail run, the canyon trial,
// a rescue, a ring sprint and a storm approach. A mode owns its gates, clock, weather and wind.
import * as THREE from '../../vendor/three.module.min.js';
import { sampleHeight } from '../world/terrain.js';
import { WORLD } from '../config.js';

const canyonX = (z) => -1520 + Math.sin(z / 690) * 330 + Math.sin(z / 233) * 65;

function at(x, y, z, heading, radius = 24) {
  return { position: new THREE.Vector3(x, y, z), heading, radius };
}

export function createMissions() {
  return [
    {
      id: 'free-flight',
      name: 'Free Flight',
      kind: 'free',
      objective: 'Explore the coast. Land back on 36.',
      brief: 'No clock, no gates, no cargo. Take the Petrel up and learn the coast: the canyon, the volcano, the stacks and the strip. Come back and put her down on 36 when you have had enough.',
      start: { x: -20, y: 240, z: 2050, heading: 0, speed: 58, fuel: 100 },
      timeLimit: null,
      landing: true,
      weather: 'clear',
      gates: [],
      radio: {
        start: ['TOWER', 'Cinder Coast clear. The coast is yours.'],
        land: ['TOWER', 'Nice to have you back on the ground.'],
      },
    },
    {
      id: 'first-solo',
      name: 'First Solo',
      kind: 'training',
      objective: 'Take off, fly the circuit, land on 36',
      brief: 'A checkout flight with the chief pilot watching from the shed. Take off from 36, fly the three circuit rings and bring her back for a full-stop landing. Throttle up, keep the ball centred.',
      start: { x: 0, y: WORLD.runway.elevation + 1.55, z: 260, heading: 0, speed: 0, fuel: 70, ground: true, gear: true },
      timeLimit: 420,
      landing: true,
      weather: 'clear',
      gates: [
        at(0, 130, -420, 0, 27),
        at(760, 165, -900, 76, 27),
        at(300, 185, 160, 250, 27),
      ],
      radio: {
        start: ['CHIEF', 'You have the aeroplane. Full throttle, keep her straight, and fly the numbers.'],
        gate: [
          ['CHIEF', 'Good. Climb away and turn crosswind.'],
          ['CHIEF', 'Two. Keep the turn coordinated.'],
          ['CHIEF', 'Last ring. Talk me through the landing.'],
        ],
        land: ['CHIEF', 'That is a checkout. Sign here.'],
      },
    },
    {
      id: 'dawn-ferry',
      name: 'Dawn Ferry',
      kind: 'mission',
      objective: 'Thread the coast rings, then land on 36',
      brief: 'The mail has to reach Port Meridian before the wind turns. Follow the headlands, keep the rings on your wing and put the Petrel back on the strip.',
      start: { x: 0, y: 238, z: 2050, heading: 0, speed: 60, fuel: 100 },
      timeLimit: 300,
      landing: true,
      weather: 'clear',
      gates: [
        at(0, 172, 1120, 0, 27),
        at(760, 152, 560, 52, 25),
        at(1460, 128, -180, 18, 25),
        at(1010, 186, -1060, 330, 25),
        at(250, 225, -520, 246, 25),
      ],
      radio: {
        start: ['TOWER', 'Wind light from the west. Runway 36 is clear — bring her home.'],
        gate: [
          ['TOWER', 'First ring. You are cleared down the coast.'],
          ['MAIL OFFICE', 'That is half the post still dry. Keep it that way.'],
          ['TOWER', 'Cliffs on your right. Watch the downdraught.'],
          ['TOWER', 'Nice line. Turn back toward the strip.'],
          ['TOWER', 'Last ring. Report final.'],
        ],
        land: ['TOWER', 'Welcome home, Petrel. Mail is safe.'],
      },
    },
    {
      id: 'cinder-run',
      name: 'Cinder Run',
      kind: 'race',
      objective: 'Run the canyon gates below the rim',
      brief: 'The river cut a corridor through the Cinder range and the survey team left their markers in it. Fly the line, stay under the rim, and do not touch the rock.',
      start: { x: canyonX(1750), y: 260, z: 1750, heading: 0, speed: 66, fuel: 88 },
      timeLimit: 190,
      landing: false,
      weather: 'clear',
      gates: [1000, 420, -160, -760, -1360, -1960].map((z, i) => {
        const x = canyonX(z);
        return at(x, sampleHeight(x, z) + 54 + (i === 2 ? 10 : 0), z, 0, 19);
      }),
      radio: {
        start: ['SURVEY', 'Markers are live. The river bends left at the old bridge — follow it.'],
        gate: [
          ['SURVEY', 'One. Clean.'],
          ['SURVEY', 'Two. You are low, but the line is good.'],
          ['SURVEY', 'Three. Watch the ridge after this one.'],
          ['SURVEY', 'Four. Halfway through the cut.'],
          ['SURVEY', 'Five. The canyon opens ahead.'],
          ['SURVEY', 'Last marker. Climb out and bring the film home.'],
        ],
        land: ['SURVEY', 'That is the whole line. Beautiful flying.'],
      },
    },
    {
      id: 'long-way-home',
      name: 'The Long Way Home',
      kind: 'mission',
      objective: 'Reach the flare, then land with what is left',
      brief: 'A fishing boat went quiet off the stacks. Find the flare, mark the position and get back to the strip. You have a little fuel and a falling sun.',
      start: { x: 3150, y: 300, z: 2400, heading: 322, speed: 58, fuel: 42 },
      timeLimit: 260,
      landing: true,
      weather: 'clear',
      gates: [
        at(2880, 132, 1860, 330, 26),
        at(2560, 104, 1420, 318, 24),
        at(2080, 150, 610, 292, 24),
        at(980, 196, -40, 276, 26),
      ],
      beacon: { x: 2580, z: 1130 },
      radio: {
        start: ['COAST GUARD', 'Petrel, we have one flare on the water east of the stacks. Find it before the light goes.'],
        gate: [
          ['COAST GUARD', 'Over the first stack. Keep her steady.'],
          ['COAST GUARD', 'You should see the flare off your nose.'],
          ['COAST GUARD', 'Good. Mark it and turn for home — fuel is tight.'],
          ['COAST GUARD', 'Strip is clear. Straight in.'],
        ],
        land: ['COAST GUARD', 'They picked up the crew. Good work, Petrel.'],
      },
    },
    {
      id: 'ring-sprint',
      name: 'Ring Sprint',
      kind: 'race',
      objective: 'Eight rings, one pass, no landing',
      brief: 'A clean line around the whole island: headlands, stacks, the old volcano and the canyon mouth. Eight rings, flat out, no cargo and no landing. The clock is the only passenger.',
      start: { x: 620, y: 210, z: 1750, heading: 318, speed: 72, fuel: 95 },
      timeLimit: 210,
      landing: false,
      weather: 'clear',
      gates: [
        at(900, 150, 900, 330, 27),
        at(1580, 120, 240, 350, 27),
        at(1780, 130, -720, 10, 27),
        at(1250, 180, -1500, 330, 27),
        at(250, 230, -1500, 280, 27),
        at(-500, 210, -760, 250, 27),
        at(-600, 190, 380, 200, 27),
        at(60, 150, 1180, 160, 27),
      ],
      radio: {
        start: ['RACE CONTROL', 'Eight gates around the island. Clock starts now. Fly it clean.'],
        gate: [
          ['RACE CONTROL', 'One.'],
          ['RACE CONTROL', 'Two. Carry the speed through the turn.'],
          ['RACE CONTROL', 'Three.'],
          ['RACE CONTROL', 'Four. Watch the ridge line.'],
          ['RACE CONTROL', 'Five. Halfway.'],
          ['RACE CONTROL', 'Six.'],
          ['RACE CONTROL', 'Seven. Last one over the water.'],
          ['RACE CONTROL', 'That is the line. Beautiful.'],
        ],
        land: ['RACE CONTROL', 'That is the line. Beautiful.'],
      },
    },
    {
      id: 'storm-front',
      name: 'Storm Front',
      kind: 'challenge',
      objective: 'Land on 36 in the crosswind',
      brief: 'A front came in faster than the forecast. The strip is open but the wind is across it and the rain is thick. Fly the approach, keep the nose into the wind and put it down on 36.',
      start: { x: 0, y: 300, z: 3000, heading: 0, speed: 62, fuel: 55 },
      timeLimit: 240,
      landing: true,
      weather: 'storm',
      wind: { from: 250, speed: 9, gust: 4 },
      gates: [],
      radio: {
        start: ['TOWER', 'Wind two five zero, one eight gusting two six. Runway 36, cleared to land.'],
        land: ['TOWER', 'On the ground. Get out of the rain.'],
      },
    },
  ];
}

export function createMissionState(def) {
  return {
    def,
    name: def.name,
    kind: def.kind ?? 'mission',
    objective: def.objective,
    brief: def.brief,
    gates: def.gates,
    gateIndex: 0,
    timeLeft: def.timeLimit ?? null,
    timeLimit: def.timeLimit ?? null,
    elapsed: 0,
    complete: false,
    failed: false,
    landed: false,
    radio: null,
    radioAge: 0,
    radioQueue: [],
    radioDelay: 0,
    beacon: def.beacon ? new THREE.Vector3(def.beacon.x, sampleHeight(def.beacon.x, def.beacon.z) + 4, def.beacon.z) : null,
    nextDistance: 0,
    score: 0,
    weather: def.weather ?? 'clear',
    wind: def.wind ?? null,
  };
}

export function say(state, speaker, text) {
  state.radioQueue.push({ speaker, text });
}

function nextLine(state, kind, index) {
  const lines = state.def.radio?.[kind];
  if (!lines) return;
  const line = Array.isArray(lines[0]) ? lines[Math.min(index, lines.length - 1)] : lines;
  if (line) say(state, line[0], line[1]);
}

export function updateMission(state, flight, dt) {
  if (!state || state.complete || state.failed) return;
  state.elapsed += dt;
  if (state.timeLimit !== null) state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);

  if (state.radioQueue.length > 0) {
    state.radioDelay -= dt;
    if (state.radioDelay <= 0) {
      const next = state.radioQueue.shift();
      state.radio = { speaker: next.speaker, text: next.text, age: 0 };
      state.radioDelay = 2.8;
    }
  }
  if (state.radio) {
    state.radio.age += dt;
    if (state.radio.age > 7) state.radio = null;
  }

  if (state.timeLimit !== null && state.timeLeft <= 0) {
    state.failed = true;
    state.failReason = 'Out of time';
    return;
  }
  if (flight.fuel <= 0 && !flight.onGround) {
    say(state, 'PETREL', 'Fuel is dry — gliding for the strip.');
  }

  const gate = state.gates[state.gateIndex];
  if (gate) {
    const d = flight.position.distanceTo(gate.position);
    state.nextDistance = d;
    if (d < gate.radius * 0.85) {
      state.gateIndex += 1;
      state.score += 100;
      nextLine(state, 'gate', state.gateIndex - 1);
      if (state.gateIndex >= state.gates.length) {
        if (!state.def.landing) {
          state.complete = true;
          state.objective = 'Course complete';
          nextLine(state, 'land', 0);
        } else {
          state.objective = 'Land at Cinder Coast on 36';
          say(state, 'TOWER', 'Course clear. Runway 36, land at your discretion.');
        }
      }
    }
  } else if (state.def.landing) {
    const onRunway = Math.abs(flight.position.x - WORLD.runway.x) < WORLD.runway.width / 2
      && Math.abs(flight.position.z - WORLD.runway.z) < WORLD.runway.length / 2;
    if (flight.onGround && onRunway && flight.speed < 3.2) {
      state.complete = true;
      state.landed = true;
      state.objective = 'Landed';
      state.score += 500 + Math.round(state.timeLeft ?? state.elapsed * 2);
      nextLine(state, 'land', 0);
    }
  }

  if (flight.crashed) {
    state.failed = true;
    state.failReason = 'Airframe lost';
  }
}

/** Compass wind for the HUD: the direction the wind blows from, in degrees. */
export function windLabel(wind) {
  if (!wind) return null;
  return { from: wind.from, speed: wind.speed, gust: wind.gust };
}
