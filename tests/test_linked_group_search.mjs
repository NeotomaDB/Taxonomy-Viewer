import assert from 'node:assert/strict';
import test from 'node:test';

import { createLinkedGroupSearch, getLinkedTaxonGroup } from '../src/linkedGroupSearch.js';

const rowsByGroup = {
  VPL: [
    { taxonid: 10, taxonname: 'Parietaria judaica', taxagroupid: 'VPL', names_root_to_leaf: ['Plantae', 'Parietaria judaica'] },
  ],
  PLA: [
    { taxonid: 20, taxonname: 'Plant remain undiff.', taxagroupid: 'PLA', names_root_to_leaf: ['Plantae', 'Plant remain undiff.'] },
    { taxonid: 20, taxonname: 'Plant remain undiff.', taxagroupid: 'PLA', names_root_to_leaf: ['Plantae', 'Plant remain undiff.'] },
  ],
};

const search = createLinkedGroupSearch({
  getRowsForGroup: group => rowsByGroup[group] || [],
  getGroupName: group => ({ VPL: 'Vascular plants', PLA: 'Plants undiff.' }[group]),
});

test('links only Vascular plants and Plants undiff.', () => {
  assert.equal(getLinkedTaxonGroup('VPL'), 'PLA');
  assert.equal(getLinkedTaxonGroup('PLA'), 'VPL');
  assert.equal(getLinkedTaxonGroup('MAM'), null);
});

test('searches the companion plant group without duplicating taxa', () => {
  const matches = search.findMatches({ currentTaxagroupid: 'VPL', query: 'plant remain' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].taxonid, 20);
  assert.equal(matches[0].groupName, 'Plants undiff.');
});

test('supports reverse search and exact quoted names', () => {
  assert.equal(
    search.findMatches({ currentTaxagroupid: 'PLA', query: 'parietaria' })[0].taxonid,
    10,
  );
  assert.equal(
    search.findMatches({ currentTaxagroupid: 'PLA', query: '"Parietaria judaica"' }).length,
    1,
  );
  assert.equal(
    search.findMatches({ currentTaxagroupid: 'PLA', query: '"Parietaria"' }).length,
    0,
  );
});

test('does not expand unrelated taxon groups', () => {
  assert.deepEqual(search.findMatches({ currentTaxagroupid: 'MAM', query: 'plant' }), []);
});
