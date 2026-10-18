import { configRead } from '../../core/config';
import { addJSONParseFilter } from '../../platform/json-parse';
import { removeShorts } from './filter';

addJSONParseFilter((r) => {
  if (!configRead('removeShorts')) return;
  // Player responses are large (streaming formats, captions, storyboards...)
  // and never list Shorts, so don't walk them.
  if (r.streamingData || r.playabilityStatus) return;

  // Covers home, search, subscriptions, their pagination and the sidebar.
  const removed = removeShorts(r);
  if (removed) {
    console.info(`[shorts] Removed ${removed} Shorts element(s)`);
  }
});
