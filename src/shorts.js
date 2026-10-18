import { configRead } from './config';
import { addJSONParseFilter } from './hooks/json-parse';
import { removeShorts } from './shorts-filter';

addJSONParseFilter((r) => {
  if (!configRead('removeShorts')) return;

  // Covers home, search, subscriptions, their pagination and the sidebar.
  const removed = removeShorts(r);
  if (removed) {
    console.info(`[shorts] Removed ${removed} Shorts element(s)`);
  }
});
