/**
 * Trust boundary: commercial influence is excluded by construction, not by policy text.
 *
 * Four mechanisms, in order of strength:
 *  1. `toScoringView` - the evidence contract can only see an allowlisted
 *     projection, so a commercial field has no path into it even if one is
 *     invented later.
 *  2. `assertAllowedRoute` - an affiliate/advertising-bound source is rejected
 *     as a route, not merely filtered field-by-field.
 *  3. `assertCommercialFree` - contract assertion used at ingestion and before
 *     any accepted evidence is returned.
 *  4. `stripCommercialFields` - normalization drops and reports offending fields.
 *
 * A separate rule forbids storing or deriving user identity/ideology profiles.
 */

import { TrustViolationError } from './errors.js';
import { LIMITS } from './validate.js';

/** Word tokens that may never appear in any key reaching the evidence contract. */
export const PROHIBITED_COMMERCIAL_TOKENS = Object.freeze([
  'ad', 'ads', 'advert', 'adverts', 'advertising', 'advertisement',
  'sponsor', 'sponsored', 'sponsorship', 'sponsorships',
  'affiliate', 'affiliates', 'affiliation' /* commercial sense */,
  'promo', 'promoted', 'promotion', 'promotional',
  'paid', 'payment', 'payout', 'payola', 'pay',
  'bid', 'bids', 'bidding', 'cpc', 'cpm', 'cpa',
  'margin', 'markup', 'commission', 'kickback', 'incentive', 'incentives',
  'placement', 'boost', 'boosted', 'featured', 'merchandising',
  'monetization', 'monetized', 'revenue', 'royalty', 'royalties',
  'deal', 'discount', 'price', 'pricing', 'msrp', 'sale', 'upsell',
  'partner' /* commercial partnership */, 'campaign',
  // Source ordinal / retrieval rank are excluded too: storefront order is a
  // commercially influenced signal (ATR-S010 AC1).
  'rank', 'ranks', 'ranking', 'ordinal', 'bestseller', 'trending', 'popularity',
]);

/**
 * Evidence routes that may supply candidate/catalog records. Anything bound to
 * affiliate or advertising relationships is rejected as a route, not merely
 * filtered field-by-field (ATR-S010 AC1).
 *
 * SCOPE (Worf review hardening H6): these constants express **schema
 * admissibility only** — whether a synthetic fixture record is shaped like
 * something this alpha is willing to parse. They are NOT an authorization
 * decision, NOT proof that a route was lawfully obtained, and NOT a permission
 * grant. No access-control decision anywhere may rely on them; a real
 * authorization design is out of scope for this alpha.
 */
export const ROUTE_POLICY = Object.freeze({
  purpose: 'schema-admissibility',
  grantsAuthorization: false,
  provesLawfulAccess: false,
  isAccessControl: false,
  appliesTo: 'synthetic fixture records only',
});

export const ALLOWED_EVIDENCE_ROUTES = Object.freeze([
  'synthetic-fixture',
  'participant-approved-export',
  'documented-public-api',
]);

export const PROHIBITED_EVIDENCE_ROUTES = Object.freeze([
  'affiliate-feed',
  'advertising-network',
  'sponsored-catalog',
  'retailer-promotion-feed',
  'undocumented-scrape',
]);

/** User-side keys that would constitute sensitive-trait or ideology profiling. */
export const PROHIBITED_PROFILE_TOKENS = Object.freeze([
  'political', 'politics', 'partisan', 'party', 'ideology', 'ideological',
  'religion', 'religious', 'faith', 'ethnicity', 'ethnic', 'race', 'racial',
  'sexuality', 'orientation', 'gender', 'health', 'medical', 'diagnosis',
  'disability', 'immigration', 'citizenship', 'creed', 'leaning', 'alignment',
]);

/**
 * The only book fields the evidence contract is allowed to observe. Kept as an
 * allowlist so a future ranker inherits a closed input surface.
 */
export const SCORING_VIEW_KEYS = Object.freeze([
  'bookId', 'workId', 'title', 'subtitle', 'authorIds', 'narratorIds',
  'seriesId', 'seriesPosition', 'genreIds', 'themeIds', 'language',
  'durationMinutes', 'releaseDate', 'contentFlags', 'qualityScore',
  'credibilityScore', 'viewpoint', 'topicId', 'synopsis', 'available',
  'provenance',
]);

