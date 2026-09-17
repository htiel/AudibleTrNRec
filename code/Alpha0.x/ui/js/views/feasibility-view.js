/**
 * Feasibility & synthetic-only trace view (ATR-S008 AC9):
 *
 *   1. A read-only metadata feasibility card showing narrator/series/
 *      category (and other) coverage across the synthetic catalog, with an
 *      explicit uncertainty note for anything short of full coverage.
 *   2. A clearly, separately labeled "synthetic-only" structural trace that
 *      demonstrates shared-facet edges (titles that share an author,
 *      narrator, genre, or series). It carries no score, no rank, no
 *      preference model, and no participant records — it is explicitly
 *      NOT a recommendation and must never be read as one.
 *
 * There is no ranking, feedback, or preference-input control on this page.
 */

import { h, clear, mount } from '../dom.js';
import { formatPercentKnown, formatFacetKind, formatText } from '../format.js';

function buildFeasibilityCard(rows) {
  const table = h('table', { class: 'lcars-table' }, [
    h('caption', { text: 'Read-only metadata feasibility card (catalog-wide, synthetic data only)' }),
    h('thead', {}, [
      h('tr', {}, ['Field', 'Known', 'Unknown', 'Total titles', 'Coverage']
        .map((label) => h('th', { scope: 'col', text: label }))),
    ]),
    h('tbody', {}, rows.map((row) => h('tr', {}, [
      h('td', { text: row.label }),
      h('td', { text: String(row.knownCount) }),
      h('td', { text: String(row.unknownCount) }),
      h('td', { text: String(row.total) }),
      h('td', { text: formatPercentKnown(row.percentKnown) }),
    ]))),
  ]);

  const uncertain = rows.filter((r) => r.percentKnown < 100);
  const uncertaintyNote = uncertain.length > 0
    ? h('p', { class: 'lcars-note', role: 'status', text: `Uncertainty: ${uncertain.map((r) => `${r.label} is unknown for ${r.unknownCount} of ${r.total} titles`).join('; ')}.` })
    : h('p', { class: 'lcars-note', text: 'Every measured field is fully known across the current synthetic catalog.' });

  return h('div', {}, [table, uncertaintyNote]);
}

function buildTrace(trace) {
  const { edges, shown, total, limit, truncated } = trace;
  if (edges.length === 0) {
    return h('div', {}, [
      h('p', { text: 'No shared-facet edges are available in the current synthetic catalog.' }),
      h('p', { class: 'lcars-note', text: `Showing 0 of ${total} shared-facet edges (display limit ${limit}).` }),
    ]);
  }
  const list = h('ul', { class: 'lcars-trace-list' }, edges.map((edge) => h('li', { class: 'lcars-trace-edge' }, [
    h('p', { class: 'lcars-trace-heading', text: `Shared ${formatFacetKind(edge.kind).toLowerCase()}: ${formatText(edge.name)} (${edge.titles.length} titles)` }),
    h('ul', {}, edge.titles.map((title) => h('li', { text: formatText(title) }))),
  ])));
  const disclosure = h('p', {
    class: 'lcars-note', role: 'status',
    text: truncated
      ? `Showing ${shown} of ${total} shared-facet edges. The list is capped at ${limit} edges, so this listing is incomplete.`
      : `Showing all ${shown} of ${total} shared-facet edges (display limit ${limit}).`,
  });
  return h('div', {}, [disclosure, list]);
}

export function renderFeasibilityView(root, store) {
  clear(root);
  const heading = h('h2', { id: 'feasibility-heading', text: 'Feasibility & synthetic-only trace' });

  const feasibilityHeading = h('h3', { id: 'feasibility-card-heading', text: 'Metadata feasibility card' });
  const feasibilityIntro = h('p', { class: 'lcars-view-intro', text: 'Read-only measurement of how much narrator, series, category, and other metadata the synthetic catalog actually carries. This is a feasibility measurement, not a quality judgment.' });
  const feasibilityCard = buildFeasibilityCard(store.feasibility());

  const traceHeading = h('h3', { id: 'trace-heading', text: 'Synthetic-only structural trace' });
  const traceWarning = h('p', { class: 'lcars-status-statement', text: 'This trace is entirely synthetic. It is a factual listing of which invented titles share a catalog attribute. It is not a recommendation, it does not rank titles, and it never mixes in any participant preference or listening record.' });
  const trace = buildTrace(store.sharedFacetTrace());

  const section = h('section', { 'aria-labelledby': 'feasibility-heading' }, [
    heading,
    feasibilityHeading, feasibilityIntro, feasibilityCard,
    traceHeading, traceWarning, trace,
  ]);
  mount(root, section);
}
