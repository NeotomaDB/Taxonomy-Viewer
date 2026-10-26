let metadataIndex = null;
let metadataIndexPromise = null;
const publicationDetailsCache = new Map();
const publicationDetailsPromiseCache = new Map();
const taxonDetailsCache = new Map();
const taxonDetailsPromiseCache = new Map();
let ecologicalGroupTypesCache = null;
let ecologicalGroupTypesPromise = null;

function escapeHtml(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function buildCitationDisplayValue(metadata) {
  if (!metadata) return null;

  if (metadata.citation) {
    return String(metadata.citation).trim() || null;
  }

  if (metadata.publication) {
    return String(metadata.publication).trim() || null;
  }
  return null;
}

function extractTaxonDetails(payload, taxonId) {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : payload?.data?.result;
  if (!Array.isArray(rows)) return null;

  const matchingRows = rows.filter((row) => Number(row?.taxonid) === Number(taxonId));
  if (!matchingRows.length) return null;

  return {
    ...matchingRows[0],
    ecologicalGroupIds: [...new Set(
      matchingRows
        .map((row) => String(row?.ecolgroup || '').trim())
        .filter(Boolean),
    )],
  };
}

function extractPublicationDetails(payload) {
  const resultRow = payload?.data?.result?.[0];
  if (resultRow?.publication) {
    return resultRow.publication;
  }

  const directRow = payload?.data?.[0];
  if (directRow?.publication) {
    return directRow.publication;
  }

  return null;
}

async function ensureMetadataIndex() {
  if (metadataIndex) return metadataIndex;
  if (!metadataIndexPromise) {
    metadataIndexPromise = fetch('data/taxon_metadata.json', { cache: 'default' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch local taxon metadata (HTTP ${response.status})`);
        }
        const payload = await response.json();
        const map = new Map();
        Object.entries(payload || {}).forEach(([taxonId, row]) => {
          const numericId = Number(taxonId);
          if (!Number.isFinite(numericId) || !row) return;
          map.set(numericId, row);
        });
        metadataIndex = map;
        return metadataIndex;
      })
      .catch((err) => {
        metadataIndexPromise = null;
        throw err;
      });
  }
  return metadataIndexPromise;
}

export async function fetchPublicationDetails(publicationId) {
  const numericId = Number(publicationId);
  if (!Number.isFinite(numericId)) {
    return null;
  }

  if (publicationDetailsCache.has(numericId)) {
    return publicationDetailsCache.get(numericId);
  }

  if (!publicationDetailsPromiseCache.has(numericId)) {
    const promise = fetch(`https://api.neotomadb.org/v2.0/data/publications/${numericId}`, {
      cache: 'default',
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch publication ${numericId} (HTTP ${response.status})`);
        }
        const payload = await response.json();
        const publication = extractPublicationDetails(payload);
        const details = publication
          ? {
              citation: publication.citation || null,
              publicationYear: publication.year || null,
            }
          : null;
        publicationDetailsCache.set(numericId, details);
        publicationDetailsPromiseCache.delete(numericId);
        return details;
      })
      .catch((err) => {
        publicationDetailsPromiseCache.delete(numericId);
        throw err;
      });

    publicationDetailsPromiseCache.set(numericId, promise);
  }

  return publicationDetailsPromiseCache.get(numericId);
}

export async function fetchTaxonDetails(taxonId) {
  const numericId = Number(taxonId);
  if (!Number.isFinite(numericId)) {
    return null;
  }

  if (taxonDetailsCache.has(numericId)) {
    return taxonDetailsCache.get(numericId);
  }

  if (!taxonDetailsPromiseCache.has(numericId)) {
    const promise = fetch(`https://api.neotomadb.org/v2.0/data/taxa?taxonid=${numericId}`, {
      cache: 'default',
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch taxon ${numericId} (HTTP ${response.status})`);
        }
        const payload = await response.json();
        const details = extractTaxonDetails(payload, numericId);
        taxonDetailsCache.set(numericId, details);
        taxonDetailsPromiseCache.delete(numericId);
        return details;
      })
      .catch((err) => {
        taxonDetailsPromiseCache.delete(numericId);
        throw err;
      });

    taxonDetailsPromiseCache.set(numericId, promise);
  }

  return taxonDetailsPromiseCache.get(numericId);
}

export async function fetchEcologicalGroupTypes() {
  if (ecologicalGroupTypesCache) return ecologicalGroupTypesCache;
  if (!ecologicalGroupTypesPromise) {
    ecologicalGroupTypesPromise = fetch(
      'https://api.neotomadb.org/v2.0/data/dbtables/ecolgrouptypes?count=false&limit=500&offset=0',
      {
        cache: 'default',
        headers: { accept: 'application/json' },
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ecological group types (HTTP ${response.status})`);
        }
        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        ecologicalGroupTypesCache = new Map(
          rows
            .map((row) => {
              const id = String(row?.ecolgroupid || '').trim();
              const label = String(row?.ecolgroup || '').trim();
              return id && label ? [id, label] : null;
            })
            .filter(Boolean),
        );
        return ecologicalGroupTypesCache;
      })
      .catch((err) => {
        ecologicalGroupTypesPromise = null;
        throw err;
      })
      .finally(() => {
        ecologicalGroupTypesPromise = null;
      });
  }

  return ecologicalGroupTypesPromise;
}

