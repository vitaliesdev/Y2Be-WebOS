import sha256 from 'tiny-sha256';
import { configAddChangeListener, configRead } from './config';
import { showNotification } from './ui';
import { findNextSegment, getSkipDelay } from './sponsorblock-schedule';

// Copied from https://github.com/ajayyy/SponsorBlock/blob/9392d16617d2d48abb6125c00e2ff6042cb7bebe/src/config.ts#L179-L233
const barTypes = {
  sponsor: {
    color: '#00d400',
    opacity: '0.7',
    name: 'sponsored segment'
  },
  intro: {
    color: '#00ffff',
    opacity: '0.7',
    name: 'intro'
  },
  outro: {
    color: '#0202ed',
    opacity: '0.7',
    name: 'outro'
  },
  interaction: {
    color: '#cc00ff',
    opacity: '0.7',
    name: 'interaction reminder'
  },
  selfpromo: {
    color: '#ffff00',
    opacity: '0.7',
    name: 'self-promotion'
  },
  music_offtopic: {
    color: '#ff9900',
    opacity: '0.7',
    name: 'non-music part'
  },
  preview: {
    color: '#008fd6',
    opacity: '0.7',
    name: 'recap or preview'
  }
};

// Maps each SponsorBlock category to the config option that enables skipping it.
const categoryConfigKeys = {
  sponsor: 'enableSponsorBlockSponsor',
  intro: 'enableSponsorBlockIntro',
  outro: 'enableSponsorBlockOutro',
  interaction: 'enableSponsorBlockInteraction',
  selfpromo: 'enableSponsorBlockSelfPromo',
  music_offtopic: 'enableSponsorBlockMusicOfftopic',
  preview: 'enableSponsorBlockPreview'
};

const sponsorblockAPI = 'https://sponsorblock.inf.re/api';

/**
 * Nearest ancestor of `elm` (exclusive) with the given tag name, or null.
 * (`Element.closest` is not available on all supported webOS versions.)
 * @param {Element} elm
 * @param {string} tagName Uppercase tag name
 * @returns {HTMLElement | null}
 */
function findAncestor(elm, tagName) {
  for (let node = elm.parentElement; node; node = node.parentElement) {
    if (node.tagName === tagName) return node;
  }
  return null;
}

/**
 * Whether `elm` or one of its ancestors hides it (e.g. the player controls
 * fading out).
 * @param {Element} elm
 */
