// Pure helpers for SponsorBlock skip scheduling. Kept free of DOM/config
// imports so they can be reasoned about (and tested) in isolation.

// Segments ending within this many seconds of the current time are not worth
// skipping. This also prevents skipping the same segment again when the player
// lands slightly before `end` after a seek.
const END_MARGIN = 0.3;

/**
 * Find the next segment that should be skipped, including one the playhead is
 * currently inside of (e.g. after seeking into it).
 * @param {Array<{segment: [number, number], category: string, actionType?: string}>} segments
 * @param {number} currentTime
 * @param {string[]} skippableCategories
 */
export function findNextSegment(segments, currentTime, skippableCategories) {
  let next = null;
  for (const seg of segments) {
    if (!skippableCategories.includes(seg.category)) continue;
    // Only skip segments meant to be skipped (not e.g. `mute` segments).
    if (seg.actionType && seg.actionType !== 'skip') continue;

    const [start, end] = seg.segment;
    if (end - END_MARGIN <= currentTime) continue;
    if (!next || start < next.segment[0]) next = seg;
  }
  return next;
}

/**
 * Real-time delay in milliseconds until `segment` starts, accounting for the
 * playback rate. Returns 0 if the playhead is already inside the segment.
 * @param {{segment: [number, number]}} segment
 * @param {number} currentTime
 * @param {number} playbackRate
 */
export function getSkipDelay(segment, currentTime, playbackRate) {
  const [start] = segment.segment;
  const rate = playbackRate > 0 ? playbackRate : 1;
  return (Math.max(0, start - currentTime) / rate) * 1000;
}
