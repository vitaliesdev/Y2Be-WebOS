import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractChapters,
  getChapterTarget,
  startsFromWidths
} from '../src/features/chapters/data.js';

const chapter = (ms) => ({
  chapterRenderer: { title: { simpleText: 'x' }, timeRangeStartMillis: ms }
});

describe('extractChapters', () => {
  it('reads chapters from a next response', () => {
    const response = {
      currentVideoEndpoint: { watchEndpoint: { videoId: 'abc' } },
      playerOverlays: {
        multiMarkersPlayerBarRenderer: {
          markersMap: [
            {
              key: 'DESCRIPTION_CHAPTERS',
              value: {
                chapters: [chapter(0), chapter(60000), chapter(150000)]
              }
            }
          ]
        }
      }
    };
    assert.deepEqual(extractChapters(response), {
      videoId: 'abc',
      starts: [0, 60, 150]
    });
  });

  it('returns null without chapters or with only one', () => {
    assert.equal(extractChapters({ contents: {} }), null);
    assert.equal(extractChapters({ chapters: [chapter(0)] }), null);
  });
});

describe('startsFromWidths', () => {
  it('maps relative widths to start times', () => {
    assert.deepEqual(startsFromWidths([25, 25, 50], 200), [0, 50, 100]);
  });

  it('rejects unusable input', () => {
    assert.equal(startsFromWidths([10], 100), null);
    assert.equal(startsFromWidths([0, 0], 100), null);
  });
});

describe('getChapterTarget', () => {
  const starts = [0, 60, 150, 300];

  it('goes to the next chapter', () => {
    assert.equal(getChapterTarget(starts, 10, 'next'), 60);
    assert.equal(getChapterTarget(starts, 59.5, 'next'), 150);
    assert.equal(getChapterTarget(starts, 310, 'next'), null);
  });

  it('goes back to the current chapter start, then the previous one', () => {
    assert.equal(getChapterTarget(starts, 100, 'prev'), 60);
    assert.equal(getChapterTarget(starts, 61, 'prev'), 0);
    assert.equal(getChapterTarget(starts, 2, 'prev'), null);
  });
});
