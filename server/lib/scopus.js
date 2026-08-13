










const SEARCH_URL = 'https://api.elsevier.com/content/search/scopus';
const FALLBACK_API_KEY = '3905a03718d2dcd9a6cc006bb7443e70';

const MAX_COUNT = 10;
const DEFAULT_COUNT = 6;
const MAX_ABSTRACT_CHARS = 2000;
const MAX_AUTHORS = 5;
const REQUEST_TIMEOUT_MS = 20000;

function apiKey() {
  return process.env.SCOPUS_API_KEY || FALLBACK_API_KEY;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'X-ELS-APIKey': apiKey(),
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function scopusErrorText(body) {
  if (!body || typeof body !== 'object') return '';
  const status = body['service-error'] && body['service-error'].status;
  if (status && status.statusText) return String(status.statusText);
  if (body['error-response'] && body['error-response']['error-code']) {
    return String(body['error-response']['error-message'] || body['error-response']['error-code']);
  }
  return '';
}

function isAuthorizationError(status, body) {
  if (status !== 401 && status !== 403) return false;
  const text = scopusErrorText(body).toLowerCase();
  return text.includes('not authorized') || text.includes('authorization');
}

function linkHref(entry, ref) {
  const links = Array.isArray(entry.link) ? entry.link : [];
  const match = links.find(l => l && (l['@ref'] === ref || l['@rel'] === ref));
  return match ? match['@href'] : undefined;
}



function scopusRecordUrl(scopusId) {
  const id = String(scopusId || '').replace(/^SCOPUS_ID:/i, '').trim();
  if (!/^\d+$/.test(id)) return undefined;
  return `https://www.scopus.com/inward/record.uri?partnerID=HzOxMe3b&scp=${id}&origin=inward`;
}

function looksLikePlaceholder(value) {
  return /x{3,}|\.{3}|placeholder|example\.com|your[-_]?doi|todo/i.test(String(value || ''));
}

function doiUrl(doi) {
  const clean = String(doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\
  if (!clean || looksLikePlaceholder(clean)) return undefined;
  return `https://doi.org/${clean}`;
}

function isUsableHttpUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^https?:\/\
  if (looksLikePlaceholder(trimmed)) return false;
  return true;
}


function buildPaperLinks(result) {
  if (!result || typeof result !== 'object') return {};
  const links = {};
  const fromDoi = doiUrl(result.doi);
  const fromId = scopusRecordUrl(result.id);
  const scopusCandidate = result.links && result.links.scopus;
  const scopus = isUsableHttpUrl(scopusCandidate) ? scopusCandidate.trim() : fromId;
  if (fromDoi) links.doi = fromDoi;
  if (scopus) links.scopus = scopus;

  if (result.openAccess && fromDoi) links.fullText = fromDoi;
  return links;
}

function authorList(entry) {
  const authors = entry.author;
  const list = Array.isArray(authors) ? authors : Array.isArray(authors && authors.author) ? authors.author : null;
  if (list && list.length) {
    const names = list
      .map(a => (a && (a.authname || a['ce:indexed-name'])) || '')
      .filter(Boolean);
    if (names.length) {
      const shown = names.slice(0, MAX_AUTHORS).join(', ');
      return names.length > MAX_AUTHORS ? `${shown} et al.` : shown;
    }
  }
  return entry['dc:creator'] || undefined;
}

function truncate(text, max) {
  if (typeof text !== 'string') return undefined;
  const clean = text.trim();
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const doi = entry['prism:doi'] || undefined;
  const scopusId = String(entry['dc:identifier'] || '').replace(/^SCOPUS_ID:/, '') || undefined;
  const coverDate = entry['prism:coverDate'] || '';
  const openAccess = entry.openaccessFlag === true || entry.openaccess === '1';

  const keywordsRaw = entry.authkeywords;
  const keywords = typeof keywordsRaw === 'string'
    ? keywordsRaw.split('|').map(k => k.trim()).filter(Boolean).slice(0, 12)
    : undefined;

  const normalized = {
    id: scopusId || entry.eid || doi,
    title: entry['dc:title'] || '(untitled)',
    authors: authorList(entry),
    year: coverDate ? coverDate.slice(0, 4) : undefined,
    venue: entry['prism:publicationName'] || undefined,
    volume: entry['prism:volume'] || undefined,
    issue: entry['prism:issueIdentifier'] || undefined,
    pageRange: entry['prism:pageRange'] || undefined,
    doi,
    docType: entry.subtypeDescription || undefined,
    citedBy: entry['citedby-count'] != null ? Number(entry['citedby-count']) : undefined,
    openAccess,
    abstract: truncate(entry['dc:description'], MAX_ABSTRACT_CHARS),
    keywords: keywords && keywords.length ? keywords : undefined,

    links: (() => {
      const scopusLink = linkHref(entry, 'scopus');
      return scopusLink ? { scopus: scopusLink } : {};
    })(),
  };
  normalized.links = buildPaperLinks(normalized);
  return normalized;
}

function buildUrl(query, count, view) {
  const params = new URLSearchParams({
    query,
    count: String(count),
    httpAccept: 'application/json',
  });
  if (view) params.set('view', view);
  return `${SEARCH_URL}?${params.toString()}`;
}



async function searchScopus({ query, count } = {}) {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) return { error: 'A Scopus query string is required.' };

  const requested = Number(count);
  const safeCount = Math.max(1, Math.min(MAX_COUNT, Number.isFinite(requested) ? requested : DEFAULT_COUNT));

  let view = 'COMPLETE';
  let response;
  try {
    response = await fetchJson(buildUrl(trimmed, safeCount, view));

    if (!response.ok && isAuthorizationError(response.status, response.body)) {
      view = 'STANDARD';
      response = await fetchJson(buildUrl(trimmed, safeCount, null));
    }
  } catch (err) {
    const reason = err && err.name === 'AbortError' ? 'the request timed out' : err && err.message;
    return { error: `Could not reach Scopus (${reason || 'unknown error'}).` };
  }

  if (!response.ok) {
    const detail = scopusErrorText(response.body);
    if (response.status === 429) {
      return { error: 'Scopus rate limit or quota exceeded. Try again later.' };
    }
    return { error: `Scopus search failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}.` };
  }

  const searchResults = response.body && response.body['search-results'];
  if (!searchResults) return { error: 'Scopus returned an unexpected response.' };

  const rawEntries = Array.isArray(searchResults.entry) ? searchResults.entry : [];

  const noResults = rawEntries.length === 1 && rawEntries[0] && rawEntries[0].error;

  const results = noResults ? [] : rawEntries.map(normalizeEntry).filter(Boolean);
  const abstractsAvailable = results.some(r => !!r.abstract);

  return {
    query: trimmed,
    view,
    totalResults: Number(searchResults['opensearch:totalResults'] || 0),
    returned: results.length,
    abstractsAvailable,
    abstractNote: abstractsAvailable
      ? undefined
      : 'Abstracts are NOT available for this key/view. Judge relevance from title, source, document type and keywords only, tell the user you are working from metadata rather than the full abstract, and do not quote or invent abstract or PDF page content.',
    results,
  };
}


