import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCitationDisplayValue,
  fetchPublicationDetails,
  fetchTaxonMetadata,
  renderTaxonMetadataHtml,
} from '../src/taxonMetadata.js';

test('prefers publication citation when available', () => {
  assert.equal(
    buildCitationDisplayValue({
      author: 'Miller, 1754',
      publicationYear: '1991',
      citation: 'Gajewski, K. 1991. Example citation.',
    }),
    'Gajewski, K. 1991. Example citation.',
  );
});

test('falls back to publication text before author-year formatting', () => {
  assert.equal(
    buildCitationDisplayValue({
      author: 'Eisenack, 1958, emend. Downie & Sargent, 1963, Turner, 1984',
      publication: 'Williams, G.L., R.A. Fensome, and R.A. MacRae. 2017. The Lentin and Williams index of fossil Dinoflagellates 2017 edition. AASP Contribution Series 48. American Association of Stratigraphic Palynologists Foundation.',
      citation: null,
      publicationYear: null,
    }),
    'Williams, G.L., R.A. Fensome, and R.A. MacRae. 2017. The Lentin and Williams index of fossil Dinoflagellates 2017 edition. AASP Contribution Series 48. American Association of Stratigraphic Palynologists Foundation.',
  );
});

test('does not use author or publication year as a citation fallback', () => {
  assert.equal(
    buildCitationDisplayValue({
      author: 'Linnaeus',
      publicationYear: '1753',
      citation: null,
    }),
    null,
  );

  assert.equal(
    buildCitationDisplayValue({
      author: 'Miller, 1754',
      publicationYear: '1754',
      citation: null,
    }),
    null,
  );
});

test('renders author and citation separately, then validation details', () => {
  const html = renderTaxonMetadataHtml({
    author: 'Miller, 1754',
    validatorName: 'Test Validator',
    validatorid: 44,
    validatedate: '2017-04-21T00:00:00.000Z',
    citation: 'Gajewski, K. 1991. Example citation.',
  });

  assert.match(html, /Author/);
  assert.match(html, /Miller, 1754/);
  assert.match(html, /Citation/);
  assert.match(html, /Gajewski, K\. 1991\. Example citation\./);
  assert.match(html, /Search in Google Scholar/);
  assert.match(
    html,
    /href="https:\/\/scholar\.google\.com\/scholar\?q=Gajewski%2C%20K\.%201991\.%20Example%20citation\."/,
  );
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /Validation/);
  assert.match(html, /Test Validator, April 21, 2017/);
  assert.doesNotMatch(html, /Publication ID/);
  assert.doesNotMatch(html, /Publication<\/dt>/);
  assert.doesNotMatch(html, /Validator<\/dt>/);
  assert.doesNotMatch(html, /Validated<\/dt>/);
  assert.doesNotMatch(html, /\(ID 44\)/);
  assert.ok(html.indexOf('Author') < html.indexOf('Citation'));
  assert.ok(html.indexOf('Citation') < html.indexOf('Validation'));
});

test('renders readable ecological groups when available', () => {
  const html = renderTaxonMetadataHtml({
    author: 'Burman, 1768',
    citation: 'Example citation.',
    ecologicalGroups: ['Aquatic Vascular Plants', 'Wetland Plants'],
  });

  assert.match(html, /Ecological groups/);
  assert.match(html, /Aquatic Vascular Plants, Wetland Plants/);
  assert.ok(html.indexOf('Validation') < html.indexOf('Ecological groups'));
});

test('omits the ecological-groups row when no assignment exists', () => {
  const html = renderTaxonMetadataHtml({
    author: 'Burman, 1768',
    citation: 'Example citation.',
    ecologicalGroups: [],
  });

  assert.doesNotMatch(html, /Ecological groups/);
});

test('shows a missing citation without relabeling the author as citation', () => {
  const html = renderTaxonMetadataHtml({
    author: 'Burman, 1768',
    citation: null,
    publication: null,
  });

  assert.match(html, /Author<\/dt>[\s\S]*Burman, 1768/);
  assert.match(html, /Citation<\/dt>[\s\S]*Not recorded/);
  assert.doesNotMatch(html, /Search in Google Scholar/);
});

