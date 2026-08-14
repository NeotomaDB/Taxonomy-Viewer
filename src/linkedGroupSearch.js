const LINKED_GROUPS = Object.freeze({
  VPL: 'PLA',
  PLA: 'VPL',
});

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\?+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseQuery(rawQuery) {
  const raw = String(rawQuery ?? '').trim();
  const quoted = raw.length >= 2 && (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  );
  const value = quoted ? raw.slice(1, -1).trim() : raw;
  return {
    exact: quoted,
    normalized: normalize(value),
    numericId: /^\d+$/.test(value) ? Number(value) : null,
  };
}

export function getLinkedTaxonGroup(taxagroupid) {
  return LINKED_GROUPS[taxagroupid] || null;
}

/**
 * Creates a lazy, in-memory search over the VPL/PLA pair. Candidate lists are
 * built only when one of those groups is searched, so initial page rendering
 * receives no additional work or network requests.
 */
export function createLinkedGroupSearch({ getRowsForGroup, getGroupName }) {
  const candidateCache = new Map();

  function getCandidates(taxagroupid) {
    if (candidateCache.has(taxagroupid)) return candidateCache.get(taxagroupid);

    const candidatesById = new Map();
    (getRowsForGroup(taxagroupid) || []).forEach((row) => {
      const taxonid = Number(row.taxonid ?? row.ids_root_to_leaf?.at(-1));
      const taxonname = String(row.taxonname ?? row.names_root_to_leaf?.at(-1) ?? '').trim();
      if (!Number.isFinite(taxonid) || !taxonname || candidatesById.has(taxonid)) return;

      candidatesById.set(taxonid, {
        taxonid,
        taxonname,
        normalizedName: normalize(taxonname),
        pathNames: Array.isArray(row.names_root_to_leaf) ? row.names_root_to_leaf : [],
        taxagroupid,
        groupName: getGroupName(taxagroupid) || taxagroupid,
      });
    });

    const candidates = Array.from(candidatesById.values());
    candidateCache.set(taxagroupid, candidates);
    return candidates;
  }

  return {
    findMatches({ currentTaxagroupid, query, limit = 24 }) {
      const linkedGroup = getLinkedTaxonGroup(currentTaxagroupid);
      if (!linkedGroup) return [];

      const parsed = parseQuery(query);
      if (!parsed.normalized && parsed.numericId == null) return [];

      return getCandidates(linkedGroup)
        .filter((candidate) => {
          if (parsed.numericId != null) return candidate.taxonid === parsed.numericId;
          return parsed.exact
            ? candidate.normalizedName === parsed.normalized
            : candidate.normalizedName.includes(parsed.normalized);
        })
        .sort((a, b) => {
          const aExact = a.normalizedName === parsed.normalized ? 0 : 1;
          const bExact = b.normalizedName === parsed.normalized ? 0 : 1;
          const aPrefix = a.normalizedName.startsWith(parsed.normalized) ? 0 : 1;
          const bPrefix = b.normalizedName.startsWith(parsed.normalized) ? 0 : 1;
          return aExact - bExact || aPrefix - bPrefix || a.taxonname.localeCompare(b.taxonname);
        })
        .slice(0, limit);
    },
  };
}