export async function fetchTaxonMetadata(taxonId) {
  const numericId = Number(taxonId);
  if (!Number.isFinite(numericId)) {
    throw new Error('Invalid taxon id');
  }

  const metadataMap = await ensureMetadataIndex();
  const metadata = metadataMap.get(numericId);
  if (!metadata) {
    throw new Error(`Taxon ${numericId} not found in local metadata index`);
  }

  // The taxon endpoint carries the publication text associated with this exact
  // taxon, including legacy records whose publication ID is no longer
  // resolvable through the publications endpoint.
  try {
    const taxonDetails = await fetchTaxonDetails(numericId);
    if (taxonDetails) {
      if (taxonDetails.author) metadata.author = taxonDetails.author;
      if (taxonDetails.publicationid != null) metadata.publicationid = taxonDetails.publicationid;
      if (taxonDetails.publication) metadata.publication = taxonDetails.publication;
      metadata.ecologicalGroupIds = taxonDetails.ecologicalGroupIds || [];
    }
  } catch (err) {
    console.warn(`Failed to fetch taxon details for ${numericId}:`, err);
  }

  // Prefer the normalized publication record when it resolves, but retain the
  // taxon endpoint's publication text as the fallback when it does not.
  const publicationTask = metadata.publicationid != null ? (async () => {
    try {
      const publicationDetails = await fetchPublicationDetails(metadata.publicationid);
      if (publicationDetails) {
        if (publicationDetails.citation) metadata.citation = publicationDetails.citation;
        if (publicationDetails.publicationYear) {
          metadata.publicationYear = publicationDetails.publicationYear;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch publication details for ${metadata.publicationid}:`, err);
    }
  })() : Promise.resolve();

  const ecologicalGroupsTask = metadata.ecologicalGroupIds?.length ? (async () => {
    try {
      const groupTypes = await fetchEcologicalGroupTypes();
      metadata.ecologicalGroups = metadata.ecologicalGroupIds.map(
        (groupId) => groupTypes.get(groupId) || groupId,
      );
    } catch (err) {
      console.warn('Failed to fetch ecological group types:', err);
      metadata.ecologicalGroups = [...metadata.ecologicalGroupIds];
    }
  })() : Promise.resolve();

  await Promise.all([publicationTask, ecologicalGroupsTask]);

  return metadata;
}

export function renderTaxonMetadataHtml(metadata, { framed = true } = {}) {
  if (!metadata) return '';

  const authorValue = metadata.author ? String(metadata.author).trim() : '';
  const author = authorValue
    ? escapeHtml(authorValue)
    : '<span style="color:#9ca3af;font-style:italic;">Not recorded</span>';

  const citationValue = buildCitationDisplayValue(metadata);
  const citation = citationValue
    ? escapeHtml(citationValue)
    : '<span style="color:#9ca3af;font-style:italic;">Not recorded</span>';
  const citationSearchLink = citationValue
    ? `<div style="margin-top:4px;">
        <a href="${escapeHtml(`https://scholar.google.com/scholar?q=${encodeURIComponent(citationValue)}`)}" target="_blank" rel="noopener noreferrer" aria-label="Search this citation in Google Scholar (opens in a new tab)" style="color:#2563eb;text-decoration:none;font-weight:600;">Search in Google Scholar <span aria-hidden="true">↗</span></a>
      </div>`
    : '';

  const validationParts = [];
  if (metadata.validatorName) {
    validationParts.push(escapeHtml(metadata.validatorName));
  }
  if (metadata.validatedate) {
    validationParts.push(escapeHtml(formatDateLabel(metadata.validatedate)));
  }
  const validation = validationParts.length > 0
    ? validationParts.join(', ')
    : '<span style="color:#9ca3af;font-style:italic;">Not recorded</span>';

  const ecologicalGroups = Array.isArray(metadata.ecologicalGroups)
    ? metadata.ecologicalGroups.map((group) => String(group).trim()).filter(Boolean)
    : [];
  const ecologicalGroupsRow = ecologicalGroups.length
    ? `
      <dt style="font-weight:600;color:#6b7280;float:left;clear:left;width:116px;margin:0 0 4px 0;">Ecological groups</dt>
      <dd style="margin:0 0 2px 116px;color:#374151;word-break:break-word;">${ecologicalGroups.map(escapeHtml).join(', ')}</dd>`
    : '';

  const surfaceStyle = framed
    ? 'margin:12px 0 0 0;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;'
    : 'margin:9px 0 0 0;padding:0;';

  return `
    <dl style="${surfaceStyle}font-size:12px;line-height:1.55;">
      <dt style="font-weight:600;color:#6b7280;float:left;clear:left;width:116px;margin:0 0 4px 0;">Taxon authority</dt>
      <dd style="margin:0 0 8px 116px;color:#374151;word-break:break-word;">${author}</dd>
      <dt style="font-weight:600;color:#6b7280;float:left;clear:left;width:116px;margin:0 0 4px 0;">Citation</dt>
      <dd style="margin:0 0 8px 116px;color:#374151;word-break:break-word;">${citation}${citationSearchLink}</dd>
      <dt style="font-weight:600;color:#6b7280;float:left;clear:left;width:116px;margin:0 0 4px 0;">Validation</dt>
      <dd style="margin:0 0 ${ecologicalGroups.length ? '8px' : '2px'} 116px;color:#374151;">${validation}</dd>
      ${ecologicalGroupsRow}
    </dl>
  `;
}

export async function fetchAndRenderTaxonMetadata(taxonId, containerElement, currentClickIdRef, renderOptions) {
  if (!containerElement || taxonId == null) return;

  const requestedId = Number(taxonId);
  containerElement.innerHTML = `
    <div style="margin:12px 0 0 0;font-size:12px;color:#888;font-style:italic;">
      Loading taxon metadata…
    </div>
  `;

  try {
    const metadata = await fetchTaxonMetadata(requestedId);
    if (currentClickIdRef && Number(currentClickIdRef.value) !== requestedId) {
      return;
    }
    containerElement.innerHTML = renderTaxonMetadataHtml(metadata, renderOptions);
  } catch (err) {
    console.error('Failed to load local taxon metadata:', err);
    if (currentClickIdRef && Number(currentClickIdRef.value) !== requestedId) {
      return;
    }
    containerElement.innerHTML = `
      <div style="margin:12px 0 0 0;font-size:12px;color:#b91c1c;">
        Could not load local taxon metadata.
      </div>
    `;
  }
}
