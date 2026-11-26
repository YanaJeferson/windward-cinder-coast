// Three sorties over the same coast: the mail run, the canyon trial and a rescue in failing light.
// A mission owns its gates, its clock and the radio lines that give the flight a reason.
import * as THREE from '../../vendor/three.module.min.js';
import { sampleHeight } from '../world/terrain.js';
import { WORLD } from '../config.js';

const canyonX = (z) => -1520 + Math.sin(z / 690) * 330 + Math.sin(z / 233) * 65;

export function createMissions() {
  return [
    {
      id: 'dawn-ferry',
      name: 'Dawn Ferry',
      objective: 'Thread the coast rings, then land on 36',
      brief: 'The mail has to reach Port Meridian before the wind turns. Follow the headlands, keep the rings on your wing and put the Petrel back on the strip.',
      start: { x: 0, y: 238, z: 2050, heading: 0, speed: 60, fuel: 100, gear: false, flaps: 0 },
      timeLimit: 300,
      landing: true,
      gates: [
        { position: new THREE.Vector3(0, 172, 1120), heading: 0, radius: 27 },
        { position: new THREE.Vector3(760, 152, 560), heading: 52, radius: 25 },
        { position: new THREE.Vector3(1460, 128, -180), heading: 18, radius: 25 },
        { position: new THREE.Vector3(1010, 186, -1060), heading: 330, radius: 25 },
        { position: new THREE.Vector3(250, 225, -520), heading: 246, radius: 25 },
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
      objective: 'Run the canyon gates below the rim',
      brief: 'The river cut a corridor through the Cinder range and the survey team left their markers in it. Fly the line, stay under the rim, and do not touch the rock.',
      start: { x: canyonX(1750), y: 260, z: 1750, heading: 0, speed: 66, fuel: 88, gear: false, flaps: 0 },
      timeLimit: 190,
      landing: false,
      gates: [1000, 420, -160, -760, -1360, -1960].map((z, i) => {
        const x = canyonX(z);
        return {
          position: new THREE.Vector3(x, sampleHeight(x, z) + 54 + (i === 2 ? 10 : 0), z),
          heading: 0,
          radius: 19,
        };
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
      objective: 'Reach the flare, then land with what is left',
      brief: 'A fishing boat went quiet off the stacks. Find the flare, mark the position and get back to the strip. You have a little fuel and a falling sun.',
      start: { x: 3150, y: 300, z: 2400, heading: 322, speed: 58, fuel: 42, gear: false, flaps: 0 },
      timeLimit: 260,
      landing: true,
      gates: [
        { position: new THREE.Vector3(2880, 132, 1860), heading: 330, radius: 26 },
        { position: new THREE.Vector3(2560, 104, 1420), heading: 318, radius: 24 },
        { position: new THREE.Vector3(2080, 150, 610), heading: 292, radius: 24 },
        { position: new THREE.Vector3(980, 196, -40), heading: 276, radius: 26 },
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
        land: ['COAST GUARD', 'They picked up the crew. Good work, Petard.'],
      },
    },
  ];
}

export function createMissionState(def) {
  return {
    def,
    name: def.name,
    objective: def.objective,
    brief: def.brief,
    gates: def.gates,
    gateIndex: 0,
    timeLeft: def.timeLimit,
    timeLimit: def.timeLimit,
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
  state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);

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

  if (state.timeLeft <= 0) {
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
      state.score += 500 + Math.round(state.timeLeft);
      nextLine(state, 'land', 0);
    }
  }

  if (flight.crashed) {
    state.failed = true;
    state.failReason = 'Airframe lost';
  }
}
