import assert from 'node:assert/strict';
import test from 'node:test';

import { filterRowsForFocusMatches } from '../src/focusRows.js';

const rows = [
  {
    taxonid: 6359,
    ids_root_to_leaf: [6171, 6359],
    names_root_to_leaf: ['Mammalia', 'Primates'],
  },
  {
    taxonid: 6116,
    ids_root_to_leaf: [6171, 6359, 6360, 6361, 6116],
    names_root_to_leaf: ['Mammalia', 'Primates', 'Hominidae', 'Homo', 'Homo sapiens'],
  },
  {
    taxonid: 7000,
    ids_root_to_leaf: [6171, 7000],
    names_root_to_leaf: ['Mammalia', 'Rodentia'],
  },
];

test('keeps descendant rows when a matched taxon is also a recorded endpoint', () => {
  const filtered = filterRowsForFocusMatches(rows, new Set([6359]));

  assert.deepEqual(filtered, rows.slice(0, 2));
});

test('keeps a terminal match scoped to its own row', () => {
  const filtered = filterRowsForFocusMatches(rows, new Set(['6116']));

  assert.deepEqual(filtered, [rows[1]]);
});

test('supports legacy rows that only expose the matched terminal as taxonid', () => {
  const legacyRow = { taxonid: 42, ids_root_to_leaf: [1] };

  assert.deepEqual(filterRowsForFocusMatches([legacyRow], [42]), [legacyRow]);
});
