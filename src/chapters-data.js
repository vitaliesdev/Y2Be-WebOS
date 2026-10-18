// Pure chapter helpers. Kept free of DOM/config imports so they can be
// reasoned about (and tested) in isolation.

/**
 * Extract chapter start times (seconds) from an InnerTube `next` response,
 * which describes chapters in a `multiMarkersPlayerBarRenderer`.
 * @param {Record<string, unknown>} response
 * @returns {{ videoId: string | null, starts: number[] } | null}
 */
export function extractChapters(response) {
  let chapters = null;
  const stack = [response];

  while (stack.length && !chapters) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object') continue;

    if (Array.isArray(node.chapters) && node.chapters[0]?.chapterRenderer) {
      chapters = node.chapters;
      break;
    }
    for (const key in node) {
      const value = node[key];
      if (value !== null && typeof value === 'object') stack.push(value);
    }
  }

  if (!chapters) return null;

  const starts = chapters
    .map((c) => Number(c?.chapterRenderer?.timeRangeStartMillis) / 1000)
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (starts.length < 2) return null;

  const videoId = response.currentVideoEndpoint?.watchEndpoint?.videoId ?? null;
  return { videoId, starts };
}

/**
 * Chapter start times (seconds) from the relative widths of the chapter
 * elements in the progress bar.
 * @param {number[]} widths
 * @param {number} duration
 * @returns {number[] | null}
 */
export function startsFromWidths(widths, duration) {
  const total = widths.reduce((sum, w) => sum + w, 0);
  if (widths.length < 2 || !(total > 0) || !(duration > 0)) return null;

  let acc = 0;
  return widths.map((w) => {
    const start = (acc / total) * duration;
    acc += w;
    return start;
  });
}

/**
 * Time to seek to for the next/previous chapter, or null if there is none.
 * "Previous" first goes back to the start of the current chapter, like a
 * music player, unless that start was less than 3 seconds ago.
 * @param {number[]} starts Sorted chapter start times
 * @param {number} currentTime
 * @param {'next' | 'prev'} direction
 */
export function getChapterTarget(starts, currentTime, direction) {
  if (direction === 'next') {
    const next = starts.find((s) => s > currentTime + 1);
    return next ?? null;
  }

  let current = -1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= currentTime) current = i;
  }
  if (current === -1) return null;
  if (currentTime - starts[current] > 3) return starts[current];
  return current > 0 ? starts[current - 1] : null;
}
