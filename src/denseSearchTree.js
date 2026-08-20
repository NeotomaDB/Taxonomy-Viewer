function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\?+/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function collectNodes(root) {
  const nodes = [];
  const visit = (node) => {
    if (!node) return;
    nodes.push(node);
    (node.children || []).forEach(visit);
  };
  visit(root);
  return nodes;
}

function countFilteredTaxa(node) {
  const ownCount = node.data?.isRecordedTerminal ? 1 : 0;
  const children = node.children || [];
  const childCount = children.reduce((sum, child) => sum + countFilteredTaxa(child), 0);
  const count = ownCount + childCount || (children.length === 0 ? 1 : 0);
  if (node.data) node.data.filteredTaxonCount = count;
  return count;
}

function pathFromRoot(node) {
  const path = [];
  let current = node;
  while (current) {
    path.unshift(current);
    current = current.parent || null;
  }
  return path;
}

/**
 * Show only the paths to the selected Focus View taxa and keep each selected
 * internal taxon collapsed. Expanding it later reveals the subtree already
 * present in _children.
 */
export function prepareFocusedTaxonTree(root, { focusNodeIds = [] } = {}) {
  if (!root) return { mode: 'empty', focusNodes: [], visibleNodeCount: 0 };

  countFilteredTaxa(root);
  const allNodes = collectNodes(root);
  const normalizedFocusIds = new Set(
    Array.from(focusNodeIds, id => String(id)),
  );
  const focusNodes = allNodes.filter(node =>
    normalizedFocusIds.has(String(node.data?.id ?? node.data?.taxonid)),
  );

  if (focusNodes.length === 0) {
    return { mode: 'missing', focusNodes: [], visibleNodeCount: allNodes.length };
  }

  allNodes.forEach((node) => {
    node._children = node.children?.length ? node.children : null;
    if (node._children) node.children = null;
  });

  const visibleNodes = new Set([root]);
  focusNodes.forEach((focusNode) => {
    const path = pathFromRoot(focusNode);
    path.slice(0, -1).forEach((node, index) => {
      const nextNode = path[index + 1];
      if (!node.children) node.children = [];
      if (!node.children.includes(nextNode)) node.children.push(nextNode);
      visibleNodes.add(node);
      visibleNodes.add(nextNode);
    });
  });

  return {
    mode: 'focus',
    focusNodes,
    visibleNodeCount: visibleNodes.size,
  };
}

/**
 * Collapses a filtered search tree to a readable initial state.
 * Exact-name matches receive a visible root-to-match path; otherwise the tree
 * expands breadth-first until the visible-node budget would be exceeded.
 */
export function prepareDenseSearchTree(root, { query = '', visibleNodeBudget = 40 } = {}) {
  if (!root) return { mode: 'empty', exactNode: null, visibleNodeCount: 0 };

  countFilteredTaxa(root);
  const allNodes = collectNodes(root);
  allNodes.forEach((node) => {
    node._children = node.children?.length ? node.children : null;
  });

  const normalizedQuery = normalize(query);
  const exactNode = allNodes
    .filter(node => normalize(node.data?.name) === normalizedQuery)
    .sort((a, b) => (b.data?.filteredTaxonCount || 0) - (a.data?.filteredTaxonCount || 0))[0] || null;

  allNodes.forEach((node) => {
    if (node._children) node.children = null;
  });

  if (exactNode) {
    const path = pathFromRoot(exactNode);
    let visibleNodeCount = 1;
    path.slice(0, -1).forEach((node, index) => {
      const nextNode = path[index + 1];
      const availableChildren = node._children || [];
      if (visibleNodeCount + availableChildren.length <= visibleNodeBudget) {
        node.children = availableChildren;
        visibleNodeCount += availableChildren.length;
      } else {
        node.children = [nextNode];
        visibleNodeCount += 1;
      }
    });
    return { mode: 'exact', exactNode, visibleNodeCount };
  }

  let visibleNodeCount = 1;
  const queue = [root];
  while (queue.length > 0) {
    const node = queue.shift();
    const children = node._children || [];
    if (children.length === 0) continue;
    if (visibleNodeCount + children.length > visibleNodeBudget) continue;
    node.children = children;
    visibleNodeCount += children.length;
    queue.push(...children);
  }

  return { mode: 'budget', exactNode: null, visibleNodeCount };
}

export function formatDenseNodeLabel(node) {
  const name = String(node?.data?.name ?? '');
  const isCollapsed = !node?.children && (node?._children?.length || 0) > 0;
  const count = Number(node?.data?.filteredTaxonCount || 0);
  return isCollapsed && count > 1 ? `${name} · ${count} taxa` : name;
}