/** Split a key into lowercase word tokens (camelCase and separators aware). */
export function keyTokens(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

function matches(key, tokens) {
  const words = keyTokens(key);
  return words.filter((w) => tokens.includes(w));
}

export function isCommercialKey(key) {
  return matches(key, PROHIBITED_COMMERCIAL_TOKENS).length > 0;
}

export function isProfilingKey(key) {
  return matches(key, PROHIBITED_PROFILE_TOKENS).length > 0;
}

/** Bounded deep scan returning every offending key path. */
export function findProhibitedKeys(value, { tokens = PROHIBITED_COMMERCIAL_TOKENS, path = '', depth = LIMITS.scanDepth } = {}) {
  const found = [];
  if (value === null || typeof value !== 'object' || depth <= 0) return found;
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      found.push(...findProhibitedKeys(item, { tokens, path: `${path}[${i}]`, depth: depth - 1 }));
    }
    return found;
  }
  for (const key of Object.keys(value)) {
    const here = path ? `${path}.${key}` : key;
    if (matches(key, tokens).length > 0) found.push(here);
    found.push(...findProhibitedKeys(value[key], { tokens, path: here, depth: depth - 1 }));
  }
  return found;
}

export function assertCommercialFree(value, where = 'input') {
  const found = findProhibitedKeys(value, { tokens: PROHIBITED_COMMERCIAL_TOKENS });
  if (found.length > 0) {
    throw new TrustViolationError(
      `${where}: commercial or paid-placement signals are prohibited recommendation inputs (${found.join(', ')})`,
      { where, keys: found, rule: 'no-advertising-or-paid-placement' },
    );
  }
  return value;
}

export function assertNoIdentityProfiling(value, where = 'user profile') {
  const found = findProhibitedKeys(value, { tokens: PROHIBITED_PROFILE_TOKENS });
  if (found.length > 0) {
    throw new TrustViolationError(
      `${where}: sensitive-trait or ideology profiling of the user is prohibited (${found.join(', ')})`,
      { where, keys: found, rule: 'no-user-identity-inference' },
    );
  }
  return value;
}

/**
 * Remove commercial fields from untrusted source data and report what was dropped,
 * so ingestion is honest rather than silently lossy.
 */
export function stripCommercialFields(value, { path = '', depth = LIMITS.scanDepth } = {}) {
  const dropped = [];
  const walk = (node, nodePath, d) => {
    if (node === null || typeof node !== 'object' || d <= 0) return node;
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${nodePath}[${i}]`, d - 1));
    const out = Object.create(null);
    for (const key of Object.keys(node)) {
      const here = nodePath ? `${nodePath}.${key}` : key;
      if (isCommercialKey(key)) {
        dropped.push(here);
        continue;
      }
      out[key] = walk(node[key], here, d - 1);
    }
    return out;
  };
  const clean = walk(value, path, depth);
  return { clean, dropped };
}

/**
 * Allowlisted projection of a catalog record. Anything not named in
 * SCORING_VIEW_KEYS cannot reach the evidence contract.
 */
export function toScoringView(book) {
  const view = Object.create(null);
  for (const key of SCORING_VIEW_KEYS) {
    if (key in book) view[key] = book[key];
  }
  assertCommercialFree(view, 'evidence view');
  return Object.freeze(view);
}

/** Route-level rejection: an affiliate/advertising-bound source is never admitted. */
export function assertAllowedRoute(route, where = 'evidence route') {
  // Schema admissibility only (see ROUTE_POLICY): passing this check grants no
  // authorization and asserts nothing about lawful access.
  if (typeof route !== 'string' || !ALLOWED_EVIDENCE_ROUTES.includes(route)) {
    throw new TrustViolationError(
      `${where}: route "${route}" is not an approved evidence route (${ALLOWED_EVIDENCE_ROUTES.join(', ')})`,
      { where, route, rule: 'approved-evidence-route-only' },
    );
  }
  return route;
}
