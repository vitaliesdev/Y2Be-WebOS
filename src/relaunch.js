// Handle the app being launched again while already running (e.g. a video
// sent from a phone). Imported first so it's registered before any module
// that waits on the page (top-level await).
import { handleLaunch } from './utils';

document.addEventListener(
  'webOSRelaunch',
  (evt) => {
    console.info('RELAUNCH:', evt, window.launchParams);
    handleLaunch(evt.detail);
  },
  true
);
