import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import './browser-stubs.js';

const { addJSONParseFilter } = await import('../src/platform/json-parse.ts');
await import('../src/platform/json-stringify.ts');
console.error = () => {};

describe('JSON.parse hook', () => {
  const order = [];
  addJSONParseFilter((r) => {
    order.push(1);
    delete r.adPlacements;
  });
  addJSONParseFilter(() => {
    throw new Error('boom');
  });
  addJSONParseFilter((r) => {
    order.push(3);
    r.seen = true;
  });

  it('runs filters in order and survives a failing one', () => {
    assert.deepEqual(JSON.parse('{"adPlacements":[1],"x":1}'), {
      x: 1,
      seen: true
    });
    assert.deepEqual(order, [1, 3]);
  });

  it('skips primitives and keeps revivers working', () => {
    assert.equal(JSON.parse('true'), true);
    assert.equal(JSON.parse('null'), null);
    assert.equal(order.length, 2);
    assert.equal(JSON.parse('{"a":1}', (k, v) => (k === 'a' ? 2 : v)).a, 2);
  });
});

describe('JSON.stringify hook', () => {
  it('flags playback requests on a copy, even if frozen', () => {
    const body = Object.freeze({
      videoId: 'v',
      playbackContext: Object.freeze({
        contentPlaybackContext: Object.freeze({ html5Preference: 'X' }),
        other: 1
      })
    });
    const out = JSON.parse(JSON.stringify(body));

    assert.equal(
      out.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd,
      true
    );
    assert.equal(out.playbackContext.other, 1);
    assert.equal(
      body.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd,
      undefined
    );
  });

  it('leaves other values alone', () => {
    assert.equal(JSON.stringify({ toJSON: () => 'custom' }), '"custom"');
    assert.equal(JSON.stringify('s'), '"s"');
  });
});