function isHiddenByAncestor(elm) {
  for (
    let node = elm;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (node.classList.contains('zylon-hidden')) return true;
    const style = window.getComputedStyle(node);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Find the element of the progress bar that spans its whole width.
 * @returns {HTMLElement | null}
 */
function findSlider() {
  const last = (selector) => {
    const nodes = document.querySelectorAll(selector);
    return nodes[nodes.length - 1] ?? null;
  };

  // Progress bar with chapters: holds one child per chapter.
  const chapters = last(
    'ytlr-multi-markers-player-bar-renderer [idomkey=progress-bar]'
  );
  if (chapters) return chapters;

  // Progress bar without chapters.
  const slider = last('ytlr-progress-bar [idomkey=slider]');
  if (slider) return slider;

  // Older layouts.
  const nodes = document.querySelectorAll('[idomkey=progress-bar]');
  if (nodes.length === 3) return nodes[2];
  if (nodes.length === 2) return nodes[1].querySelector('[idomkey=slider]');
  return null;
}

class SponsorBlockHandler {
  video = null;
  active = true;

  attachVideoTimeout = null;
  nextSkipTimeout = null;

  slider = null;
  sliderInterval = null;
  sliderKeyHandler = null;
  sliderObserver = null;
  sliderSegmentsOverlay = null;
  // Set when the progress bar has chapters: the overlay goes next to it.
  overlayAnchor = null;
  lastOverlaySig = null;
  overlaySyncInterval = null;
  watchForSlider = null;

  scheduleSkipHandler = null;
  durationChangeHandler = null;
  segments = null;
  skippableCategories = [];

  constructor(videoID) {
    this.videoID = videoID;
  }

  async init() {
    const videoHash = sha256(this.videoID).substring(0, 4);
    const categories = Object.keys(categoryConfigKeys);

    let results;
    try {
      const resp = await fetch(
        `${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(
          JSON.stringify(categories)
        )}`
      );

      // The API responds with 404 when no video matching the hash prefix has segments.
      if (resp.status === 404) {
        results = [];
      } else if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      } else {
        results = await resp.json();
      }
    } catch (err) {
      console.warn(this.videoID, 'Failed to fetch SponsorBlock segments:', err);
      return;
    }

    // The handler may have been destroyed (e.g. user navigated away) while
    // the request was in flight.
    if (!this.active) {
      console.debug(this.videoID, 'Destroyed during fetch, ignoring result');
      return;
    }

    const result = Array.isArray(results)
      ? results.find((v) => v.videoID === this.videoID)
      : undefined;
    console.debug(this.videoID, 'Got it:', result);

    if (!result || !result.segments || !result.segments.length) {
      console.debug(this.videoID, 'No segments found.');
      return;
    }

    this.segments = result.segments;
    this.skippableCategories = this.getSkippableCategories();

    this.scheduleSkipHandler = () => this.scheduleSkip();
    this.durationChangeHandler = () => this.buildOverlay();

    this.attachVideo();
    this.buildOverlay();
  }

  getSkippableCategories() {
    return Object.keys(categoryConfigKeys).filter((category) =>
      configRead(categoryConfigKeys[category])
    );
  }

  /** Re-read the enabled categories from config and reschedule. */
  updateSkippableCategories() {
    this.skippableCategories = this.getSkippableCategories();
    if (this.video && this.segments) this.scheduleSkip();
  }

  attachVideo() {
    clearTimeout(this.attachVideoTimeout);
    this.attachVideoTimeout = null;

    this.video = document.querySelector('video');
    if (!this.video) {
      console.debug(this.videoID, 'No video yet...');
      this.attachVideoTimeout = setTimeout(() => this.attachVideo(), 100);
      return;
    }

    console.debug(this.videoID, 'Video found, binding...');

    this.video.addEventListener('play', this.scheduleSkipHandler);
    this.video.addEventListener('pause', this.scheduleSkipHandler);
    this.video.addEventListener('timeupdate', this.scheduleSkipHandler);
    this.video.addEventListener('seeked', this.scheduleSkipHandler);
    // The skip timeout depends on the playback rate.
    this.video.addEventListener('ratechange', this.scheduleSkipHandler);
    this.video.addEventListener('durationchange', this.durationChangeHandler);
  }

  buildOverlay() {
    if (this.sliderSegmentsOverlay) {
      console.debug('Overlay already built');
      return;
    }

    if (!this.video || !this.video.duration) {
      console.debug('No video duration yet');
      return;
    }

    // Custom tag names: YouTube's renderer (incremental-dom) can adopt foreign
    // `div`s while patching its own tree and wipe their children.
    this.sliderSegmentsOverlay = document.createElement('ytaf-sb-overlay');
    this.sliderSegmentsOverlay.className =
      'ytaf-sponsorblock-segment-container';
    this.renderSegments();

    const addSliderObserver = (ele) => {
      this.sliderObserver.observe(ele, {
        childList: true,
        subtree: true
      });
    };

    const addSliderOverlay = () => {
      const overlay = this.sliderSegmentsOverlay;
      // Restore the segments if something emptied the overlay.
      if (overlay.childElementCount !== this.segments.length) {
        this.renderSegments();
      }
      if (this.overlayAnchor) {
        // YouTube re-renders the chapter bar and its container, dropping any
        // foreign element. Keep the overlay outside its tree, on <body>, and
        // place it over the bar using viewport coordinates.
        if (overlay.parentElement !== document.body) {
          overlay.style.position = 'fixed';
          overlay.style.zIndex = '2000';
          document.body.appendChild(overlay);
        }
        this.syncOverlayPosition();
      } else {
        // Undo the chapter bar placement in case the layout changed.
        if (overlay.parentElement === document.body) {
          overlay.removeAttribute('style');
          this.lastOverlaySig = null;
        }
        this.slider.appendChild(overlay);
      }
    };

    // YouTube may keep removing the overlay; re-adding it on every removal
    // can turn into a remove/re-add loop that hangs the app. Throttle it.
    let readdTimeout = null;
    let syncPending = false;
    const scheduleReaddOverlay = () => {
      if (readdTimeout !== null) return;
      readdTimeout = setTimeout(() => {
        readdTimeout = null;
        if (this.active && this.slider?.isConnected) addSliderOverlay();
      }, 250);
    };

    const stopWatchingForSlider = () => {
      clearInterval(this.sliderInterval);
      this.sliderInterval = null;
      if (this.sliderKeyHandler) {
        document.removeEventListener('keydown', this.sliderKeyHandler, true);
        this.sliderKeyHandler = null;
      }
    };

    const trySlider = () => {
      const slider = findSlider();
      if (!slider) return false; // no slider found yet

      this.slider = slider;
      this.overlayAnchor = findAncestor(
        slider,
        'YTLR-MULTI-MARKERS-PLAYER-BAR-RENDERER'
      );

      const positioned = this.overlayAnchor?.parentElement ?? slider;
      // Without chapters the overlay is absolutely positioned inside the slider.
      if (
        !this.overlayAnchor &&
        window.getComputedStyle(slider).position === 'static'
      ) {
        slider.style.position = 'relative';
      }

      console.debug('slider found...', this.slider, this.overlayAnchor);
      stopWatchingForSlider();
      // Observe the parent so removal of the slider itself is noticed.
      addSliderObserver(positioned.parentElement ?? positioned);
      addSliderOverlay();

      // Showing/hiding the controls doesn't always cause a DOM mutation or a
      // video event (e.g. while paused), so also sync periodically.
      clearInterval(this.overlaySyncInterval);
      this.overlaySyncInterval = this.overlayAnchor
        ? setInterval(() => this.syncOverlayPosition(), 500)
        : null;
      return true;
    };

    // The progress bar is often missing for most of the video (controls
    // hidden), so avoid polling the whole page at a high rate. Poll slowly,
    // and check right after a key press, which is what brings the controls up.
    const watchForSlider = () => {
      stopWatchingForSlider();
      if (trySlider()) return;

      this.sliderInterval = setInterval(trySlider, 1000);
      this.sliderKeyHandler = () => {
        setTimeout(() => {
          if (this.sliderInterval) trySlider();
        }, 150);
      };
      document.addEventListener('keydown', this.sliderKeyHandler, true);
    };
    this.watchForSlider = watchForSlider;

    this.sliderObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.removedNodes)) {
          if (node === this.sliderSegmentsOverlay) {
            console.debug('bringing back segments overlay');
            scheduleReaddOverlay();
          }
          if (node === this.slider || node === this.overlayAnchor) {
            console.debug('slider removed, watching again');
            this.sliderObserver.disconnect();
            watchForSlider();
            return;
          }
        }
      }
      // The chapter bar may have moved or resized. At most once per frame.
      if (this.overlayAnchor && !syncPending) {
        syncPending = true;
        requestAnimationFrame(() => {
          syncPending = false;
          this.syncOverlayPosition();
        });
      }
    });

    watchForSlider();
  }

  /** (Re)create one colored element per segment inside the overlay. */
  renderSegments() {
    const overlay = this.sliderSegmentsOverlay;
    const videoDuration = this.video.duration;

    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

    this.segments.forEach((segment) => {
      const [start, end] = segment.segment;
      const barType = barTypes[segment.category] || {
        color: 'blue'
      };
      const elm = document.createElement('ytaf-sb-segment');
      elm.className = 'ytaf-sponsorblock-segment';
      elm.style['background-color'] = barType.color;
      elm.style['left'] = `${(start / videoDuration) * 100.0}%`;
      elm.style['width'] = `${((end - start) / videoDuration) * 100.0}%`;
      overlay.appendChild(elm);
    });
  }

  /**
   * With a chapter bar, place the <body>-level overlay exactly over the bar
   * and hide it whenever the bar isn't visible.
   */
  syncOverlayPosition() {
    const overlay = this.sliderSegmentsOverlay;
    if (!this.overlayAnchor || !overlay) return;
    if (overlay.childElementCount !== this.segments.length) {
      this.renderSegments();
    }

    // All reads first, then writes, to avoid extra reflows.
    const connected = this.slider?.isConnected ?? false;
    const rect = connected ? this.slider.getBoundingClientRect() : null;
    const hidden = !rect || rect.width === 0 || isHiddenByAncestor(this.slider);

    // The bar element is taller than the visible line, which only fills it
    // while focused. Take the vertical extent from a chapter segment instead.
    const chapter = connected
      ? this.slider.querySelector('[idomkey^="chapter-"]')
      : null;
    const chapterRect = chapter?.getBoundingClientRect();
    const useChapter = chapterRect !== undefined && chapterRect.height > 0;
    const top = useChapter ? chapterRect.top : rect?.top;
    const height = useChapter ? chapterRect.height : rect?.height;

    const sig = hidden
      ? 'hidden'
      : `${rect.left}_${top}_${rect.width}_${height}`;
    if (sig === this.lastOverlaySig) return;
    this.lastOverlaySig = sig;

    const style = overlay.style;
    style.display = hidden ? 'none' : '';
    if (hidden) return;
    style.left = `${rect.left}px`;
    style.top = `${top}px`;
    style.width = `${rect.width}px`;
    style.height = `${height}px`;
  }

  scheduleSkip() {
    clearTimeout(this.nextSkipTimeout);
    this.nextSkipTimeout = null;

    if (!this.active) {
      console.debug(this.videoID, 'No longer active, ignoring...');
      return;
    }

    // The player UI may replace the whole progress bar (e.g. when switching
    // between layouts with and without chapters) out of the observer's sight.
    if (this.slider && !this.slider.isConnected && !this.sliderInterval) {
      console.debug('slider detached, watching again');
      this.sliderObserver?.disconnect();
      this.watchForSlider?.();
    } else {
      // Follow the chapter bar's position (e.g. while controls animate in).
      this.syncOverlayPosition();
    }

    if (this.video.paused) {
      console.debug(this.videoID, 'Currently paused, ignoring...');
      return;
    }

    // Includes a segment the playhead is already inside of (e.g. after a
    // seek), in which case the skip happens immediately.
    const segment = findNextSegment(
      this.segments,
      this.video.currentTime,
      this.skippableCategories
    );

    if (!segment) {
      console.debug(this.videoID, 'No more segments');
      return;
    }

    const end = segment.segment[1];
    const delay = getSkipDelay(
      segment,
      this.video.currentTime,
      this.video.playbackRate
    );
    console.debug(
      this.videoID,
      'Scheduling skip of',
      segment,
      'in',
      delay / 1000
    );

    this.nextSkipTimeout = setTimeout(() => {
      if (!this.active) return;
      if (this.video.paused) {
        console.debug(this.videoID, 'Currently paused, ignoring...');
        return;
      }
      // Guard against a stale timeout (e.g. the user seeked past the segment).
      if (this.video.currentTime >= end) {
        this.scheduleSkip();
        return;
      }

      const skipName = barTypes[segment.category]?.name || segment.category;
      console.debug(this.videoID, 'Skipping', segment);
      showNotification(`Skipping ${skipName}`, 2000, 'indigo');
      this.video.currentTime = end;
      this.scheduleSkip();
    }, delay);
  }

  destroy() {
    console.debug(this.videoID, 'Destroying');

    this.active = false;

    if (this.nextSkipTimeout) {
      clearTimeout(this.nextSkipTimeout);
      this.nextSkipTimeout = null;
    }

    if (this.attachVideoTimeout) {
      clearTimeout(this.attachVideoTimeout);
      this.attachVideoTimeout = null;
    }

    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
      this.sliderInterval = null;
    }

    if (this.sliderKeyHandler) {
      document.removeEventListener('keydown', this.sliderKeyHandler, true);
      this.sliderKeyHandler = null;
    }

    if (this.sliderObserver) {
      this.sliderObserver.disconnect();
      this.sliderObserver = null;
    }

    clearInterval(this.overlaySyncInterval);
    this.overlaySyncInterval = null;

    if (this.sliderSegmentsOverlay) {
      this.sliderSegmentsOverlay.remove();
      this.sliderSegmentsOverlay = null;
    }

    if (this.video) {
      this.video.removeEventListener('play', this.scheduleSkipHandler);
      this.video.removeEventListener('pause', this.scheduleSkipHandler);
      this.video.removeEventListener('timeupdate', this.scheduleSkipHandler);
      this.video.removeEventListener('seeked', this.scheduleSkipHandler);
      this.video.removeEventListener('ratechange', this.scheduleSkipHandler);
      this.video.removeEventListener(
        'durationchange',
        this.durationChangeHandler
      );
    }
  }
}

