// Refresh the current page (e.g. home recommendations) with the red remote
// button, outside the player. While watching, red skips chapters instead
// (see chapter-skip.js).
import { ResolveCommandRegistry } from './app_api';
import { configRead } from './config';
import { showNotification } from './ui';

const RED_CODES = [403, 166];
// Some webOS remotes send two key codes per color button press.
const DOUBLE_PRESS_MS = 300;
let lastRefreshAt = 0;

async function refreshPage() {
  showNotification('Refreshing...', 1500);
  try {
    const registry = await ResolveCommandRegistry.getInstance();
    // YouTube's own "reload the current page's content" signal: refetches
    // without restarting the app.
    registry.dispatchCommand({ signalAction: { signal: 'SOFT_RELOAD_PAGE' } });
  } catch (err) {
    console.warn('[page-refresh] soft reload failed, reloading app:', err);
    location.reload();
  }
}

/** @param {KeyboardEvent} evt */
function keyHandler(evt) {
  if (!RED_CODES.includes(evt.keyCode || evt.charCode)) return;
  if (!configRead('refreshButton')) return;

  const path = new URL(location.hash.substring(1), location.href).pathname;
  if (path === '/watch') return;

  evt.preventDefault();
  evt.stopPropagation();
  if (evt.type !== 'keydown') return;

  const now = Date.now();
  if (now - lastRefreshAt < DOUBLE_PRESS_MS) return;
  lastRefreshAt = now;

  refreshPage();
}

document.addEventListener('keydown', keyHandler, true);
document.addEventListener('keypress', keyHandler, true);
document.addEventListener('keyup', keyHandler, true);
