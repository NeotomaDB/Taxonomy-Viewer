function normalizeTaxonId(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

/**
 * Keep the complete subtree for every matched taxon in Focus View.
 *
 * A taxon may be both a recorded row endpoint and the ancestor of many other
 * rows. Filtering only by row.taxonid makes such an internal taxon look like a
 * leaf, so the renderer cannot offer its expand/collapse control.
 */
export function filterRowsForFocusMatches(rows = [], matchIds = []) {
  const normalizedMatchIds = new Set(
    Array.from(matchIds, normalizeTaxonId).filter(Boolean),
  );

  if (normalizedMatchIds.size === 0) return [];

  return rows.filter((row) => {
    const pathIds = Array.isArray(row?.ids_root_to_leaf)
      ? row.ids_root_to_leaf
      : [];

    if (pathIds.some((id) => normalizedMatchIds.has(normalizeTaxonId(id)))) {
      return true;
    }

    // Preserve support for partial/legacy rows whose terminal ID is not
    // duplicated in ids_root_to_leaf.
    return normalizedMatchIds.has(normalizeTaxonId(row?.taxonid));
  });
}
