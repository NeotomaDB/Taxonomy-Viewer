/**
 * Return only recorded taxonomic nodes from a d3 hierarchy path.
 *
 * Renderers may use layout-only roots that are useful for navigation but are
 * not recorded taxonomic nodes. Those roots must never appear in scientific
 * paths or shared-ancestor calculations.
 */
const NON_TAXONOMIC_VIEW_ROOT_IDS = new Set([
  -2003, // Vascular plants group root; Tracheophyta is the scientific anchor.
]);

export function taxonomicAncestors(node, { rootToLeaf = false } = {}) {
  if (!node || typeof node.ancestors !== 'function') return [];

  const ancestors = node
    .ancestors()
    .filter((ancestor) => (
      !ancestor?.data?.isVirtualForestRoot
      && !NON_TAXONOMIC_VIEW_ROOT_IDS.has(Number(ancestor?.data?.id))
    ));

  return rootToLeaf ? ancestors.reverse() : ancestors;
}
