import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findNextSegment,
  getSkipDelay
} from '../src/features/sponsorblock/schedule.js';

const seg = (start, end, category = 'sponsor', actionType = 'skip') => ({
  segment: [start, end],
  category,
  actionType
});

describe('findNextSegment', () => {
  const a = seg(10, 20);
  const b = seg(15, 30);
  const all = ['sponsor', 'intro'];

  it('picks the earliest upcoming segment', () => {
    assert.equal(findNextSegment([b, a], 0, all), a);
  });

  it('includes a segment the playhead is inside of', () => {
    assert.equal(findNextSegment([a], 12, all), a);
  });

  it('chains overlapping segments', () => {
    assert.equal(findNextSegment([a, b], 20, all), b);
  });

  it('ignores a segment that is about to end', () => {
    assert.equal(findNextSegment([a], 19.8, all), null);
  });

  it('skips disabled categories without blocking later ones', () => {
    const intro = seg(40, 50, 'intro');
    assert.equal(findNextSegment([a, intro], 0, ['intro']), intro);
  });

  it('never skips mute segments', () => {
    assert.equal(findNextSegment([seg(5, 8, 'sponsor', 'mute')], 0, all), null);
  });
});

describe('getSkipDelay', () => {
  const a = seg(10, 20);

  it('is immediate inside a segment', () => {
    assert.equal(getSkipDelay(a, 12, 1), 0);
  });

  it('accounts for the playback rate', () => {
    assert.equal(getSkipDelay(a, 0, 2), 5000);
    assert.equal(getSkipDelay(a, 0, 0.5), 20000);
  });

  it('falls back to 1x for an invalid rate', () => {
    assert.equal(getSkipDelay(a, 0, 0), 10000);
  });
});
