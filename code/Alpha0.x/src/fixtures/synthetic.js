/**
 * Synthetic fixtures. Entirely invented data: no real Audible identifiers,
 * no real accounts, and no imported catalog content. Includes adversarial
 * records (commercial fields, malformed rows, low-credibility titles) so the
 * trust and failure-isolation contracts are executable.
 */

export const SYNTHETIC_PEOPLE = Object.freeze([
  { personId: 'p-ashgrove', displayName: 'Marin Ashgrove', sortName: 'Ashgrove, Marin', roles: ['author'] },
  { personId: 'p-wheatly', displayName: 'Del Wheatly', sortName: 'Wheatly, Del', roles: ['narrator'] },
  { personId: 'p-reyes', displayName: 'Ines Reyes', sortName: 'Reyes, Ines', roles: ['author', 'narrator'] },
  { personId: 'p-okonjo', displayName: 'Tam Okonjo', sortName: 'Okonjo, Tam', roles: ['author'] },
  { personId: 'p-lind', displayName: 'Bo Lind', sortName: 'Lind, Bo', roles: ['narrator'] },
  { personId: 'p-hart', displayName: 'Nell Hart', sortName: 'Hart, Nell', roles: ['author'] },
  { personId: 'p-navarro', displayName: 'Ciro Navarro', sortName: 'Navarro, Ciro', roles: ['author'] },
  { personId: 'p-quill', displayName: 'Ada Quill', sortName: 'Quill, Ada', roles: ['author'] },
  { personId: 'p-castellanos', displayName: 'Rea Castellanos', sortName: 'Castellanos, Rea', roles: ['author'] },
  { personId: 'p-doubt', displayName: 'Vex Doubt', sortName: 'Doubt, Vex', roles: ['author'] },
]);

export const SYNTHETIC_FACETS = Object.freeze([
  { facetId: 'g-fantasy', type: 'genre', name: 'Fantasy' },
  { facetId: 'g-litrpg', type: 'genre', name: 'LitRPG' },
  { facetId: 'g-space-opera', type: 'genre', name: 'Space Opera' },
  { facetId: 'g-policy', type: 'genre', name: 'Housing Policy' },
  { facetId: 'c-history', type: 'category', name: 'History' },
  { facetId: 't-worldbuilding', type: 'theme', name: 'Worldbuilding' },
  { facetId: 't-long-arc', type: 'theme', name: 'Long Story Arc' },
  { facetId: 't-strong-characters', type: 'theme', name: 'Strong Characters' },
  { facetId: 's-ringbearer', type: 'series', name: 'The Ring Bearer' },
  { facetId: 's-dungeon', type: 'series', name: 'Dungeon Cycle' },
]);

const base = { language: 'en', available: true, qualityScore: 0.7, credibilityScore: 0.7 };