// When this global variable was declared using let and two consecutive hashchange
// events were fired (due to bubbling? not sure...) the second call handled below
// would not see the value change from first call, and that would cause multiple
// SponsorBlockHandler initializations... This has been noticed on Chromium 38.
// This either reveals some bug in chromium/webpack/babel scope handling, or
// shows my lack of understanding of javascript. (or both)
window.sponsorblock = null;

function uninitializeSponsorblock() {
  if (!window.sponsorblock) {
    return;
  }
  try {
    window.sponsorblock.destroy();
  } catch (err) {
    console.warn('window.sponsorblock.destroy() failed!', err);
  }
  window.sponsorblock = null;
}

function getCurrentURL() {
  return new URL(location.hash.substring(1), location.href);
}

function initializeSponsorblock(videoID) {
  uninitializeSponsorblock();

  if (!configRead('enableSponsorBlock')) {
    console.info('SponsorBlock disabled, not loading');
    return;
  }

  const handler = new SponsorBlockHandler(videoID);
  window.sponsorblock = handler;
  handler.init().catch((err) => {
    console.warn(videoID, 'SponsorBlock init failed:', err);
  });
}

window.addEventListener(
  'hashchange',
  () => {
    const newURL = getCurrentURL();
    // uninitialize sponsorblock when not on `/watch` path, to prevent
    // it from attaching to playback preview video element loaded on
    // home page
    if (newURL.pathname !== '/watch' && window.sponsorblock) {
      console.debug('uninitializing sponsorblock on a non-video page');
      uninitializeSponsorblock();
      return;
    }

    const videoID = newURL.searchParams.get('v');
    const needsReload =
      videoID &&
      (!window.sponsorblock || window.sponsorblock.videoID != videoID);

    console.debug(
      'hashchange',
      videoID,
      window.sponsorblock,
      window.sponsorblock ? window.sponsorblock.videoID : null,
      needsReload
    );

    if (needsReload) {
      initializeSponsorblock(videoID);
    }
  },
  false
);

// Apply config changes to the video currently playing, without waiting for
// the next navigation.
configAddChangeListener('enableSponsorBlock', (evt) => {
  if (!evt.detail.newValue) {
    uninitializeSponsorblock();
    return;
  }

  const url = getCurrentURL();
  const videoID = url.searchParams.get('v');
  if (url.pathname === '/watch' && videoID && !window.sponsorblock) {
    initializeSponsorblock(videoID);
  }
});

for (const key of Object.values(categoryConfigKeys)) {
  configAddChangeListener(key, () => {
    window.sponsorblock?.updateSkippableCategories();
  });
}
