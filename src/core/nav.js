// Where the app currently is. The TV app routes with the URL hash
// (e.g. `#/watch?v=<id>`).

export function getCurrentURL() {
  return new URL(location.hash.substring(1), location.href);
}

export function isWatchPage() {
  return getCurrentURL().pathname === '/watch';
}

/** @returns {string | null} */
export function getCurrentVideoId() {
  return getCurrentURL().searchParams.get('v');
}
