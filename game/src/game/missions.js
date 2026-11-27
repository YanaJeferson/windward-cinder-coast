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
      name: 'Vuelo Libre',
      kind: 'free',
      objective: 'Despega, explora y vuelve a la 36',
      brief: 'Sin reloj, sin anillos, sin carga. Sal de la 36 con el motor en marcha, sube el Petrel y aprende la costa: el cañón, el volcán, las chimeneas y la pista. Vuelve y déjalo en la 36 cuando hayas tenido bastante. Mantén Mayús para potencia y tira de S/↓ para rotar.',
      start: { x: 0, y: WORLD.runway.elevation + 1.55, z: 420, heading: 0, speed: 0, fuel: 100, ground: true, gear: true, throttle: 1 },
      timeLimit: null,
      landing: true,
      weather: 'clear',
      gates: [],
      radio: {
        start: ['TORRE', 'Cinder Coast despejado. La costa es tuya.'],
        land: ['TORRE', 'Bienvenido de vuelta al suelo.'],
      },
    },
    {
      id: 'first-solo',
      name: 'Primer Solo',
      kind: 'training',
      objective: 'Despega, vuela el circuito y aterriza en la 36',
      brief: 'Vuelo de comprobación con el jefe de pilotos mirando desde el hangar. Motor parado y freno puesto: pulsa X para arrancar, B para soltar el freno, despega de la 36, vuela los tres anillos del circuito y vuelve para un aterrizaje completo.',
      start: { x: 0, y: WORLD.runway.elevation + 1.55, z: 420, heading: 0, speed: 0, fuel: 70, ground: true, gear: true, throttle: 1, engineOff: true, parking: true },
      timeLimit: 420,
      landing: true,
      weather: 'clear',
      gates: [
        at(0, 130, -420, 0, 27),
        at(760, 165, -900, 76, 27),
        at(300, 185, 160, 250, 27),
      ],
      radio: {
        start: ['JEFE', 'El avión es tuyo. A tope, mantenla recta y vuela los números.'],
        gate: [
          ['JEFE', 'Bien. Sube y gira a través.'],
          ['JEFE', 'Dos. Coordina el viraje.'],
          ['JEFE', 'Último anillo. Cuéntame el aterrizaje.'],
        ],
        land: ['JEFE', 'Eso es un chequeo. Firma aquí.'],
      },
    },
    {
      id: 'lost-valley',
      name: 'El Valle Perdido',
      kind: 'mission',
      objective: 'Vuela el valle y aterriza en la 36',
      brief: 'Un valle escondido en el viejo volcán, un lago que nadie cartografió y un pueblo que enciende sus luces al atardecer. Cruza los anillos del valle, encuentra la salida entre las montañas y vuelve a la 36.',
      start: { x: -1750, y: 470, z: 1450, heading: 300, speed: 60, fuel: 95 },
      timeLimit: 480,
      landing: true,
      weather: 'sunset',
      gates: [
        at(-2100, 430, 1050, 300, 28),
        at(-2600, 410, 650, 320, 28),
        at(-2900, 430, 150, 20, 28),
        at(-2500, 460, -300, 120, 28),
        at(-2000, 440, 200, 200, 28),
        at(-1600, 410, 900, 250, 28),
      ],
      radio: {
        start: ['VALLE', 'Bienvenido al valle perdido. Sigue los anillos y no pierdas el lago de vista.'],
        gate: [
          ['VALLE', 'Primer anillo. El pueblo ya está encendiendo las luces.'],
          ['VALLE', 'Segundo. Quédate bajo la cresta.'],
          ['VALLE', 'Tercero. El viejo cráter se abre a tu derecha.'],
          ['VALLE', 'Cuarto. Ahora busca la salida del valle.'],
          ['VALLE', 'Quinto. La costa aparece al sureste.'],
          ['VALLE', 'Último anillo. Vuelve a la 36.'],
        ],
        land: ['VALLE', 'El valle guarda sus secretos. Buen vuelo.'],
      },
    },
    {
      id: 'dawn-ferry',
      name: 'Ferry del Alba',
      kind: 'mission',
      objective: 'Pasa los anillos de la costa y aterriza en la 36',
      brief: 'El correo tiene que llegar a Port Meridian antes de que cambie el viento. Sigue los cabos, lleva los anillos en el ala y devuelve el Petrel a la pista.',
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
        start: ['TORRE', 'Viento flojo del oeste. Pista 36 despejada, tráela a casa.'],
        gate: [
          ['TORRE', 'Primer anillo. Autorizado costa abajo.'],
          ['CORREO', 'Media saca sigue seca. Que siga así.'],
          ['TORRE', 'Acantilados a la derecha. Cuidado con la corriente.'],
          ['TORRE', 'Buena línea. Vuelve hacia la pista.'],
          ['TORRE', 'Último anillo. Informa final.'],
        ],
        land: ['TORRE', 'Bienvenido a casa, Petrel. El correo está a salvo.'],
      },
    },
    {
      id: 'cinder-run',
      name: 'Pasada del Cinder',
      kind: 'race',
      objective: 'Cruza las puertas del cañón bajo la cresta',
      brief: 'El río abrió un corredor en la sierra del Cinder y el equipo topográfico dejó sus marcas. Vuela la línea, no pases de la cresta y no toques la roca.',
      start: { x: canyonX(1750), y: 260, z: 1750, heading: 0, speed: 66, fuel: 88 },
      timeLimit: 190,
      landing: false,
      weather: 'clear',
      gates: [1000, 420, -160, -760, -1360, -1960].map((z, i) => {
        const x = canyonX(z);
        return at(x, sampleHeight(x, z) + 54 + (i === 2 ? 10 : 0), z, 0, 19);
      }),
      radio: {
        start: ['TOPO', 'Marcas activas. El río gira a la izquierda en el puente viejo: síguelo.'],
        gate: [
          ['TOPO', 'Uno. Limpio.'],
          ['TOPO', 'Dos. Vas bajo, pero la línea es buena.'],
          ['TOPO', 'Tres. Cuidado con la cresta después de este.'],
          ['TOPO', 'Cuatro. Mitad del corte.'],
          ['TOPO', 'Cinco. El cañón se abre delante.'],
          ['TOPO', 'Última marca. Sube y trae el material a casa.'],
        ],
        land: ['TOPO', 'Esa es toda la línea. Bonito vuelo.'],
      },
    },
    {
      id: 'long-way-home',
      name: 'El Camino a Casa',
      kind: 'mission',
      objective: 'Llega a la bengala y aterriza con lo que queda',
      brief: 'Un pesquero se quedó en silencio junto a las chimeneas. Encuentra la bengala, marca la posición y vuelve a la pista. Queda poco combustible y el sol baja.',
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
        start: ['SALVAMENTO', 'Petrel, hay una bengala al este de las chimeneas. Encuéntrala antes de que se vaya la luz.'],
        gate: [
          ['SALVAMENTO', 'Sobre la primera chimenea. Mantenla firme.'],
          ['SALVAMENTO', 'Deberías ver la bengala de proa.'],
          ['SALVAMENTO', 'Bien. Márcala y vuelve a casa: queda poco.'],
          ['SALVAMENTO', 'Pista despejada. Directo.'],
        ],
        land: ['SALVAMENTO', 'Recogieron a la tripulación. Buen trabajo, Petrel.'],
      },
    },
    {
      id: 'ring-sprint',
      name: 'Sprint de Anillos',
      kind: 'race',
      objective: 'Ocho anillos, una pasada, sin aterrizar',
      brief: 'Una línea limpia alrededor de la isla: cabos, chimeneas, el viejo volcán y la boca del cañón. Ocho anillos, a fondo, sin carga y sin aterrizar. El reloj es el único pasajero.',
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
        start: ['CONTROL', 'Ocho puertas alrededor de la isla. El reloj corre. Vuela limpio.'],
        gate: [
          ['CONTROL', 'Uno.'],
          ['CONTROL', 'Dos. Mantén la velocidad en el viraje.'],
          ['CONTROL', 'Tres.'],
          ['CONTROL', 'Cuatro. Ojo con la cresta.'],
          ['CONTROL', 'Cinco. Mitad.'],
          ['CONTROL', 'Seis.'],
          ['CONTROL', 'Siete. El último sobre el agua.'],
          ['CONTROL', 'Esa es la línea. Bonito.'],
        ],
        land: ['CONTROL', 'Esa es la línea. Bonito.'],
      },
    },
    {
      id: 'storm-front',
      name: 'Frente de Tormenta',
      kind: 'challenge',
      objective: 'Aterriza en la 36 con viento cruzado',
      brief: 'Un frente entró más rápido de lo previsto. La pista está abierta pero el viento cruza y la lluvia es densa. Vuela la aproximación, mete el morro al viento y déjala en la 36.',
      start: { x: 0, y: 300, z: 3000, heading: 0, speed: 62, fuel: 55 },
      timeLimit: 240,
      landing: true,
      weather: 'storm',
      wind: { from: 250, speed: 9, gust: 4 },
      gates: [],
      radio: {
        start: ['TORRE', 'Viento dos cinco cero, uno ocho con rachas dos seis. Pista 36, autorizado a aterrizar.'],
        land: ['TORRE', 'En el suelo. Sal de la lluvia.'],
      },
    },
    {
      id: 'deadstick',
      name: 'Sin Motor',
      kind: 'challenge',
      objective: 'Planea hasta la 36 y aterriza sin motor',
      brief: 'El motor se paró sobre el estrecho con la pista a cuatro kilómetros. No hay combustible ni arranque. Vuela el planeo, mantén 75 nudos y deja el Petrel en la 36 sin doblarlo.',
      start: { x: 0, y: 900, z: 4000, heading: 0, speed: 56, fuel: 0, engineOff: true },
      timeLimit: null,
      landing: true,
      weather: 'clear',
      gates: [],
      radio: {
        start: ['TORRE', 'Petrel, te vemos planeando. Pista 36 despejada. Mejor planeo, setenta y cinco nudos.'],
        land: ['TORRE', 'Sin motor y en los números. Eso es un aterrizaje.'],
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
    airborne: false,
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
    state.failReason = 'Se acabó el tiempo';
    return;
  }
  if (flight.fuel <= 0 && !flight.onGround) {
    say(state, 'PETREL', 'Sin combustible. Planeando a la pista.');
  }

  if (!flight.onGround) state.airborne = true;

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
          state.objective = 'Circuito completo';
          nextLine(state, 'land', 0);
        } else {
          state.objective = 'Aterriza en Cinder Coast, pista 36';
          say(state, 'TORRE', 'Circuito despejado. Pista 36, aterriza cuando quieras.');
        }
      }
    }
  } else if (state.def.landing && state.airborne) {
    const onRunway = Math.abs(flight.position.x - WORLD.runway.x) < WORLD.runway.width / 2
      && Math.abs(flight.position.z - WORLD.runway.z) < WORLD.runway.length / 2;
    if (flight.onGround && onRunway && flight.speed < 3.2) {
      state.complete = true;
      state.landed = true;
      state.objective = 'Aterrizado';
      state.score += 500 + Math.round(state.timeLeft ?? state.elapsed * 2);
      nextLine(state, 'land', 0);
    } else if (flight.onGround && !onRunway && flight.speed < 2) {
      state.failed = true;
      state.failReason = 'Aterrizaste fuera de la pista';
    }
  }

  if (flight.crashed) {
    state.failed = true;
    state.failReason = 'Avión perdido';
  }
}

/** Compass wind for the HUD: the direction the wind blows from, in degrees. */
export function windLabel(wind) {
  if (!wind) return null;
  return { from: wind.from, speed: wind.speed, gust: wind.gust };
}
