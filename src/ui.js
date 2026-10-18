/*global __APP_VERSION__*/
import {
  configAddChangeListener,
  configGetDesc,
  configOptions,
  configRead,
  configWrite
} from './config.js';
import { APP_NAME, t } from './i18n';
import { isWatchPage } from './nav';
import { requireElement } from './player_api/helpers';
import { onColorKey } from './remote-keys';
import './ui.css';

const KEY_UP = 38;
const KEY_DOWN = 40;
const KEY_OK = 13;
const KEY_BACK = [27, 461];

/**
 * Move focus between the settings panel's checkboxes (a single vertical list).
 * @param {HTMLElement} container
 * @param {1 | -1} step
 */
function moveFocus(container, step) {
  const items = Array.from(container.querySelectorAll('input'));
  if (!items.length) return;

  const current = items.indexOf(document.activeElement);
  const next =
    current === -1 ? (step === 1 ? 0 : items.length - 1) : current + step;
  if (next < 0 || next >= items.length) return;

  items[next].focus();
  items[next].scrollIntoViewIfNeeded(false);
}

function createConfigCheckbox(key) {
  const elmInput = document.createElement('input');
  elmInput.type = 'checkbox';
  elmInput.checked = configRead(key);
  elmInput.addEventListener('change', (evt) => {
    configWrite(key, evt.target.checked);
  });

  configAddChangeListener(key, (evt) => {
    elmInput.checked = evt.detail.newValue;
  });

  const elmLabel = document.createElement('label');
  elmLabel.appendChild(elmInput);
  // Use non-breaking space (U+00A0)
  elmLabel.appendChild(document.createTextNode(' ' + configGetDesc(key)));

  return elmLabel;
}

function createOptionsPanel() {
  const elmContainer = document.createElement('div');

  elmContainer.classList.add('y2be-ui-container');
  elmContainer.style['display'] = 'none';
  elmContainer.setAttribute('tabindex', 0);

  elmContainer.addEventListener(
    'keydown',
    (evt) => {
      if (evt.keyCode === KEY_UP) {
        moveFocus(elmContainer, -1);
      } else if (evt.keyCode === KEY_DOWN) {
        moveFocus(elmContainer, 1);
      } else if (evt.keyCode === KEY_OK) {
        /**
         * The app generates these "OK" events from clicks (including with the
         * Magic Remote), and we don't want to send a duplicate click event for
         * those. It uses the `Event` class instead of `KeyboardEvent`, so
         * check for that.
         */
        if (evt instanceof KeyboardEvent) {
          document.activeElement.click();
        }
      } else if (KEY_BACK.includes(evt.keyCode)) {
        showOptionsPanel(false);
      }

      evt.preventDefault();
      evt.stopPropagation();
    },
    true
  );

  const elmHeading = document.createElement('h1');
  elmHeading.textContent = APP_NAME;
  elmContainer.appendChild(elmHeading);

  /** @type {Record<string, HTMLElement>} */
  const groups = {};
  for (const [key, option] of configOptions) {
    const checkbox = createConfigCheckbox(key);
    if (option.group) {
      if (!groups[option.group]) {
        groups[option.group] = document.createElement('blockquote');
        elmContainer.appendChild(groups[option.group]);
      }
      groups[option.group].appendChild(checkbox);
    } else {
      elmContainer.appendChild(checkbox);
    }
  }

  const elmSponsorLink = document.createElement('small');
  elmSponsorLink.className = 'y2be-ui-sponsor';
  elmSponsorLink.textContent = t('panel.sponsorCredit');
  elmContainer.appendChild(elmSponsorLink);

  const version = document.createElement('div');
  version.className = 'y2be-ui-version';
  version.textContent = `v${__APP_VERSION__}`;
  elmContainer.appendChild(version);

  return elmContainer;
}

const optionsPanel = createOptionsPanel();
document.body.appendChild(optionsPanel);

let optionsPanelVisible = false;

/**
 * Show or hide the settings panel.
 * @param {boolean} visible
 */
function showOptionsPanel(visible) {
  if (visible === optionsPanelVisible) return;

  optionsPanel.style.display = visible ? 'block' : 'none';
  if (visible) optionsPanel.focus();
  else optionsPanel.blur();
  optionsPanelVisible = visible;
}

