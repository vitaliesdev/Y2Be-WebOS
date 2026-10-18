// Skip to the previous/next chapter with the red/yellow remote buttons.
import { configRead } from './config';
import { addJSONParseFilter } from './hooks/json-parse';
import { t } from './i18n';
import { getCurrentVideoId, isWatchPage } from './nav';
import { onColorKey } from './remote-keys';
import { showNotification } from './ui';
import {
  extractChapters,
  getChapterTarget,
  startsFromWidths
} from './chapters-data';

/** @type {{ videoId: string | null, target: number } | null} */
let lastSkip = null;

/** Chapter start times by video ID, from InnerTube `next` responses. */
const chaptersByVideo = new Map();

addJSONParseFilter((r) => {
  // Only `next` responses describe chapters; skip everything else cheaply.
  if (!r.currentVideoEndpoint || !configRead('chapterSkipButtons')) return;

  const result = extractChapters(r);
  if (result?.videoId) {
    chaptersByVideo.set(result.videoId, result.starts);
    // Keep only recent videos.
    if (chaptersByVideo.size > 20) {
      chaptersByVideo.delete(chaptersByVideo.keys().next().value);
    }
  }
});

/** Fallback: read chapters from the progress bar, if it's in the DOM. */
function readChaptersFromBar(duration) {
  const bars = document.querySelectorAll(
    'ytlr-multi-markers-player-bar-renderer [idomkey=progress-bar]'
  );
  const bar = bars[bars.length - 1];
  if (!bar) return null;

  const widths = [];
  for (const el of Array.from(bar.children)) {
    if (!(el.getAttribute('idomkey') ?? '').startsWith('chapter-')) continue;
    const width =
      parseFloat(el.style.width) || el.getBoundingClientRect().width;
    widths.push(width);
  }
  return startsFromWidths(widths, duration);
}

function skipChapter(direction) {
  const video = document.querySelector('video');
  if (!video || !video.duration) return;

  const videoId = getCurrentVideoId();
  const starts =
    (videoId ? chaptersByVideo.get(videoId) : undefined) ??
    readChaptersFromBar(video.duration);

  if (!starts) {
    showNotification(t('chapters.none'));
    return;
  }

  // The player can land slightly before the requested time. Right after a
  // skip, count from the chapter we skipped to, so the next press doesn't
  // target the same chapter again.
  let currentTime = video.currentTime;
  if (
    lastSkip?.videoId === videoId &&
    currentTime < lastSkip.target &&
    currentTime > lastSkip.target - 5
  ) {
    currentTime = lastSkip.target;
  }

  const target = getChapterTarget(starts, currentTime, direction);
  if (target === null || target >= video.duration) {
    showNotification(
      t(direction === 'next' ? 'chapters.noNext' : 'chapters.start')
    );
    return;
  }

  // Prefer the YouTube player's own seek, which handles the TV's media
  // pipeline; setting `currentTime` directly may land on an earlier keyframe.
  const player = document.querySelector('.html5-video-player');
  if (typeof player?.seekTo === 'function') {
    player.seekTo(target, true);
  } else {
    video.currentTime = target;
  }
  lastSkip = { videoId, target };
  showNotification(
    t(direction === 'next' ? 'chapters.next' : 'chapters.prev', {
      n: starts.indexOf(target) + 1,
      total: starts.length,
      time: formatTime(target)
    }),
    2000
  );
}

/** @param {number} seconds */
function formatTime(seconds) {
  const s = Math.floor(seconds);
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

const enabled = () => configRead('chapterSkipButtons') && isWatchPage();
onColorKey('red', () => skipChapter('prev'), enabled);
onColorKey('yellow', () => skipChapter('next'), enabled);
