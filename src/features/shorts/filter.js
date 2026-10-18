// Pure Shorts filtering logic. Kept free of config imports so it can be
// reasoned about (and tested) in isolation.

const SHELF_SHORTS = 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS';

function isShortsTile(elm) {
  return elm?.tileRenderer?.onSelectCommand?.reelWatchEndpoint != null;
}

function hasReelEndpoint(node, depth = 0) {
  if (node === null || typeof node !== 'object' || depth > 4) return false;
  for (const key in node) {
    if (key === 'reelWatchEndpoint') return true;
    if (hasReelEndpoint(node[key], depth + 1)) return true;
  }
  return false;
}

// The Shorts entry in the sidebar (guide) plays a reel instead of opening a
// page, so it may have no browseId; match on its endpoint or icon instead.
function isShortsGuideEntry(elm) {
  const entry = elm?.guideEntryRenderer;
  if (!entry) return false;

  const nav = entry.navigationEndpoint;
  if (nav?.browseEndpoint?.browseId === 'FEshorts') return true;
  if (/SHORTS/.test(entry.icon?.iconType ?? '')) return true;
  return hasReelEndpoint(nav);
}

function isShorts(elm) {
  if (isShortsTile(elm) || elm?.reelShelfRenderer != null) return true;
  if (isShortsGuideEntry(elm)) return true;

  const shelf = elm?.shelfRenderer;
  if (!shelf) return false;
  if (shelf.tvhtml5ShelfRendererType === SHELF_SHORTS) return true;

  // Drop shelves that only contain Shorts instead of leaving them empty.
  const items = shelf.content?.horizontalListRenderer?.items;
  return Array.isArray(items) && items.length > 0 && items.every(isShortsTile);
}

/**
 * Remove Shorts tiles and shelves anywhere in a parsed API response, in a
 * single pass. Mutates `root`.
 * @param {unknown} root
 * @returns {number} Number of removed elements
 */
export function removeShorts(root) {
  let removed = 0;
  const stack = [root];

  while (stack.length) {
    const node = stack.pop();

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const item = node[i];
        if (isShorts(item)) {
          node.splice(i, 1);
          removed++;
        } else if (item !== null && typeof item === 'object') {
          stack.push(item);
        }
      }
    } else if (node !== null && typeof node === 'object') {
      for (const key in node) {
        const value = node[key];
        if (value !== null && typeof value === 'object') stack.push(value);
      }
    }
  }

  return removed;
}
