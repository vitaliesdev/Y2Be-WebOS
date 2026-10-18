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

class SponsorBlockHandler {
  video = null;
  active = true;

  attachVideoTimeout = null;
  nextSkipTimeout = null;

  slider = null;
  sliderInterval = null;
  sliderObserver = null;
  sliderSegmentsOverlay = null;

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

    const videoDuration = this.video.duration;

    this.sliderSegmentsOverlay = document.createElement('div');
    this.sliderSegmentsOverlay.className =
      'ytaf-sponsorblock-segment-container';

    this.segments.forEach((segment) => {
      const [start, end] = segment.segment;
      const barType = barTypes[segment.category] || {
        color: 'blue'
      };
      const elm = document.createElement('div');
      elm.className = 'ytaf-sponsorblock-segment';
      elm.style['background-color'] = barType.color;
      elm.style['left'] = `${(start / videoDuration) * 100.0}%`;
      elm.style['width'] = `${((end - start) / videoDuration) * 100.0}%`;
      this.sliderSegmentsOverlay.appendChild(elm);
    });

    const addSliderObserver = (ele) => {
      this.sliderObserver.observe(ele, {
        childList: true,
        subtree: true
      });
    };

    const addSliderOverlay = () => {
      this.slider.appendChild(this.sliderSegmentsOverlay);
    };

    const watchForSlider = () => {
      if (this.sliderInterval) clearInterval(this.sliderInterval);

      this.sliderInterval = setInterval(() => {
        const nodes = document.querySelectorAll('[idomkey=progress-bar]');
        const last = nodes[nodes.length - 1];
        switch (nodes.length) {
          case 3: {
            // Slider has chapter markers.
            this.slider = last;
            break;
          }
          case 2: {
            // Slider has no markers or auto-markers
            this.slider = last.querySelector('[idomkey=slider]');
            break;
          }
          default: {
            return; // no slider found yet
          }
        }

        console.debug('slider found...', this.slider);
        clearInterval(this.sliderInterval);
        this.sliderInterval = null;
        addSliderObserver(last);
        addSliderOverlay();
      }, 100);
    };

    this.sliderObserver = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.removedNodes) {
          for (const node of m.removedNodes) {
            if (node === this.sliderSegmentsOverlay) {
              console.debug('bringing back segments overlay');
              addSliderOverlay();
            }
            if (node === this.slider) {
              console.debug('slider removed, watching again');
              this.sliderObserver.disconnect();
              watchForSlider();
            }
          }
        }
      });
    });

    watchForSlider();
  }

  scheduleSkip() {
    clearTimeout(this.nextSkipTimeout);
    this.nextSkipTimeout = null;

    if (!this.active) {
      console.debug(this.videoID, 'No longer active, ignoring...');
      return;
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

    if (this.sliderObserver) {
      this.sliderObserver.disconnect();
      this.sliderObserver = null;
    }

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
