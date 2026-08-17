import assert from 'node:assert/strict';
import test from 'node:test';

import { isRadialLabelOutward } from '../src/radialLabelOrientation.js';

function branch(x, depth = 2) {
  return { x, depth, parent: null, children: [] };
}

function leaf(x, parent) {
  return { x, depth: parent.depth + 1, parent, children: null, _children: null };
}

test('keeps terminal siblings consistent across the bottom orientation boundary', () => {
  const parent = branch(Math.PI - 0.02);
  const leftSibling = leaf(Math.PI - 0.01, parent);
  const rightSibling = leaf(Math.PI + 0.01, parent);

  assert.equal(isRadialLabelOutward(leftSibling), false);
  assert.equal(isRadialLabelOutward(rightSibling), false);
});

test('keeps adjacent labels consistent near the bottom after a small rotation', () => {
  const rotation = -2 * Math.PI / 180;
  const firstParent = branch(Math.PI - 0.08);
  const secondParent = branch(Math.PI + 0.08);
  const first = leaf(Math.PI + 0.01, firstParent);
  const second = leaf(Math.PI + 0.08, secondParent);

  assert.equal(isRadialLabelOutward(first, rotation), false);
  assert.equal(isRadialLabelOutward(second, rotation), false);
});

test('uses one consistent direction around the top orientation boundary', () => {
  const nearZero = leaf(0.01, branch(0.2));
  const nearTau = leaf(Math.PI * 2 - 0.01, branch(Math.PI * 2 - 0.2));

  assert.equal(isRadialLabelOutward(nearZero), true);
  assert.equal(isRadialLabelOutward(nearTau), true);
});

test('keeps internal branches oriented by their own position', () => {
  const internal = branch(Math.PI + 0.01);
  internal.children = [leaf(Math.PI + 0.02, internal)];

  assert.equal(isRadialLabelOutward(internal), false);
});

test('accounts for user rotation when orienting a sibling fan', () => {
  const parent = branch(Math.PI - 0.05);
  const child = leaf(Math.PI - 0.04, parent);

  assert.equal(isRadialLabelOutward(child, 0.1), false);
});

test('uses the leaf angle when a parent represents a very wide terminal fan', () => {
  const wideFanParent = branch(Math.PI * 1.25);
  const farLeaf = leaf(Math.PI * 0.25, wideFanParent);

  assert.equal(isRadialLabelOutward(farLeaf, Math.PI * 0.25), true);
});
