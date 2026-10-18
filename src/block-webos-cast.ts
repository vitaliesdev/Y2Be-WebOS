// Block YouTube's "wake cast" request, which breaks casting on webOS
// (webosbrew/youtube-webos#343).

const originalFetch = window.fetch.bind(window);

window.fetch = (resource: RequestInfo | URL, init?: RequestInit) => {
  const href = resource instanceof Request ? resource.url : String(resource);
  if (
    href.includes('/wake_cast_core') &&
    new URL(href, location.href).pathname === '/wake_cast_core'
  ) {
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  return originalFetch(resource, init);
};