export const SYNTHETIC_BOOKS = Object.freeze([
  {
    ...base,
    bookId: 'b-ring-1', workId: 'w-ring-1', title: 'The Ring Bearer, Book One',
    authorIds: ['p-ashgrove'], narratorIds: ['p-wheatly'], seriesId: 's-ringbearer', seriesPosition: 1,
    genreIds: ['g-fantasy'], themeIds: ['t-worldbuilding', 't-long-arc'], durationMinutes: 1200,
    releaseDate: '2021-03-01T00:00:00.000Z', coverRef: 'synthetic://cover/ring-1',
    synopsis: 'A cartographer inherits a map that redraws itself.',
  },
  {
    ...base,
    bookId: 'b-ring-2', workId: 'w-ring-2', title: 'The Ring Bearer, Book Two',
    authorIds: ['p-ashgrove'], narratorIds: ['p-wheatly'], seriesId: 's-ringbearer', seriesPosition: 2,
    genreIds: ['g-fantasy'], themeIds: ['t-worldbuilding', 't-long-arc'], durationMinutes: 1320,
    releaseDate: '2022-03-01T00:00:00.000Z', synopsis: 'The map begins redrawing its reader.',
  },
  {
    ...base,
    bookId: 'b-ring-3', workId: 'w-ring-3', title: 'The Ring Bearer, Book Three',
    authorIds: ['p-ashgrove'], narratorIds: ['p-wheatly'], seriesId: 's-ringbearer', seriesPosition: 3,
    genreIds: ['g-fantasy'], themeIds: ['t-worldbuilding', 't-long-arc'], durationMinutes: 1410,
    releaseDate: '2023-03-01T00:00:00.000Z', synopsis: 'The cartographer meets the cartographer.',
  },
  {
    ...base,
    bookId: 'b-ring-1-deluxe', workId: 'w-ring-1', title: 'The Ring Bearer, Book One (Deluxe Edition)',
    authorIds: ['p-ashgrove'], narratorIds: ['p-lind'], seriesId: 's-ringbearer', seriesPosition: 1,
    genreIds: ['g-fantasy'], themeIds: ['t-worldbuilding'], durationMinutes: 1260,
    synopsis: 'Alternate narration of the first volume.',
  },
  {
    ...base,
    bookId: 'b-dungeon-1', workId: 'w-dungeon-1', title: 'Dungeon Cycle: Respawn',
    authorIds: ['p-reyes'], narratorIds: ['p-reyes'], seriesId: 's-dungeon', seriesPosition: 1,
    genreIds: ['g-litrpg'], themeIds: ['t-long-arc'], durationMinutes: 900,
    synopsis: 'A queue manager is reborn as a dungeon queue.',
  },
  {
    ...base,
    bookId: 'b-dungeon-2', workId: 'w-dungeon-2', title: 'Dungeon Cycle: Rebalance',
    authorIds: ['p-reyes'], narratorIds: ['p-reyes'], seriesId: 's-dungeon', seriesPosition: 2,
    genreIds: ['g-litrpg'], themeIds: ['t-long-arc'], durationMinutes: 960,
    synopsis: 'Patch notes with consequences.',
  },
  {
    ...base,
    bookId: 'b-stars-quiet', workId: 'w-stars-quiet', title: 'Quiet Stars',
    authorIds: ['p-okonjo'], narratorIds: ['p-wheatly'], genreIds: ['g-space-opera'],
    themeIds: ['t-strong-characters'], durationMinutes: 780, synopsis: 'A generation ship votes on silence.',
  },
  {
    ...base,
    bookId: 'b-stars-loud', workId: 'w-stars-loud', title: 'Loud Stars',
    authorIds: ['p-okonjo'], narratorIds: ['p-lind'], genreIds: ['g-space-opera'],
    themeIds: ['t-strong-characters'], durationMinutes: 810, synopsis: 'The same ship reconsiders.',
  },
  {
    ...base,
    bookId: 'b-stars-dim', workId: 'w-stars-dim', title: 'Dim Stars',
    authorIds: ['p-okonjo'], narratorIds: ['p-wheatly'], genreIds: ['g-space-opera'],
    themeIds: ['t-strong-characters'], durationMinutes: 840, synopsis: 'A third vote, quietly.',
  },
  // --- Housing-policy topic cluster: uncertain viewpoint metadata only. ---
  {
    ...base,
    bookId: 'b-policy-market-a', workId: 'w-policy-market-a', title: 'Supply and the City',
    authorIds: ['p-hart'], narratorIds: ['p-lind'], genreIds: ['g-policy'], themeIds: [],
    topicId: 'topic-urban-housing', durationMinutes: 600, qualityScore: 0.8, credibilityScore: 0.8,
    viewpoint: { label: 'market-oriented', confidence: 0.7, source: 'synthetic-catalog-classifier' },
    synopsis: 'An argument for building more housing faster.',
  },
  {
    ...base,
    bookId: 'b-policy-market-b', workId: 'w-policy-market-b', title: 'Zoning Unbound',
    authorIds: ['p-navarro'], narratorIds: ['p-lind'], genreIds: ['g-policy'], themeIds: [],
    topicId: 'topic-urban-housing', durationMinutes: 540, qualityScore: 0.78, credibilityScore: 0.8,
    viewpoint: { label: 'market-oriented', confidence: 0.66, source: 'synthetic-catalog-classifier' },
    synopsis: 'A history of land-use rules.',
  },
  {
    ...base,
    bookId: 'b-policy-market-c', workId: 'w-policy-market-c', title: 'The Permit Line',
    authorIds: ['p-quill'], narratorIds: ['p-lind'], genreIds: ['g-policy'], themeIds: [],
    topicId: 'topic-urban-housing', durationMinutes: 520, qualityScore: 0.75, credibilityScore: 0.78,
    viewpoint: { label: 'market-oriented', confidence: 0.61, source: 'synthetic-catalog-classifier' },
    synopsis: 'Reporting from a permitting office.',
  },
  {
    ...base,
    bookId: 'b-policy-community-a', workId: 'w-policy-community-a', title: 'Held in Common',
    authorIds: ['p-castellanos'], narratorIds: ['p-lind'], genreIds: ['g-policy'], themeIds: [],
    topicId: 'topic-urban-housing', durationMinutes: 560, qualityScore: 0.82, credibilityScore: 0.85,
    viewpoint: { label: 'community-oriented', confidence: 0.65, source: 'synthetic-catalog-classifier' },
    synopsis: 'A study of tenant-led housing trusts.',
  },
  {
    ...base,
    bookId: 'b-policy-fringe', workId: 'w-policy-fringe', title: 'They Built It All in Secret',
    authorIds: ['p-doubt'], narratorIds: ['p-lind'], genreIds: ['g-policy'], themeIds: [],
    topicId: 'topic-urban-housing', durationMinutes: 500, qualityScore: 0.3, credibilityScore: 0.2,
    contentFlags: ['misinformation'],
    viewpoint: { label: 'anti-establishment', confidence: 0.4, source: 'synthetic-catalog-classifier' },
    synopsis: 'Unsupported claims about municipal planning.',
  },
  // --- Honest-unknown record: missing narrator, duration, synopsis, viewpoint. ---
  {
    ...base,
    bookId: 'b-field-notes', workId: 'w-field-notes', title: 'Field Notes',
    authorIds: ['p-quill'], narratorIds: [], genreIds: ['c-history'], themeIds: [],
    qualityScore: null, credibilityScore: null,
  },
  // --- Preference-filter fixtures. ---
  {
    ...base,
    bookId: 'b-sternenklang', workId: 'w-sternenklang', title: 'Sternenklang',
    authorIds: ['p-okonjo'], narratorIds: ['p-lind'], genreIds: ['g-space-opera'], themeIds: [],
    language: 'de', durationMinutes: 700, synopsis: 'Ein leiser Weltraumroman.',
  },
  {
    ...base,
    bookId: 'b-harsh-words', workId: 'w-harsh-words', title: 'Harsh Words',
    authorIds: ['p-quill'], narratorIds: ['p-lind'], genreIds: ['g-fantasy'], themeIds: [],
    contentFlags: ['explicit-language'], durationMinutes: 400, synopsis: 'Blunt fantasy.',
  },
  {
    ...base,
    bookId: 'b-out-of-print', workId: 'w-out-of-print', title: 'Out of Print',
    authorIds: ['p-quill'], narratorIds: ['p-lind'], genreIds: ['g-fantasy'], themeIds: [],
    available: false, durationMinutes: 300, synopsis: 'Unavailable title.',
  },
  {
    ...base,
    bookId: 'b-very-long', workId: 'w-very-long', title: 'The Very Long Chronicle',
    authorIds: ['p-ashgrove'], narratorIds: ['p-wheatly'], genreIds: ['g-fantasy'],
    themeIds: ['t-worldbuilding'], durationMinutes: 4200, synopsis: 'Seventy hours of maps.',
  },
  // --- Adversarial: commercial fields must be stripped at ingestion. ---
  {
    ...base,
    bookId: 'b-paid-special', workId: 'w-paid-special', title: 'Paid Placement Special',
    authorIds: ['p-quill'], narratorIds: ['p-lind'], genreIds: ['g-fantasy'],
    themeIds: ['t-worldbuilding'], durationMinutes: 480, synopsis: 'A perfectly ordinary book.',
    sponsoredRank: 1,
    affiliatePayoutUsd: 9.99,
    promotionTier: 'gold',
    retailerMargin: 0.42,
    adCampaignId: 'camp-001',
  },
]);

