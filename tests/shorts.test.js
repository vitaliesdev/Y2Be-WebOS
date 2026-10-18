import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { removeShorts } from '../src/features/shorts/filter.js';

const video = (id) => ({
  tileRenderer: { onSelectCommand: { watchEndpoint: { videoId: id } } }
});
const short = (id) => ({
  tileRenderer: { onSelectCommand: { reelWatchEndpoint: { videoId: id } } }
});
const shelf = (items, type) => ({
  shelfRenderer: {
    tvhtml5ShelfRendererType: type,
    content: { horizontalListRenderer: { items } }
  }
});
const guideEntry = (icon, navigationEndpoint) => ({
  guideEntryRenderer: { icon: { iconType: icon }, navigationEndpoint }
});

describe('removeShorts', () => {
  it('removes Shorts tiles and shelves from feeds', () => {
    const contents = [
      shelf([video('a'), short('s1'), video('b')]),
      shelf([video('c')], 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS'),
      shelf([short('s2'), short('s3')]),
      { reelShelfRenderer: {} },
      { gridRenderer: { items: [short('s4'), video('d')] } }
    ];
    const response = { contents };

    assert.equal(removeShorts(response), 5);
    assert.equal(contents.length, 2);
    assert.equal(
      contents[0].shelfRenderer.content.horizontalListRenderer.items.length,
      2
    );
    assert.equal(contents[1].gridRenderer.items.length, 1);
  });

  it('removes the Shorts entry from the sidebar', () => {
    const items = [
      guideEntry('TAB_HOME', { browseEndpoint: { browseId: 'default' } }),
      guideEntry('X', { reelWatchEndpoint: {} }),
      guideEntry('Y', {
        commandExecutorCommand: { commands: [{ reelWatchEndpoint: {} }] }
      }),
      guideEntry('TAB_SHORTS', {}),
      guideEntry('Z', { browseEndpoint: { browseId: 'FEshorts' } }),
      guideEntry('TAB_SUBSCRIPTIONS', {
        browseEndpoint: { browseId: 'FEsubscriptions' }
      })
    ];

    assert.equal(
      removeShorts({ items: [{ guideSectionRenderer: { items } }] }),
      4
    );
    assert.deepEqual(
      items.map((i) => i.guideEntryRenderer.icon.iconType),
      ['TAB_HOME', 'TAB_SUBSCRIPTIONS']
    );
  });

  it('leaves unrelated data and the Shorts player alone', () => {
    assert.equal(removeShorts({ data: true }), 0);
    assert.equal(removeShorts(null), 0);
    const player = { entries: [{ command: { reelWatchEndpoint: {} } }] };
    assert.equal(removeShorts(player), 0);
  });
});
