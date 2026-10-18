import { configRead } from './config';
import { addJSONParseFilter } from './hooks/json-parse';

addJSONParseFilter((res) => {
  if (!configRead('removeEndscreen')) return;

  const endscreen = res.endscreen;
  if (
    endscreen !== null &&
    typeof endscreen === 'object' &&
    'endscreenRenderer' in endscreen
  ) {
    console.debug('Removed endscreen from JSON response', endscreen);
    delete res.endscreen;
  }
});
