import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDenseNodeLabel, prepareDenseSearchTree } from '../src/denseSearchTree.js';

function node(name, children = [], recorded = false) {
  const value = { data: { name, isRecordedTerminal: recorded }, children, parent: null };
  children.forEach(child => { child.parent = value; });
  return value;
}

test('keeps the path to an exact taxon visible and collapses its descendants', () => {
  const species = Array.from({ length: 6 }, (_, index) => node(`Pinus species ${index + 1}`, [], true));
  const pinus = node('Pinus', species, true);
  const family = node('Pinaceae', [pinus]);
  const root = node('Vascular plants', [family]);

  const result = prepareDenseSearchTree(root, { query: 'Pinus', visibleNodeBudget: 40 });

  assert.equal(result.mode, 'exact');
  assert.equal(root.children[0], family);
  assert.equal(family.children[0], pinus);
  assert.equal(pinus.children, null);
  assert.equal(pinus.data.filteredTaxonCount, 7);
  assert.equal(formatDenseNodeLabel(pinus), 'Pinus · 7 taxa');
});

test('uses a visible-node budget when no exact taxon exists', () => {
  const branches = Array.from({ length: 8 }, (_, index) =>
    node(`Branch ${index + 1}`, [node(`Match ${index + 1}`, [], true)]),
  );
  const root = node('Root', branches);

  const result = prepareDenseSearchTree(root, { query: 'partial', visibleNodeBudget: 5 });

  assert.equal(result.mode, 'budget');
  assert.equal(root.children, null);
  assert.equal(result.visibleNodeCount, 1);
  assert.equal(formatDenseNodeLabel(root), 'Root · 8 taxa');
});
