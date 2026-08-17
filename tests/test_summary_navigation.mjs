import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { beginTaxonomyBusy } from '../src/busyState.js';
import { getSummaryNavigationQuery } from '../src/summaryPanel.js';

test('recent-change navigation prefers the exact taxon ID over an ambiguous name', () => {
  assert.equal(getSummaryNavigationQuery({
    taxonid: 69752,
    taxonname: 'Dahlia',
  }), '69752');
});

test('recent-change navigation falls back to the name when an ID is unavailable', () => {
  assert.equal(getSummaryNavigationQuery({ taxonname: 'Dahlia' }), 'Dahlia');
});

test('visualization busy state uses only the requested loading copy', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const busyMarkup = html.match(/<div id="visualizationBusy"[\s\S]*?<\/div>/)?.[0] || '';

  assert.match(busyMarkup, />Loading \.\.\.<\/span>/);
  assert.doesNotMatch(busyMarkup, /Dahlia|Vascular plants|Opening|Preparing/);
});

test('busy lifecycle covers the stage and disables recent-change navigation', () => {
  const previousDocument = globalThis.document;
  const bodyClasses = new Set();
  const stageAttributes = new Map();
  const overlay = { hidden: true };
  const buttons = [{ disabled: false }, { disabled: false }];

  globalThis.document = {
    body: {
      classList: {
        toggle(name, enabled) {
          if (enabled) bodyClasses.add(name);
          else bodyClasses.delete(name);
        },
      },
    },
    getElementById(id) {
      if (id === 'stage') {
        return { setAttribute: (name, value) => stageAttributes.set(name, value) };
      }
      if (id === 'visualizationBusy') return overlay;
      return null;
    },
    querySelectorAll() {
      return buttons;
    },
  };

  try {
    const release = beginTaxonomyBusy();
    assert.equal(overlay.hidden, false);
    assert.equal(stageAttributes.get('aria-busy'), 'true');
    assert.equal(bodyClasses.has('taxonomy-busy'), true);
    assert.equal(buttons.every(button => button.disabled), true);

    release();
    assert.equal(overlay.hidden, true);
    assert.equal(stageAttributes.get('aria-busy'), 'false');
    assert.equal(bodyClasses.has('taxonomy-busy'), false);
    assert.equal(buttons.every(button => !button.disabled), true);
  } finally {
    globalThis.document = previousDocument;
  }
});
