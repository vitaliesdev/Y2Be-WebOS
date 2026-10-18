import { configRead } from './config';
import { addJSONParseFilter } from './hooks/json-parse';
import { removeShorts } from './shorts-filter';

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
