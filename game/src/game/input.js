// Keyboard and mouse. WASD, IJKL and the arrow keys all fly the aircraft, so the layout of the
// keyboard does not matter; the wheel is the throttle and a click captures the pointer for mouse
// flight. One-shot actions are drained each frame.
export const ACTIONS = {
  CONFIRM: 1,
  PAUSE: 2,
  CAMERA: 4,
  GEAR: 8,
  FLAPS: 16,
  MUTE: 32,
  RESTART: 64,
  HELP: 128,
  FLIGHTMODE: 256,
  ENGINE: 512,
  PARK: 1024,
  WEATHER_NEXT: 2048,
  WEATHER_PREV: 4096,
};

// Letters by their printed key, for keyboards whose physical layout is not QWERTY.
const KEY_TO_CODE = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', q: 'KeyQ', e: 'KeyE',
  i: 'KeyI', j: 'KeyJ', k: 'KeyK', l: 'KeyL',
  c: 'KeyC', g: 'KeyG', f: 'KeyF', m: 'KeyM', p: 'KeyP', r: 'KeyR', h: 'KeyH', v: 'KeyV', x: 'KeyX', b: 'KeyB', t: 'KeyT',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
  ' ': 'Space', enter: 'Enter', escape: 'Escape', '[': 'BracketLeft', ']': 'BracketRight',
};

function codesFor(event) {
  const codes = new Set();
  if (event.code) codes.add(event.code);
  const key = event.key ? event.key.toLowerCase() : '';
  if (KEY_TO_CODE[key]) codes.add(KEY_TO_CODE[key]);
  return codes;
}

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const seen = new Set();
  let actions = 0;
  let wheel = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSteer = false;
  let pointerLocked = false;

  const codeAction = {
    Enter: ACTIONS.CONFIRM,
    NumpadEnter: ACTIONS.CONFIRM,
    KeyP: ACTIONS.PAUSE,
    Escape: ACTIONS.PAUSE,
    KeyC: ACTIONS.CAMERA,
    KeyG: ACTIONS.GEAR,
    KeyF: ACTIONS.FLAPS,
    KeyM: ACTIONS.MUTE,
    KeyR: ACTIONS.RESTART,
    KeyH: ACTIONS.HELP,
    KeyV: ACTIONS.FLIGHTMODE,
    KeyX: ACTIONS.ENGINE,
    KeyB: ACTIONS.PARK,
    BracketRight: ACTIONS.WEATHER_NEXT,
    KeyT: ACTIONS.WEATHER_NEXT,
    BracketLeft: ACTIONS.WEATHER_PREV,
  };

  // Capture on window so a focused element inside the page cannot swallow a flight key.
  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    for (const code of codesFor(event)) {
      if (!keys.has(code) && !seen.has(code)) {
        seen.add(code);
        pressed.add(code);
        if (codeAction[code]) actions |= codeAction[code];
        if (code === 'Space') actions |= ACTIONS.CONFIRM;
      }
      keys.add(code);
    }
  }, { capture: true });

  window.addEventListener('keyup', (event) => {
    for (const code of codesFor(event)) {
      keys.delete(code);
      seen.delete(code);
    }
  }, { capture: true });

  window.addEventListener('blur', () => {
    keys.clear();
    seen.clear();
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    wheel += Math.sign(event.deltaY) * 0.06;
  }, { passive: false });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    canvas.focus();
    actions |= ACTIONS.CONFIRM;
    if (!pointerLocked) canvas.requestPointerLock?.();
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    mouseSteer = pointerLocked;
  });

  window.addEventListener('mousemove', (event) => {
    if (!pointerLocked) return;
    mouseX += event.movementX;
    mouseY += event.movementY;
  });

  function axes() {
    const has = (...codes) => codes.some((code) => keys.has(code));
    // Up/W raises the nose (and climbs); down/S lowers it. This is the keyboard convention the
    // title screen promises, and it keeps the arrows and WASD agreeing with each other.
    let pitch = (has('KeyW', 'ArrowUp', 'KeyI') ? 1 : 0) - (has('KeyS', 'ArrowDown', 'KeyK') ? 1 : 0);
    let roll = (has('KeyD', 'ArrowRight', 'KeyL') ? 1 : 0) - (has('KeyA', 'ArrowLeft', 'KeyJ') ? 1 : 0);
    let yaw = (has('KeyE') ? 1 : 0) - (has('KeyQ') ? 1 : 0);
    if (mouseSteer) {
      pitch += Math.max(-1, Math.min(1, mouseY / 220));
      roll += Math.max(-1, Math.min(1, mouseX / 220));
      mouseX *= 0.55;
      mouseY *= 0.55;
    }
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw: Math.max(-1, Math.min(1, yaw)),
      brake: keys.has('Space'),
    };
  }

  function throttleDelta(dt) {
    let delta = 0;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) delta += 1;
    if (keys.has('ControlLeft') || keys.has('ControlRight')) delta -= 1;
    delta += wheel;
    wheel *= 0.55;
    return delta * dt;
  }

  function takeActions() {
    const a = actions;
    actions = 0;
    return a;
  }

  function wasPressed(code) {
    return pressed.has(code);
  }

  function endFrame() {
    pressed.clear();
  }

  function activeKeys() {
    return [...keys];
  }

  return {
    axes,
    throttleDelta,
    takeActions,
    wasPressed,
    endFrame,
    activeKeys,
    get pointerLocked() { return pointerLocked; },
  };
}
