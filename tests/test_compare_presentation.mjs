import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { formatCompareResolutionStatus } from '../src/comparePresentation.js';

test('moves a shared ambiguous match count into one comparison status', () => {
  assert.equal(
    formatCompareResolutionStatus(28, 28),
    '28 matches found. Choose one exact taxon to compare.',
  );
});

test('describes different ambiguous counts without hiding either side', () => {
  assert.equal(
    formatCompareResolutionStatus(28, 12),
    '28 matches found on the left and 12 on the right. Choose one exact taxon on each side to compare.',
  );
  assert.equal(
    formatCompareResolutionStatus(1, 12),
    '12 matches found. Choose one exact taxon to compare.',
  );
});

test('compare choices omit taxonomic paths and bordered option styling', async () => {
  const searchSource = await readFile(new URL('../src/search.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../index.css', import.meta.url), 'utf8');

  const disambiguationSource = searchSource.slice(
    searchSource.indexOf('function showCompareDisambiguationPanel'),
    searchSource.indexOf("const searchInput = document.getElementById('searchInput')"),
  );
  assert.doesNotMatch(disambiguationSource, /cmp-resolve-path/);
  assert.match(cssSource, /\.cmp-resolve-option\s*\{[^}]*border:\s*0;/s);
  assert.doesNotMatch(cssSource, /\.cmp-resolve-q[12]\s*\{[^}]*border:/s);
});

test('compare canvas keeps ancestor labels visible', async () => {
  const cssSource = await readFile(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(
    cssSource,
    /svg\.compare-mode\.search-active g\.node\.match-path text[^}]*\{[^}]*display:\s*block\s*!important;/s,
  );
});
