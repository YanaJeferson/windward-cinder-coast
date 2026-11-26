// Keyboard and mouse. The stick is the keyboard, the throttle is the wheel, and a click captures
// the pointer so the mouse can fly the aircraft as well. One-shot actions are drained each frame.
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
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let actions = 0;
  let wheel = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSteer = false;
  let pointerLocked = false;
  let lastMouse = { x: 0, y: 0 };

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
  };

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) {
      pressed.add(e.code);
      if (codeAction[e.code]) actions |= codeAction[e.code];
      if (e.code === 'Space') actions |= ACTIONS.CONFIRM;
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheel += Math.sign(e.deltaY) * 0.06;
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    actions |= ACTIONS.CONFIRM;
    if (!pointerLocked) canvas.requestPointerLock?.();
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
    mouseSteer = pointerLocked;
  });

  window.addEventListener('mousemove', (e) => {
    if (!pointerLocked) return;
    mouseX += e.movementX;
    mouseY += e.movementY;
    lastMouse = { x: e.movementX, y: e.movementY };
  });

  function axes() {
    const k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
    let pitch = k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp');
    let roll = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    let yaw = k('KeyE') - k('KeyQ');
    if (mouseSteer) {
      pitch += Math.max(-1, Math.min(1, mouseY / 160));
      roll += Math.max(-1, Math.min(1, mouseX / 160));
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
    const has = pressed.has(code);
    return has;
  }

  function endFrame() {
    pressed.clear();
  }

  return { axes, throttleDelta, takeActions, wasPressed, endFrame, start: () => {}, get pointerLocked() { return pointerLocked; } };
}