const SEARCH_SCOPUS_TOOL = {
  type: 'function',
  function: {
    name: 'search_scopus',
    description:
      'Search the Scopus database of peer-reviewed literature for papers relevant to the user\'s prediction goal and dataset. ' +
      'Use Scopus advanced search syntax, e.g. TITLE-ABS-KEY("RNA polymerase pausing") AND PUBYEAR > 2015. ' +
      'Returns bibliographic metadata plus links (DOI, Scopus record) and, when the API key is entitled, abstracts. ' +
      'Prefer one or two focused queries over many broad ones.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Scopus query string using Scopus search syntax (field codes such as TITLE-ABS-KEY, AUTH, PUBYEAR and boolean operators AND / OR / AND NOT).',
        },
        count: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_COUNT,
          description: `How many results to return (1-${MAX_COUNT}). Default ${DEFAULT_COUNT}.`,
        },
      },
      required: ['query'],
    },
  },
};

const PAPERS_START = '@@PAPERS@@';
const PAPERS_END = '@@END_PAPERS@@';

function normKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findCachedResult(paper, cache) {
  if (!paper || !cache.length) return null;
  const id = normKey(String(paper.id || '').replace(/^SCOPUS_ID:/i, ''));
  const doi = normKey(String(paper.doi || '').replace(/^https?:\/\/(dx\.)?doi\.org\
  const title = normKey(paper.title);

  return (
    cache.find(r => id && normKey(r.id) === id) ||
    cache.find(r => doi && r.doi && normKey(r.doi) === doi) ||
    cache.find(r => title && normKey(r.title) === title) ||
    null
  );
}




function rewritePapersBlock(content, scopusResults) {
  if (typeof content !== 'string' || !content.includes(PAPERS_START)) return content;
  const start = content.indexOf(PAPERS_START);
  const end = content.indexOf(PAPERS_END, start + PAPERS_START.length);
  if (start < 0 || end < 0) return content;

  const raw = content.slice(start + PAPERS_START.length, end).trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return content;
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray(parsed.papers)
      ? parsed.papers
      : parsed && typeof parsed === 'object'
        ? [parsed]
        : [];

  const cache = Array.isArray(scopusResults) ? scopusResults : [];
  const rewritten = list
    .filter(p => p && typeof p === 'object' && p.title)
    .map((paper, index) => {
      const hit = findCachedResult(paper, cache);
      const base = hit || paper;
      const links = hit
        ? buildPaperLinks(hit)
        : buildPaperLinks({
            id: paper.id,
            doi: paper.doi,
            openAccess: paper.openAccess === true,
            links: paper.links && typeof paper.links === 'object' ? paper.links : {},
          });

      return {
        id: base.id || paper.id || `paper-${index}`,
        title: base.title || paper.title,
        authors: base.authors || paper.authors,
        year: base.year || paper.year,
        venue: base.venue || paper.venue,
        doi: base.doi || paper.doi,
        pageRange: base.pageRange || paper.pageRange,
        openAccess: base.openAccess === true || paper.openAccess === true,
        citedBy: base.citedBy != null ? base.citedBy : paper.citedBy,
        relevance: typeof paper.relevance === 'string' ? paper.relevance : undefined,
        links,
      };
    });

  if (!rewritten.length) return content;

  const block = `${PAPERS_START}\n${JSON.stringify(rewritten)}\n${PAPERS_END}`;
  return content.slice(0, start) + block + content.slice(end + PAPERS_END.length);
}

module.exports = {
  searchScopus,
  SEARCH_SCOPUS_TOOL,
  rewritePapersBlock,
  buildPaperLinks,
  scopusRecordUrl,
  doiUrl,
};
