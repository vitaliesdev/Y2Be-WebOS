const webpTestImgs = {
  lossy: 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  lossless: 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  alpha:
    'UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==',
  animation:
    'UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA'
} as const;

function checkWebpFeature(
  feature: keyof typeof webpTestImgs,
  callback: (
    featureName: keyof typeof webpTestImgs,
    isSupported: boolean
  ) => void
) {
  const img = new Image();
  img.onload = function () {
    const result = img.width > 0 && img.height > 0;
    callback(feature, result);
  };

  img.onerror = function () {
    callback(feature, false);
  };

  img.src = 'data:image/webp;base64,' + webpTestImgs[feature];
}

let webpSupported = false;
checkWebpFeature('lossy', (_, support) => {
  webpSupported = support;
});

function rewriteURL(url: URL) {
  const YT_THUMBNAIL_PATHNAME_REGEX =
    /vi(?:_webp)?(\/.*?\/)([a-z0-9]+?)(_\w*?)?\.[a-z]+$/g;

  const YT_TARGET_THUMBNAIL_NAMES = [
    'sddefault',
    'hqdefault',
    'mqdefault',
    'default'
  ] as const;

  const isABTest = url.hostname.match(/^i\d/) !== null;
  // Don't know how to handle A/B test thumbnails so we don't upgrade them.
  if (isABTest) return null;

  const replacementPathname = url.pathname.replace(
    YT_THUMBNAIL_PATHNAME_REGEX,
    (match, p1, p2, p3) => {
      if (!YT_TARGET_THUMBNAIL_NAMES.includes(p2)) return match; // Only rewrite regular thumbnail URLs. Not shorts, etc.
      return `${webpSupported ? 'vi_webp' : 'vi'}${p1}sddefault${p3 ?? ''}.${webpSupported ? 'webp' : 'jpg'}`;
    }
  );
  if (url.pathname === replacementPathname)
    // pathname not changed because not a regular thumbnail or already upgraded.
    return null;

  url = new URL(url);

  url.pathname = replacementPathname;
  url.search = '';

  return url;
}

function parseCSSUrl(value: string): URL | undefined {
  try {
    return new URL(value.slice(4, -1).replace(/["']/g, ''));
  } catch (e) {
    return undefined; // Not a valid URL
  }
}

async function upgradeBgImg(element: HTMLElement) {
  const style = element.style;
  const old = parseCSSUrl(style.backgroundImage);
  if (!old) return;

  const target = rewriteURL(old);
  if (!target) return;

  const lazyLoader = new Image();

  lazyLoader.onload = () => {
    // Don't swap if a placeholder thumbnail was provided.
    // Placeholder thumbnails are the same size as the "default" size.
    if (lazyLoader.naturalHeight === 90) return;

    const curr = parseCSSUrl(style.backgroundImage);
    if (!curr) return;

    // Don't swap out element image if it has been changed while target image was loading.
    if (curr.href !== old.href) return;

    style.backgroundImage = `url(${target.href})`;
  };

  lazyLoader.src = target.href;
}

const YT_THUMBNAIL_ELEMENT_TAG = 'YTLR-THUMBNAIL-DETAILS';

// Reused to parse the previous `style` attribute of mutated elements.
const dummy = document.createElement('div');

function isThumbnail(node: Node): node is HTMLElement {
  // Cheap tag check first: this runs for every style change on the page.
  return (
    node.nodeName === YT_THUMBNAIL_ELEMENT_TAG && node instanceof HTMLElement
  );
}

const obs = new MutationObserver((mutations) => {
  for (const mut of mutations) {
    if (mut.type === 'attributes') {
      // handle backgroundImage change
      // YT re-uses thumbnail elements in its virtual list implementation.
      const node = mut.target;
      if (!isThumbnail(node) || node.style.backgroundImage === '') continue;

      dummy.style.cssText = mut.oldValue ?? '';
      if (node.style.backgroundImage !== dummy.style.backgroundImage) {
        upgradeBgImg(node);
      }
    } else {
      // handle element add
      for (const added of Array.from(mut.addedNodes)) {
        if (!(added instanceof HTMLElement)) continue;

        const thumbnails: HTMLElement[] = isThumbnail(added) ? [added] : [];
        thumbnails.push(
          ...Array.from(
            added.getElementsByTagName(YT_THUMBNAIL_ELEMENT_TAG.toLowerCase())
          ).filter((elem): elem is HTMLElement => elem instanceof HTMLElement)
        );

        for (const elem of thumbnails) {
          if (elem.style.backgroundImage !== '') upgradeBgImg(elem);
        }
      }
    }
  }
});

function enableObserver() {
  obs.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style'],
    attributeOldValue: true
  });
}

import { configRead, configAddChangeListener } from './config';

if (configRead('upgradeThumbnails')) enableObserver();

// The listener receives the change event, not the new value.
configAddChangeListener('upgradeThumbnails', (evt) =>
  (evt as CustomEvent<{ newValue: boolean }>).detail.newValue
    ? enableObserver()
    : obs.disconnect()
);
