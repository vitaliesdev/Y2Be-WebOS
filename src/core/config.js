import { t } from './i18n';

const CONFIG_KEY = 'y2be-config';
// Settings saved by older versions, read once so they aren't lost.
const LEGACY_CONFIG_KEY = 'ytaf-configuration';

/**
 * Options in the order they appear in the settings panel. Labels live in
 * i18n.js under `opt.<key>`. Options with a `group` are shown indented under
 * the option of that name.
 * @type {Map<string, { default: boolean, group?: string }>}
 */
export const configOptions = new Map([
  ['enableAdBlock', { default: true }],
  ['removeShorts', { default: false }],
  ['upgradeThumbnails', { default: false }],
  ['hideLogo', { default: false }],
  ['showWatch', { default: false }],
  ['forceHighResVideo', { default: false }],
  ['removeEndscreen', { default: false }],
  ['autoAccountSelect', { default: false }],
  ['chapterSkipButtons', { default: true }],
  ['refreshButton', { default: true }],
  ['enableSponsorBlock', { default: true }],
  ['enableSponsorBlockSponsor', { default: true, group: 'enableSponsorBlock' }],
  ['enableSponsorBlockIntro', { default: true, group: 'enableSponsorBlock' }],
  ['enableSponsorBlockOutro', { default: true, group: 'enableSponsorBlock' }],
  [
    'enableSponsorBlockInteraction',
    { default: true, group: 'enableSponsorBlock' }
  ],
  [
    'enableSponsorBlockSelfPromo',
    { default: true, group: 'enableSponsorBlock' }
  ],
  [
    'enableSponsorBlockMusicOfftopic',
    { default: true, group: 'enableSponsorBlock' }
  ],
  ['enableSponsorBlockPreview', { default: false, group: 'enableSponsorBlock' }]
]);

const defaultConfig = Object.fromEntries(
  Array.from(configOptions, ([k, v]) => [k, v.default])
);

/** @type {Record<string, DocumentFragment>} */
const configFrags = Object.fromEntries(
  Array.from(configOptions.keys(), (k) => [k, new DocumentFragment()])
);

function loadStoredConfig() {
  const storage =
    window.localStorage.getItem(CONFIG_KEY) ??
    window.localStorage.getItem(LEGACY_CONFIG_KEY);

  if (storage === null) {
    console.info('Config not set; using defaults.');
    return null;
  }

  try {
    return JSON.parse(storage);
  } catch (err) {
    console.warn('Error parsing stored config:', err);
    return null;
  }
}

// Use defaultConfig as a prototype so writes to localConfig don't change it.
const localConfig = Object.assign(
  Object.create(defaultConfig),
  loadStoredConfig()
);

function assertExists(key) {
  if (!configOptions.has(key)) {
    throw new Error('unknown config key: ' + key);
  }
}

export function configGetDesc(key) {
  assertExists(key);
  return t('opt.' + key);
}

export function configRead(key) {
  assertExists(key);
  return localConfig[key];
}

export function configWrite(key, value) {
  assertExists(key);

  const oldValue = localConfig[key];
  console.info('Changing key', key, 'from', oldValue, 'to', value);
  localConfig[key] = value;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...localConfig }));

  configFrags[key].dispatchEvent(
    new CustomEvent('configchange', {
      detail: { key, newValue: value, oldValue }
    })
  );
}

/**
 * Add a listener for changes in the value of a specified config option
 * @param {string} key Config option to monitor
 * @param {(evt: CustomEvent<{ key: string, newValue: boolean, oldValue: boolean }>) => void} callback Function to be called on change
 */
export function configAddChangeListener(key, callback) {
  configFrags[key].addEventListener('configchange', callback);
}
