import { h, clear, mount } from '../dom.js';
import { formatPercentKnown, formatFacetKind, formatText } from '../format.js';

function buildFeasibilityCard(rows) {
  const table = h('table', { class: 'atnr-table' }, [
    h('caption', { text: 'Read-only metadata feasibility card (bundled synthetic fixture catalog only)' }),
    h('thead', {}, [h('tr', {}, ['Field', 'Known', 'Unknown', 'Total titles', 'Coverage'].map((label) => h('th', { scope: 'col', text: label })))]),
    h('tbody', {}, rows.map((row) => h('tr', {}, [h('td', { text: row.label }), h('td', { text: String(row.knownCount) }), h('td', { text: String(row.unknownCount) }), h('td', { text: String(row.total) }), h('td', { text: formatPercentKnown(row.percentKnown) })]))),
  ]);
  const uncertain = rows.filter((row) => row.percentKnown < 100);
  const note = uncertain.length > 0 ? h('p', { class: 'atnr-note', role: 'status', text: `Uncertainty against the bundled synthetic fixture catalog only: ${uncertain.map((row) => `${row.label} is unknown for ${row.unknownCount} of ${row.total} titles`).join('; ')}.` }) : h('p', { class: 'atnr-note', text: 'Every measured field is fully known across the bundled synthetic fixture catalog.' });
  return h('div', {}, [table, note]);
}

function buildTrace(trace) {
  const { edges, shown, total, limit, truncated } = trace;
  if (edges.length === 0) return h('div', {}, [h('p', { text: 'No shared-facet edges are available in the bundled synthetic fixture catalog.' }), h('p', { class: 'atnr-note', text: `Showing 0 of ${total} shared-facet edges (display limit ${limit}).` })]);
  return h('div', {}, [
    h('p', { class: 'atnr-note', role: 'status', text: truncated ? `Showing ${shown} of ${total} shared-facet edges from the bundled synthetic fixture catalog. The list is capped at ${limit} edges, so this listing is incomplete.` : `Showing all ${shown} of ${total} shared-facet edges from the bundled synthetic fixture catalog (display limit ${limit}).` }),
    h('ul', { class: 'atnr-trace-list' }, edges.map((edge) => h('li', { class: 'atnr-trace-edge' }, [h('p', { class: 'atnr-trace-heading', text: `Shared ${formatFacetKind(edge.kind).toLowerCase()}: ${formatText(edge.name)} (${edge.titles.length} titles)` }), h('ul', {}, edge.titles.map((title) => h('li', { text: formatText(title) })))]))),
  ]);
}

export function renderFeasibilityView(root, store) {
  clear(root);
  if (store.runtimeMode === 'private-alpha') {
    const section = h('section', { 'aria-labelledby': 'feasibility-heading' }, [
      h('h2', { id: 'feasibility-heading', tabindex: '-1', text: 'Feasibility & synthetic-only trace' }),
      h('p', { class: 'atnr-status-statement', text: 'This diagnostic is intentionally synthetic-only. It does not run against the private Audible snapshot, so the private-alpha runtime hides it rather than mixing bundled fixtures into a live session.' }),
      h('p', { class: 'atnr-note', text: 'Genre remains diagnostic-only here because no approved private source proof exists. Return to the Library or Data & lifecycle view for private-alpha work.' }),
    ]);
    mount(root, section);
    section.querySelector('h2')?.focus?.();
    return;
  }
  const section = h('section', { 'aria-labelledby': 'feasibility-heading' }, [
    h('h2', { id: 'feasibility-heading', tabindex: '-1', text: 'Feasibility & synthetic-only trace' }),
    h('h3', { id: 'feasibility-card-heading', text: 'Metadata feasibility card' }),
    h('p', { class: 'atnr-view-intro', text: 'Read-only measurement of how much narrator, series, genre, category, and other metadata the bundled synthetic fixture catalog actually carries. This is a feasibility measurement, not a quality judgment.' }),
    buildFeasibilityCard(store.feasibility()),
    h('h3', { id: 'trace-heading', text: 'Synthetic-only structural trace' }),
    h('p', { class: 'atnr-status-statement', text: 'This trace is entirely synthetic. It is a factual listing of which invented titles share a catalog attribute. It is not a recommendation, it does not rank titles, and it never mixes in any participant preference or listening record.' }),
    buildTrace(store.sharedFacetTrace()),
  ]);
  mount(root, section);
  section.querySelector('h2')?.focus?.();
}
