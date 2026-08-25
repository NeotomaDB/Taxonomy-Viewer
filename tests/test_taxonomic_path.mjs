import test from 'node:test';
import assert from 'node:assert/strict';

import { taxonomicAncestors } from '../src/taxonomicPath.js';

function hierarchyNode(data, parent = null) {
  const node = {
    data,
    parent,
    ancestors() {
      const result = [];
      let current = this;
      while (current) {
        result.push(current);
        current = current.parent;
      }
      return result;
    },
  };
  return node;
}

test('excludes an internal forest layout container from taxonomic paths', () => {
  const layoutRoot = hierarchyNode({
    id: '__layout_container__',
    name: '',
    isVirtualForestRoot: true,
  });
  const recordedRoot = hierarchyNode({ id: 32182, name: 'Eukaryota' }, layoutRoot);
  const leaf = hierarchyNode({ id: 47092, name: 'Halodinium' }, recordedRoot);

  assert.deepEqual(
    taxonomicAncestors(leaf, { rootToLeaf: true }).map((node) => node.data.name),
    ['Eukaryota', 'Halodinium'],
  );
});

test('starts the Vascular plants scientific path at Tracheophyta', () => {
  const vascularPlantsViewRoot = hierarchyNode({ id: -2003, name: 'Vascular plants' });
  const tracheophyta = hierarchyNode({ id: 9534, name: 'Tracheophyta' }, vascularPlantsViewRoot);
  const spermatophyta = hierarchyNode({ id: 47087, name: 'Spermatophyta' }, tracheophyta);
  const amaranthaceae = hierarchyNode({ id: 391, name: 'Amaranthaceae' }, spermatophyta);

  assert.deepEqual(
    taxonomicAncestors(amaranthaceae, { rootToLeaf: true }).map((node) => node.data.name),
    ['Tracheophyta', 'Spermatophyta', 'Amaranthaceae'],
  );
});
