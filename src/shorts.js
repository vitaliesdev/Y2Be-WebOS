/* eslint no-redeclare: 0 */
/* global fetch:writable */
import { configRead } from './config';
import { removeShorts } from './shorts-filter';

const origParse = JSON.parse;
JSON.parse = function () {
  const r = origParse.apply(this, arguments);
  if (!configRead('removeShorts')) {
    return r;
  }

  // Covers home, search, subscriptions and their pagination.
  const removed = removeShorts(r);
  if (removed) {
    console.info(`[shorts] Removed ${removed} Shorts element(s)`);
  }

  return r;
};