test('loads a single publication citation by publication id', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          status: 'success',
          data: [
            {
              publication: {
                publicationid: 299,
                year: '1993',
                citation: 'Flora of North America Editorial Committee. 1993. Example citation.',
              },
            },
          ],
        };
      },
    };
  };

  try {
    assert.deepEqual(await fetchPublicationDetails(299), {
      citation: 'Flora of North America Editorial Committee. 1993. Example citation.',
      publicationYear: '1993',
    });
    assert.deepEqual(calls, [
      'https://api.neotomadb.org/v2.0/data/publications/299',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('normalizes resolved publications and keeps taxon text for unresolved publications', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const taxonPublication = 'African Plant Database (version 3.4.0). Example citation.';

  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    calls.push(requestUrl);

    if (requestUrl === 'data/taxon_metadata.json') {
      return {
        ok: true,
        async json() {
          return {
            45805: {
              taxonid: 45805,
              author: 'Burman, 1768',
              publicationid: 3708,
              publication: null,
              citation: null,
            },
            4572: {
              taxonid: 4572,
              author: 'C. Presl, 1822',
              publicationid: 303,
              publication: null,
              citation: null,
            },
          };
        },
      };
    }

    if (requestUrl.endsWith('/data/taxa?taxonid=45805')) {
      return {
        ok: true,
        async json() {
          return {
            status: 'success',
            data: [{
              taxonid: 45805,
              author: 'Burman, 1768',
              ecolgroup: 'AQVP',
              publicationid: 3708,
              publication: taxonPublication,
            }],
          };
        },
      };
    }

    if (requestUrl.endsWith('/data/publications/3708')) {
      return {
        ok: true,
        async json() {
          return { status: 'success', data: [] };
        },
      };
    }

    if (requestUrl.includes('/data/dbtables/ecolgrouptypes')) {
      return {
        ok: true,
        async json() {
          return {
            status: 'success',
            data: [
              { ecolgroupid: 'AQVP', ecolgroup: 'Aquatic Vascular Plants' },
              { ecolgroupid: 'UNID', ecolgroup: 'Unidentified' },
            ],
          };
        },
      };
    }

    if (requestUrl.endsWith('/data/taxa?taxonid=4572')) {
      return {
        ok: true,
        async json() {
          return {
            status: 'success',
            data: [
              {
                taxonid: 4572,
                author: 'C. Presl, 1822',
                ecolgroup: 'AQVP',
                publicationid: 303,
                publication: 'Taxon endpoint publication text.',
              },
              {
                taxonid: 4572,
                author: 'C. Presl, 1822',
                ecolgroup: 'UNID',
                publicationid: 303,
                publication: 'Taxon endpoint publication text.',
              },
            ],
          };
        },
      };
    }

    if (requestUrl.endsWith('/data/publications/303')) {
      return {
        ok: true,
        async json() {
          return {
            status: 'success',
            data: [{
              publication: {
                publicationid: 303,
                year: '1964',
                citation: 'Flora Europaea. 1964. Normalized citation.',
              },
            }],
          };
        },
      };
    }

    throw new Error(`Unexpected request: ${requestUrl}`);
  };

  try {
    const metadata = await fetchTaxonMetadata(45805);
    assert.equal(metadata.publication, taxonPublication);
    assert.equal(metadata.citation, null);
    assert.equal(buildCitationDisplayValue(metadata), taxonPublication);
    assert.deepEqual(metadata.ecologicalGroupIds, ['AQVP']);
    assert.deepEqual(metadata.ecologicalGroups, ['Aquatic Vascular Plants']);

    const normalizedMetadata = await fetchTaxonMetadata(4572);
    assert.equal(normalizedMetadata.publication, 'Taxon endpoint publication text.');
    assert.equal(normalizedMetadata.citation, 'Flora Europaea. 1964. Normalized citation.');
    assert.equal(normalizedMetadata.publicationYear, '1964');
    assert.deepEqual(normalizedMetadata.ecologicalGroupIds, ['AQVP', 'UNID']);
    assert.deepEqual(normalizedMetadata.ecologicalGroups, [
      'Aquatic Vascular Plants',
      'Unidentified',
    ]);
    assert.equal(
      buildCitationDisplayValue(normalizedMetadata),
      'Flora Europaea. 1964. Normalized citation.',
    );
    assert.deepEqual(calls, [
      'data/taxon_metadata.json',
      'https://api.neotomadb.org/v2.0/data/taxa?taxonid=45805',
      'https://api.neotomadb.org/v2.0/data/publications/3708',
      'https://api.neotomadb.org/v2.0/data/dbtables/ecolgrouptypes?count=false&limit=500&offset=0',
      'https://api.neotomadb.org/v2.0/data/taxa?taxonid=4572',
      'https://api.neotomadb.org/v2.0/data/publications/303',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
