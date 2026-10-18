// Color buttons on the remote.
//
// Remotes report a color either in `keyCode` or in `charCode`, and some send
// a second, alternative code for the same press (e.g. 405 and 170 for
// yellow), so both are checked and presses in quick succession count as one.

/** @type {Record<number, 'red' | 'green' | 'yellow' | 'blue'>} */
const COLORS = {
  403: 'red',
  166: 'red',
  404: 'green',
  172: 'green',
  405: 'yellow',
  170: 'yellow',
  406: 'blue',
  167: 'blue',
  191: 'blue'
};

const DOUBLE_PRESS_MS = 300;

/** @param {KeyboardEvent} evt */
export function getKeyColor(evt) {
  return COLORS[evt.keyCode] ?? COLORS[evt.charCode] ?? null;
}

/**
 * @typedef {object} ColorKeyHandler
 * @property {'red' | 'green' | 'yellow' | 'blue'} color
 * @property {() => void} handler
 * @property {() => boolean} when
 */

/** @type {ColorKeyHandler[]} */
const handlers = [];
/** @type {Record<string, number>} */
const lastPress = {};

/**
 * Run `handler` when `color` is pressed and `when()` is true. The first
 * matching handler takes the key; the app never sees it.
 * @param {'red' | 'green' | 'yellow' | 'blue'} color
 * @param {() => void} handler
 * @param {() => boolean} [when]
 */
export function onColorKey(color, handler, when = () => true) {
  handlers.push({ color, handler, when });
}

/** @param {KeyboardEvent} evt */
function listener(evt) {
  const color = getKeyColor(evt);
  if (!color) return;

  const entry = handlers.find((h) => h.color === color && h.when());
  if (!entry) return;

  evt.preventDefault();
  evt.stopPropagation();
  if (evt.type !== 'keydown') return;

  const now = Date.now();
  if (now - (lastPress[color] ?? 0) < DOUBLE_PRESS_MS) return;
  lastPress[color] = now;

  entry.handler();
}

document.addEventListener('keydown', listener, true);
document.addEventListener('keypress', listener, true);
document.addEventListener('keyup', listener, true);