onColorKey('green', () => showOptionsPanel(!optionsPanelVisible));
onColorKey('blue', () => toggleAudioOnly(), isWatchPage);

const COLOR_MAP = {
  green: 'rgba(0, 162, 0, 0.9)',
  blue: 'rgba(0, 128, 255, 0.9)',
  indigo: 'rgba(75, 0, 130, 0.9)',
  grey: 'rgba(255, 255, 255, 0.5)'
};

export function showNotification(text, time = 3000, color = 'grey') {
  let container = document.querySelector('.y2be-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.classList.add('y2be-notification-container');
    document.body.appendChild(container);
  }

  const elm = document.createElement('div');
  const elmInner = document.createElement('div');
  elmInner.innerText = text;
  elmInner.classList.add('message');
  elmInner.classList.add('message-hidden');
  elmInner.style.borderColor = COLOR_MAP[color] || color;
  elm.appendChild(elmInner);
  container.appendChild(elm);

  setTimeout(() => {
    elmInner.classList.remove('message-hidden');
  }, 100);
  setTimeout(() => {
    elmInner.classList.add('message-hidden');
    setTimeout(() => {
      elm.remove();
    }, 1000);
  }, time);
}

/** Option to hide the site logo in the top right corner. */
function initHideLogo() {
  const style = document.createElement('style');
  document.head.appendChild(style);

  /** @type {(hide: boolean) => void} */
  const setHidden = (hide) => {
    const visibility = hide ? 'hidden' : 'visible';
    style.textContent = `ytlr-redux-connect-ytlr-logo-entity { visibility: ${visibility}; }`;
  };

  setHidden(configRead('hideLogo'));

  configAddChangeListener('hideLogo', (evt) => {
    setHidden(evt.detail.newValue);
  });
}

/**
 * The app adds `app-quality-root` to <body> on some TVs, which turns off the
 * player's transparency effects. Keep them.
 */
function applyUIFixes() {
  const bodyClasses = document.body.classList;
  new MutationObserver(() => {
    if (bodyClasses.contains('app-quality-root')) {
      bodyClasses.remove('app-quality-root');
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

const AUDIO_OVERLAY_SELECTOR = '.ytLrAudioPlayerOverlayAudioMode';
const AUDIO_MESSAGE_CLASS = 'y2be-ui-watchControl-overlayMessage';

let audioOnlyEnabled = false;
/** @type {MutationObserver | null} */
let overlayObserver = null;

/** Hide the video and keep only the sound (blue button). */
async function toggleAudioOnly() {
  audioOnlyEnabled = !audioOnlyEnabled;
  const enabled = audioOnlyEnabled;
  showNotification(t(enabled ? 'audio.on' : 'audio.off'), 2000, 'blue');

  const video = await requireElement('video', HTMLVideoElement);
  // Pressed again while waiting: the later press wins.
  if (enabled !== audioOnlyEnabled) return;
  video.style.visibility = enabled ? 'hidden' : '';

  const applyAudioOverlayFilter = () => {
    const node = document.querySelector(AUDIO_OVERLAY_SELECTOR);
    if (!node) return;
    if (audioOnlyEnabled) {
      node.style.setProperty('filter', 'brightness(0)', 'important');
    } else {
      node.style.removeProperty('filter');
    }
  };

  const controls = await requireElement('[idomkey="controls"]', HTMLElement);
  if (enabled !== audioOnlyEnabled) return;

  const updateOverlay = () => {
    let message = controls.querySelector(`.${AUDIO_MESSAGE_CLASS}`);
    if (!audioOnlyEnabled) {
      message?.remove();
      return;
    }
    if (message) return;

    message = document.createElement('div');
    message.textContent = t('audio.overlay');
    message.className = AUDIO_MESSAGE_CLASS;
    controls.insertBefore(message, controls.firstChild);
  };

  applyAudioOverlayFilter();
  updateOverlay();

  overlayObserver?.disconnect();
  overlayObserver = null;
  if (enabled) {
    // The controls get re-rendered; keep the message and filter applied.
    overlayObserver = new MutationObserver(() => {
      updateOverlay();
      applyAudioOverlayFilter();
    });
    overlayObserver.observe(controls, { childList: true, subtree: true });
  }
}

applyUIFixes();
initHideLogo();

setTimeout(() => {
  showNotification(t('hint.openSettings', { app: APP_NAME }), 2000, 'green');
}, 0);
