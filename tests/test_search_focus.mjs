import assert from 'node:assert/strict';
import test from 'node:test';

import { setupFocusInfo } from '../src/searchFocus.js';

test('canvas selection renders synonym relationships for an accepted Neotoma taxon', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const panel = { innerHTML: '', style: {} };

  globalThis.document = {
    body: { dataset: { appView: 'explorer' } },
    getElementById(id) {
      return id === 'info' ? panel : null;
    },
  };
  globalThis.window = {};

  const node = {
    data: {
      id: 391,
      name: 'Amaranthaceae',
      taxagroupid: 'VPL',
      synonymMetadata: {
        validId: 391,
        validName: 'Amaranthaceae',
        synonyms: [{
          invalid_id: 37451,
          invalid_name: 'Amaranthaceae/Chenopodiaceae',
          synonymtype: 'taxonomic, heterotypic, or subjective synonym: family merged into another family',
        }],
      },
    },
    ancestors() {
      return [this];
    },
    descendants() {
      return [this];
    },
  };

  try {
    const info = setupFocusInfo(null);
    info.show(node, { history: 'none' });

    assert.match(panel.innerHTML, /Accepted name in Neotoma/);
    assert.match(panel.innerHTML, /Amaranthaceae \(ID 391\)/);
    assert.match(panel.innerHTML, /Amaranthaceae\/Chenopodiaceae \(ID 37451\)/);
    assert.match(panel.innerHTML, /may differ from other taxonomic authorities/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
