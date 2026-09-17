/**
 * Local inspection helper for the alpha 0.0.1 core. Prints deterministic
 * output for the synthetic evidence inspector and the closed evidence
 * contract. No network, no files written, no persistence, no recommendations.
 */

import { Catalog, mergeLibrarySnapshot } from '../src/core/model.js';
import { buildLibraryView, sortLibrary, filterLibrary, facetCounts } from '../src/core/library.js';
import { validateCandidateSet } from '../src/core/contract.js';
import { VALID_CANDIDATES, REJECTED_CANDIDATES, buildKnownNodes } from '../src/fixtures/contract-fixtures.js';
import {
  SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS,
  SYNTHETIC_SNAPSHOT, SYNTHETIC_SNAPSHOT_V2,
} from '../src/fixtures/synthetic.js';
import { RUNTIME_PROFILE, SYNTHETIC_NOW } from '../src/version.js';

console.log('runtime profile:', RUNTIME_PROFILE);

const catalog = new Catalog(
  { people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS },
  { source: 'synthetic-fixture', observedAt: SYNTHETIC_NOW },
);

const first = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
const repeat = mergeLibrarySnapshot(first.entries, SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
const second = mergeLibrarySnapshot(repeat.entries, SYNTHETIC_SNAPSHOT_V2, { observedAt: SYNTHETIC_NOW });

console.log('\n=== import reports ===');
console.log('import 1:', { added: first.report.added.length, updated: first.report.updated.length });
console.log('import 2 (identical input, idempotent):', {
  added: repeat.report.added.length, updated: repeat.report.updated.length, unchanged: repeat.report.unchanged.length,
});
console.log('import 3 (changed input):', {
  added: second.report.added, updated: second.report.updated,
  rejected: second.report.rejected.map((r) => `record #${r.recordIndex}: ${r.category}`),
});

const rows = buildLibraryView(catalog, second.entries);
console.log('\n=== evidence inspector (read-only) ===');
for (const row of sortLibrary(rows, { field: 'title' })) {
  const unknown = row.unknownFields.length > 0 ? ` [unknown: ${row.unknownFields.join(', ')}]` : '';
  console.log(`  ${row.title} - ${row.status} - ${row.provenance.entrySource}${unknown}`);
}
console.log('  in-progress rows:', filterLibrary(rows, { status: ['in-progress'] }).length);
console.log('  narrator facets:', facetCounts(rows, 'narrators').map((f) => `${f.value}:${f.count}`).join(', '));

console.log('\n=== closed evidence contract (NOT a recommendation) ===');
const knownNodes = buildKnownNodes(catalog);
const accepted = validateCandidateSet(VALID_CANDIDATES, { catalog, knownNodes });
for (const candidate of accepted.accepted) {
  console.log(`  accepted ${candidate.candidateId} [${candidate.label}] -> ${candidate.catalogId}`);
  for (const edge of candidate.trace) {
    console.log(`      ${edge.factorKind}:${edge.factorId} --${edge.edgeType}--> ${edge.targetKind}:${edge.targetId} (confidence ${edge.confidence})`);
  }
  for (const note of candidate.uncertainty) console.log(`      ? ${note}`);
}

const rejected = validateCandidateSet(REJECTED_CANDIDATES.map((r) => r.candidate), { catalog, knownNodes });
console.log(`\n  adversarial fixtures rejected: ${rejected.rejected.length}/${REJECTED_CANDIDATES.length}`);
for (const [i, entry] of rejected.rejected.entries()) {
  console.log(`      ${REJECTED_CANDIDATES[i].why} -> ${entry.code}`);
}
