import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDenseNodeLabel, prepareDenseSearchTree, prepareFocusedTaxonTree } from '../src/denseSearchTree.js';

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

test('collapses a focused internal taxon while keeping its path visible', () => {
  const human = node('Homo sapiens', [], true);
  human.data.id = 6116;
  const primates = node('Primates', [human], true);
  primates.data.id = 6359;
  const mammalia = node('Mammalia', [primates]);
  mammalia.data.id = 6171;

  const result = prepareFocusedTaxonTree(mammalia, { focusNodeIds: [6359] });

  assert.equal(result.mode, 'focus');
  assert.deepEqual(mammalia.children, [primates]);
  assert.equal(primates.children, null);
  assert.deepEqual(primates._children, [human]);
});

test('does not invent an expand control for a focused terminal taxon', () => {
  const human = node('Homo sapiens', [], true);
  human.data.id = 6116;
  const primates = node('Primates', [human]);
  primates.data.id = 6359;
  const mammalia = node('Mammalia', [primates]);
  mammalia.data.id = 6171;

  prepareFocusedTaxonTree(mammalia, { focusNodeIds: ['6116'] });

  assert.deepEqual(human.children, []);
  assert.equal(human._children, null);
});
