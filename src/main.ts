import './core/domrect-polyfill';
import './core/relaunch';

import './platform/app-api';
import './features/adblock.js';
import './platform/json-stringify';
import './features/shorts/shorts.js';
// Before modules with top-level await, to see the first video's chapters.
import './features/chapters/chapter-skip';
import './features/page-refresh';
import './features/sponsorblock/sponsorblock.js';
import './ui/ui.js';
import './fixes/font-fix.css';
import './features/thumbnail-quality';
import './fixes/screensaver-fix';
import './fixes/yt-fixes.css';
import './features/clock/clock.js';
import './features/video-quality';
import './fixes/lang-settings-fix';
import './features/remove-endscreen';
import './fixes/block-webos-cast';
import './features/auto-account-select';