/** Source-owned listening snapshot (imported, never locally edited). */
export const SYNTHETIC_SNAPSHOT = Object.freeze([
  { bookId: 'b-ring-1', status: 'completed', percentComplete: 100, positionSeconds: 72000, acquiredAt: '2024-01-05T00:00:00.000Z', lastListenedAt: '2024-02-01T00:00:00.000Z', completedAt: '2024-02-01T00:00:00.000Z' },
  { bookId: 'b-ring-2', status: 'in-progress', percentComplete: 42, positionSeconds: 33000, acquiredAt: '2024-02-02T00:00:00.000Z', lastListenedAt: '2026-09-10T00:00:00.000Z' },
  { bookId: 'b-stars-quiet', status: 'completed', percentComplete: 100, acquiredAt: '2023-06-01T00:00:00.000Z', lastListenedAt: '2023-07-01T00:00:00.000Z', completedAt: '2023-07-01T00:00:00.000Z' },
  { bookId: 'b-stars-loud', status: 'abandoned', percentComplete: 18, acquiredAt: '2023-08-01T00:00:00.000Z', lastListenedAt: '2023-08-11T00:00:00.000Z' },
  { bookId: 'b-dungeon-1', status: 'not-started', acquiredAt: '2025-11-01T00:00:00.000Z' },
  { bookId: 'b-field-notes', status: 'unknown' },
]);

