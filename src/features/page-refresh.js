// Refresh the current page (e.g. home recommendations) with the red remote
// button, outside a video. While watching, red skips chapters instead
// (see chapter-skip.js).
import { ResolveCommandRegistry } from '../platform/app-api';
import { configRead } from '../core/config';
import { t } from '../core/i18n';
import { isWatchPage } from '../core/nav';
import { onColorKey } from '../core/remote-keys';
import { showNotification } from '../ui/ui';

async function refreshPage() {
  showNotification(t('refreshing'), 1500);
  try {
    const registry = await ResolveCommandRegistry.getInstance();
    // The app's own "reload the current page's content" signal: refetches
    // without restarting the app.
    registry.dispatchCommand({ signalAction: { signal: 'SOFT_RELOAD_PAGE' } });
  } catch (err) {
    console.warn('[page-refresh] soft reload failed, reloading app:', err);
    location.reload();
  }
}

onColorKey(
  'red',
  refreshPage,
  () => configRead('refreshButton') && !isWatchPage()
);
