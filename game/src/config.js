// World, palette and aircraft constants. Everything the game shows is generated from these
// numbers: the coast, the airstrip, the gates and the HUD all share one coordinate system.
// Metres and seconds; heading 0 flies north (-Z), 90 east (+X).

export const WORLD = {
  size: 12000,          // terrain square, centred on the airstrip
  seaLevel: 0,
  runway: {
    x: 0,
    z: 0,
    elevation: 30,
    length: 900,
    width: 26,
    heading: 0,         // runway 36 / 18, aligned with north
    threshold: 450,
  },
  sun: { azimuth: 74, elevation: 20 },   // low, warm, ahead-left of the northbound approach
  fog: { near: 2200, far: 10500 },
  gravity: 9.81,
};

export const AIRCRAFT = {
  stallSpeed: 30,       // m/s
  cruiseSpeed: 62,
  maxSpeed: 96,
  minSpeed: 18,
  maxThrust: 8.5,
  drag: 0.0026,
  pitchRate: 0.72,      // rad/s at cruise
  rollRate: 0.95,
  yawRate: 0.5,
  fuelCapacity: 100,
  fuelBurn: 0.42,       // litres-ish per second at full throttle
  maxDamage: 100,
  gearDrag: 1.15,
};

export const PALETTE = {
  ink: '#0d1418',
  cream: '#fff1d2',
  ivory: '#f6e7c8',
  amber: '#ffb45c',
  amberHot: '#ffd08a',
  coral: '#ff6f52',
  teal: '#61d6c9',
  sea: '#2f8b9b',
  seaDeep: '#175d70',
  skyZenith: '#3a7090',
  skyHorizon: '#f6c58c',
  sun: '#ffe6b8',
  grass: '#6f8f45',
  grassDry: '#b39a5c',
  rock: '#7d6349',
  basalt: '#4b4139',
  sand: '#e0c690',
  asphalt: '#2c2d31',
  warning: '#ff5646',
};

export const SCREENS = {
  TITLE: 'title',
  BRIEF: 'brief',
  FLY: 'fly',
  PAUSE: 'pause',
  RESULT: 'result',
};

export const SHOT_QUERIES = {
  cover: '?shot=cover',
  cockpit: '?shot=cockpit',
  canyon: '?shot=canyon',
  landing: '?shot=landing',
};