/** Second import: one progress change, one new row, one malformed row, one duplicate. */export const SYNTHETIC_SNAPSHOT_V2 = Object.freeze([
  ...SYNTHETIC_SNAPSHOT.map((e) => (e.bookId === 'b-ring-2' ? { ...e, percentComplete: 55, positionSeconds: 44000 } : e)),
  { bookId: 'b-dungeon-2', status: 'want-to-listen' },
  { bookId: 'b-dungeon-2', status: 'not-started' },
  { bookId: 'not a valid id!!', status: 'completed' },
  { bookId: 'b-harsh-words', status: 'nonsense-status' },
]);

/**
 * Locally authored records (ATR-S003 AC4 sentinel data).
 *
 * Alpha 0.0.1 ships NO ratings/comments feature: these are inert fixtures used
 * only to prove that repeated source imports cannot write, delete, or repoint
 * locally owned records. No module in this build reads them as product input.
 */
export const SYNTHETIC_LOCAL_SENTINELS = Object.freeze([
  Object.freeze({
    sentinelId: 'local-annotation-ring-1', kind: 'annotation', subjectId: 'b-ring-1',
    authority: 'local', source: 'local-user', note: 'synthetic local note (not a rating feature)',
    createdAt: '2024-02-02T00:00:00.000Z',
  }),
  Object.freeze({
    sentinelId: 'local-narrator-sentinel', kind: 'narrator-sentinel', subjectId: 'p-wheatly',
    authority: 'local', source: 'local-user', note: 'synthetic narrator sentinel',
    createdAt: '2024-02-02T00:00:00.000Z',
  }),
  Object.freeze({
    sentinelId: 'local-series-sentinel', kind: 'series-sentinel', subjectId: 's-ringbearer',
    authority: 'local', source: 'local-user', note: 'synthetic series sentinel',
    createdAt: '2024-02-02T00:00:00.000Z',
  }),
]);
