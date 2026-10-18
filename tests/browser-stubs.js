// Minimal stand-ins for the browser globals some modules touch on import.
// Each test file runs in its own process, so these don't leak between files.

/** @type {Map<string, string>} */
export const storage = new Map();

/** @type {Record<string, ((evt: unknown) => void)[]>} */
const documentListeners = {};

/** Dispatch a fake event to the listeners registered on `document`. */
export function fireDocumentEvent(evt) {
  for (const listener of documentListeners[evt.type] ?? []) listener(evt);
}

Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    }
  },
  document: {
    addEventListener: (type, listener) => {
      (documentListeners[type] ??= []).push(listener);
    }
  },
  DocumentFragment: class extends EventTarget {}
});

console.info = () => {};
