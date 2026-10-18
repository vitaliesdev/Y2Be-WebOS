import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fireDocumentEvent, storage } from './browser-stubs.js';

// Settings saved by older versions, to check they are migrated.
storage.set('ytaf-configuration', JSON.stringify({ removeShorts: true }));

const { APP_NAME, t } = await import('../src/core/i18n.js');
const config = await import('../src/core/config.js');
const { getKeyColor, onColorKey } = await import('../src/core/remote-keys.js');

describe('i18n', () => {
  it('fills placeholders', () => {
    const text = t('hint.openSettings', { app: APP_NAME });
    assert.ok(text.includes(APP_NAME) && !text.includes('{app}'), text);
  });

  it('falls back to the key', () => {
    assert.equal(t('no.such.key'), 'no.such.key');
  });
});

describe('config', () => {
  it('reads legacy settings and defaults', () => {
    assert.equal(config.configRead('removeShorts'), true);
    assert.equal(config.configRead('enableAdBlock'), true);
    assert.throws(() => config.configRead('nope'));
  });

  it('saves under the new key and notifies listeners', () => {
    let change = null;
    config.configAddChangeListener('enableAdBlock', (evt) => {
      change = evt.detail;
    });
    config.configWrite('enableAdBlock', false);

    assert.deepEqual(change, {
      key: 'enableAdBlock',
      newValue: false,
      oldValue: true
    });
    assert.deepEqual(JSON.parse(storage.get('y2be-config') ?? '{}'), {
      removeShorts: true,
      enableAdBlock: false
    });
  });
});

describe('remote keys', () => {
  const key = (type, keyCode, charCode = 0) => {
    const evt = { type, keyCode, charCode, prevented: false };
    evt.preventDefault = () => (evt.prevented = true);
    evt.stopPropagation = () => {};
    return evt;
  };

  it('maps key codes to colors', () => {
    assert.equal(getKeyColor(key('keydown', 405)), 'yellow');
    assert.equal(getKeyColor(key('keydown', 0, 170)), 'yellow');
    assert.equal(getKeyColor(key('keydown', 13)), null);
  });

  it('routes by condition and counts a double code as one press', async () => {
    let onWatchPage = true;
    const calls = [];
    onColorKey(
      'red',
      () => calls.push('chapter'),
      () => onWatchPage
    );
    onColorKey(
      'red',
      () => calls.push('refresh'),
      () => !onWatchPage
    );

    fireDocumentEvent(key('keydown', 403));
    fireDocumentEvent(key('keydown', 0, 166)); // second code, same press
    assert.deepEqual(calls, ['chapter']);

    await new Promise((resolve) => setTimeout(resolve, 320));
    onWatchPage = false;
    fireDocumentEvent(key('keydown', 403));
    assert.deepEqual(calls, ['chapter', 'refresh']);
  });

  it('leaves unhandled colors to the app', () => {
    const evt = key('keydown', 406);
    fireDocumentEvent(evt);
    assert.equal(evt.prevented, false);
  });
});
