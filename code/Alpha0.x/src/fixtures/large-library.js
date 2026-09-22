/**
 * Deterministic large-library fixtures for bound and cost measurement.
 *
 * These are **synthetic**: generated titles, generated people, generated
 * series. No real library content, no provider identifier and no personal
 * value appears here, so a 20,000-title fixture can live in the repository
 * and run in CI without exposing anything.
 *
 * The generator is seeded and pure: the same `count` always produces the
 * same snapshot, so a row-count gate or a timing observation is reproducible
 * rather than anecdotal.
 *
 * Shape notes, chosen to exercise the honest-unknown paths rather than a
 * flattering best case:
 *  - roughly one title in three has **no series** (series evidence unknown),
 *  - roughly one in seven has **no narrator**,
 *  - statuses and progress cycle across the full listening-status vocabulary,
 *  - author and series cardinality grows sub-linearly, so large fixtures
 *    produce many-title groups (the expensive grouping case).
 */

const SOURCE = 'audible-community-private-api';
const OBSERVED_AT = '2026-09-17T12:00:00.000Z';

const STATUSES = Object.freeze([
  'completed', 'in-progress', 'not-started', 'want-to-listen', 'abandoned', 'unknown',
]);

const pad = (value, width = 6) => String(value).padStart(width, '0');

/**
 * Deterministic, cheap, *decorrelated* spread.
 *
 * The salt matters. An earlier version derived every attribute from one
 * multiplier, which made "has a series" and "is completed" perfectly
 * correlated - a fixture that quietly tested a much easier shape than a real
 * library. Salting and mixing keeps the generator pure and reproducible while
 * making the attributes independent of one another.
 */
function spread(index, modulus, salt = 0) {
  let hash = Math.imul(index + 0x9e37 + salt * 0x85eb, 2654435761);
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  hash ^= hash >>> 13;
  return (hash >>> 0) % modulus;
}

/**
 * Build a synthetic live snapshot of `count` titles.
 *
 * @param {number} count number of titles
 * @param {{observedAt?: string}} [options]
 */
export function buildLargeLibrarySnapshot(count, { observedAt = OBSERVED_AT } = {}) {
  const authorCount = Math.max(1, Math.ceil(count / 12));
  const narratorCount = Math.max(1, Math.ceil(count / 9));
  const seriesCount = Math.max(1, Math.ceil(count / 15));

  const people = [];
  for (let i = 0; i < authorCount; i += 1) {
    people.push({
      personId: `p-author-${pad(i)}`,
      displayName: `Synthetic Author ${pad(i)}`,
      roles: ['author'],
      identityBasis: 'provider-id',
    });
  }
  for (let i = 0; i < narratorCount; i += 1) {
    people.push({
      personId: `p-narrator-${pad(i)}`,
      displayName: `Synthetic Narrator ${pad(i)}`,
      roles: ['narrator'],
      identityBasis: 'provider-id',
    });
  }

  const facets = [];
  for (let i = 0; i < seriesCount; i += 1) {
    facets.push({
      facetId: `s-series-${pad(i)}`,
      type: 'series',
      name: `Synthetic Series ${pad(i)}`,
      identityBasis: 'provider-id',
    });
  }

  const books = [];
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const bookId = `b-title-${pad(i)}`;
    const hasSeries = spread(i, 3, 1) !== 0;
    const hasNarrator = spread(i, 7, 2) !== 0;
    const status = STATUSES[spread(i, STATUSES.length, 3)];
    books.push({
      bookId,
      workId: `w-title-${pad(i)}`,
      title: `Synthetic Title ${pad(i)}`,
      subtitle: i % 5 === 0 ? `Synthetic Subtitle ${pad(i)}` : null,
      authorIds: [`p-author-${pad(spread(i, authorCount))}`],
      narratorIds: hasNarrator ? [`p-narrator-${pad(spread(i, narratorCount))}`] : [],
      genreIds: [],
      themeIds: [],
      seriesId: hasSeries ? `s-series-${pad(spread(i, seriesCount))}` : null,
      seriesPosition: hasSeries ? (i % 9) + 1 : null,
      language: 'en',
      durationMinutes: 180 + spread(i, 900),
      synopsis: `Synthetic synopsis for title ${pad(i)}.`,
      available: true,
    });
    entries.push({
      bookId,
      status,
      percentComplete: status === 'completed' ? 100 : (status === 'in-progress' ? spread(i, 99) + 1 : null),
      acquiredAt: '2026-01-01T00:00:00.000Z',
    });
  }

  return {
    schemaVersion: 1,
    source: SOURCE,
    marketplace: 'us',
    observedAt,
    catalog: { people, facets, books },
    entries,
  };
}

/** The fixture sizes the bound is gated against. */
export const LARGE_LIBRARY_SIZES = Object.freeze([180, 1000, 20000]);
