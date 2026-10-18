/**
 * Single `JSON.parse` hook shared by every response filter, so each parsed
 * response goes through one wrapper instead of one per feature.
 */

export type JSONParseFilter = (value: Record<string, unknown>) => void;

type JSONReviver = Parameters<typeof JSON.parse>[1];

const filters: JSONParseFilter[] = [];
const originalParse = JSON.parse;

function parse(this: unknown, text: string, reviver?: JSONReviver) {
  const result: unknown = originalParse.call(this, text, reviver);

  // Primitives can't contain anything to filter.
  if (result === null || typeof result !== 'object') return result;

  for (const filter of filters) {
    // A broken filter must not break JSON.parse for the whole app.
    try {
      filter(result as Record<string, unknown>);
    } catch (err) {
      console.error('[json-parse] filter failed:', err);
    }
  }

  return result;
}

JSON.parse = parse;

/**
 * Register a filter that mutates parsed JSON in place. Filters run in
 * registration order.
 */
export function addJSONParseFilter(filter: JSONParseFilter) {
  filters.push(filter);
}
