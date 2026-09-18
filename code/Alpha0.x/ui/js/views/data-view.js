import { h, clear, mount, announce, confirmAction } from '../dom.js';
import { formatDiagnostic } from '../format.js';
import { RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE, ALPHA_VERSION } from '../../../src/index.js';
import { describePrivateError } from '../private-alpha-messages.js';

/**
 * Human-readable label for every field that can appear in either
 * `RUNTIME_PROFILE` (synthetic) or `PRIVATE_ALPHA_RUNTIME_PROFILE` (private
 * alpha). Both profiles are rendered from this single map so a field never
 * silently renders its raw camelCase key, and a key present in one profile
 * but not the other is still labeled correctly rather than falling back.
 */
export const PROFILE_LABELS = Object.freeze({
  release: 'Release', platform: 'Client platform', dataSource: 'Data source', transport: 'UI transport',
  outboundNetwork: 'Outbound network access', audibleAccess: 'Audible/Amazon account access',
  browserAutomation: 'Browser automation', credentialHandling: 'Credential handling', aiProvider: 'AI provider',
  persistence: 'Persistence', externalDependencies: 'External dependencies',
  localState: 'Local library state', syntheticFallback: 'Synthetic fallback policy',
  distribution: 'Distribution', ratingsFeature: 'Ratings feature', recommendationEngine: 'Recommendation engine',
});

const CONNECTION_LABELS = Object.freeze({
  connected: 'Connected (import-only, manual refresh available)',
  disconnected: 'Disconnected (source reference forgotten; existing evidence still inspectable)',
  deleted: 'Deleted (all synthetic data erased from this session)',
});

/**
 * Pure projection from a runtime profile object to `{ key, label, value }`
 * rows. Each mode renders *its own* profile object here — never the other
 * mode's keys and never the label map's keys — so a field that exists only
 * in one profile can never read `undefined` out of the other.
 */
export function profileEntries(profile) {
  return Object.entries(profile ?? {}).map(([key, value]) => ({
    key,
    label: PROFILE_LABELS[key] ?? key,
    value: String(value),
  }));
}

function renderProfileList(profile) {
  const dl = h('dl', { class: 'lcars-meta-list' });
  for (const entry of profileEntries(profile)) {
    dl.append(h('dt', { text: entry.label }), h('dd', { text: entry.value }));
  }
  return dl;
}

function privateProfileList() {
  return renderProfileList(PRIVATE_ALPHA_RUNTIME_PROFILE);
}

function renderPrivateAlphaDataView(root, store) {
  const info = store.connectionInfo ?? {};
  const local = info.local ?? {};
  const localDataSuppressed = local.localDataSuppressed === true;
  const operationStatus = h('p', { class: 'lcars-form-status', role: 'status', id: 'private-operation-status' });
  let busy = false;
  let connectButton = null;
  let acknowledgeCheckbox = null;
  const setBusy = (value) => {
    busy = value;
    for (const button of root.querySelectorAll('button[data-private-operation]')) button.disabled = value || (button === connectButton && !acknowledgeCheckbox?.checked);
  };
  const run = async (label, operation) => {
    if (busy) return;
    setBusy(true);
    operationStatus.setAttribute('role', 'status');
    operationStatus.textContent = label;
    announce(label);
    try { await operation(); setBusy(false); } catch (error) { const message = describePrivateError(error); operationStatus.setAttribute('role', 'alert'); operationStatus.textContent = message; announce(message, { assertive: true }); setBusy(false); }
  };

  const statusItems = [
    `ATnR connection: ${info.connected ? 'connected' : 'disconnected'}.`,
    `Amazon device display: ${info.providerDeviceDisplayName ?? 'Audible for iPhone'} (the upstream client does not provide a supported rename hook).`,
    `Marketplace: ${info.marketplace?.toUpperCase() ?? 'US (selected for connect)'}.`,
    `Automatic refresh: every ${info.automaticSyncIntervalMinutes ?? 15} minutes while this private server is running.`,
    `Local encrypted snapshot: ${local.hasLocalSnapshot ? 'present' : 'absent'}.`,
    `Last successful sync: ${local.lastSuccessAt ?? info.lastSuccessfulSyncAt ?? 'never'}.`,
  ];
  if (local.lastErrorCode) statusItems.push(`Last sync stopped safely: ${local.lastErrorCode}.`);

  const status = h('div', { class: 'lcars-status-block' }, [
    h('p', { class: 'lcars-status-statement', text: 'Private alpha only. This build uses a community-tested, unofficial, reverse-engineered Audible client. Commercial and public shipping are mechanically blocked.' }),
    // Redundant, closed-vocabulary disclosure: what a prior deletion actually
    // did (removed local content, paused automatic re-import) and what it did
    // not do (touch the Audible account, device authorization, or provider
    // credentials — only a confirmed Disconnect reaches those).
    localDataSuppressed ? h('p', {
      class: 'lcars-status-statement',
      role: 'status',
      id: 'local-data-suppressed-notice',
      text: 'Local library and private feedback data were deleted on this device. Automatic background sync is paused so a deleted library is never silently re-imported. Your Audible account, device authorization, and encrypted provider credentials were not affected. Sync stays paused until you explicitly choose Sync now or reconnect Audible below.',
    }) : null,
    h('ul', {}, statusItems.map((text) => h('li', { text }))),
    h('p', { class: 'lcars-note', text: 'Connection transparency appears here once. The main Library view avoids repeating source or provenance columns on every book row.' }),
  ]);

  const actions = [];
  if (!info.connected) {
    const alias = h('input', { id: 'audible-account-alias', type: 'text', maxlength: '64', autocomplete: 'off', value: 'Personal Audible US' });
    const acknowledge = h('input', { id: 'private-alpha-ack', type: 'checkbox' });
    const connect = h('button', { type: 'button', class: 'lcars-btn lcars-btn-primary', text: 'Connect Audible in Edge', disabled: true, 'data-private-operation': 'connect', onclick: () => run("Waiting for you to authorize ATnR on Amazon's page…", async () => { await store.connectionApi.connect(alias.value.trim()); window.location.reload(); }) });
    acknowledgeCheckbox = acknowledge;
    connectButton = connect;
    acknowledge.onchange = () => { connect.disabled = !acknowledge.checked || busy; };
    actions.push(h('div', { class: 'lcars-field lcars-field-wide' }, [h('label', { for: 'audible-account-alias', class: 'lcars-field-label', text: 'Private local account label' }), alias]), h('div', { class: 'lcars-checkbox-row' }, [acknowledge, h('label', { for: 'private-alpha-ack', text: 'I understand this is an unofficial private integration and is not approved for commercial or public shipping.' })]), connect);
  } else {
    const syncLabel = localDataSuppressed ? 'Sync now (resume local library data)' : 'Sync now';
    const performSync = () => run('Synchronizing your Audible library…', async () => { await store.connectionApi.sync(); window.location.reload(); });
    const syncOnClick = async () => {
      if (!localDataSuppressed) { performSync(); return; }
      // Resuming after a deletion is a deliberate decision to turn local data
      // collection back on, so it gets the same explicit confirmation as the
      // other lifecycle actions on this screen, and it says plainly what will
      // and will not change.
      const confirmed = await confirmAction({
        title: 'Resume local library data?',
        message: 'This downloads your Audible library into a new encrypted local snapshot and turns automatic background sync back on. It does not change your Audible account, device authorization, or provider credentials.',
        confirmLabel: 'Resume local data',
      });
      if (!confirmed) return;
      performSync();
    };
    actions.push(
      h('button', { type: 'button', class: 'lcars-btn lcars-btn-primary', text: syncLabel, 'data-private-operation': 'sync', onclick: syncOnClick }),
      h('button', { type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Disconnect Audible', 'data-private-operation': 'disconnect', onclick: async () => { const confirmed = await confirmAction({ title: 'Disconnect Audible and remove the ATnR device?', message: 'This asks Amazon to deregister the persistent Audible device, then removes ATnR\'s encrypted provider credentials. Your encrypted local library snapshot and private feedback remain until you delete them separately.', confirmLabel: 'Disconnect Audible' }); if (!confirmed) return; run('Deregistering the Audible device…', async () => { await store.connectionApi.disconnect(); window.location.reload(); }); } }),
    );
  }
  if (local.hasLocalSnapshot) actions.push(h('button', { type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Delete local library snapshot', 'data-private-operation': 'delete-local', onclick: async () => { const confirmed = await confirmAction({ title: 'Delete the encrypted local library snapshot?', message: 'This permanently removes the local Audible title snapshot. It does not delete saved private feedback and does not disconnect the Audible device.', confirmLabel: 'Delete local snapshot' }); if (!confirmed) return; run('Deleting the encrypted local snapshot…', async () => { await store.connectionApi.deleteLocal(); window.location.reload(); }); } }));
  actions.push(h('button', { type: 'button', class: 'lcars-btn lcars-btn-primary', text: 'Export my data as JSON', 'data-private-operation': 'export', onclick: () => run('Preparing your export…', async () => {
    const result = await store.connectionApi.exportAll();
    downloadJson('atnr-export.json', result.document);
    announce('Exported your library and private reviews to a JSON file on this device. Nothing was sent anywhere. The file is no longer protected by ATnR once saved.');
  }) }));
  actions.push(h('button', { type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Delete library and feedback data', 'data-private-operation': 'delete-all', onclick: () => run('Checking what is currently stored…', async () => {
    // Consent requires knowing what will actually go and what deletion cannot
    // reach. If the inventory cannot be loaded we stop here: a destructive
    // confirmation must never be presented over a guess.
    const inventory = await store.connectionApi.deletionInventory();
    const confirmed = await confirmAction({
      title: 'Delete all local library and feedback data?',
      message: `${describeDeletionInventory(inventory)}\n\nThis cannot be undone. You will need to unlock ATnR again afterwards.`,
      confirmLabel: 'Delete library and feedback',
    });
    if (!confirmed) return;
    await store.connectionApi.deleteAllLocal();
    window.location.reload();
  }) }));

  mount(root, h('section', { 'aria-labelledby': 'data-heading' }, [
    h('h2', { id: 'data-heading', text: 'Audible connection & local data' }),
    store.bootstrapError ? h('p', { class: 'lcars-error', role: 'alert', text: describePrivateError({ code: store.bootstrapError }) }) : null,
    status,
    h('section', { 'aria-labelledby': 'private-actions-heading' }, [h('h3', { id: 'private-actions-heading', text: info.connected ? 'Connection controls' : 'Connect this private alpha' }), h('div', { class: 'lcars-form-actions' }, actions), operationStatus]),
    h('h3', { text: `Runtime profile (alpha ${ALPHA_VERSION})` }),
    privateProfileList(),
  ]));
}

function buildProfileList() {
  return renderProfileList(RUNTIME_PROFILE);
}

/** Fixed, human-readable labels for the closed deletion-inventory vocabulary. */
export const INVENTORY_LABELS = Object.freeze({
  'encrypted-snapshot': 'Encrypted library snapshot',
  'private-reviews': 'Private ratings and comments',
  'review-tombstones': 'Review deletion markers (keys and generation only)',
  'sync-state': 'Sync state (timestamps and closed error codes)',
  'account-anchor': 'Local ownership record',
  'local-data-suppression': 'Automatic sync suppression marker (set by deletion)',
  'identity-seed': 'Identity seed',
  'provider-credentials': 'Audible provider credentials',
  'rollback-envelope': 'Retained pre-migration rollback copy',
});

/**
 * Plain-language statement of what an aggregate deletion will erase and what
 * it cannot reach. Rendered from the closed inventory only — it never shows a
 * title, an identifier or a comment, because none is present in the inventory.
 *
 * Provider credentials and the identity seed are **not** erased by this action;
 * only a confirmed Disconnect removes them. That is stated unconditionally
 * rather than inferred from the inventory, because claiming a complete erasure
 * that did not happen is worse than performing no erasure at all.
 */
/** Items an aggregate purge does not erase, and must not promise to erase. */
const NOT_ERASED_BY_PURGE = Object.freeze([
  'provider-credentials',
  'identity-seed',
  // Set *by* the deletion to stop an automatic re-import. Listing it as
  // something the deletion removes would be exactly backwards.
  'local-data-suppression',
]);

export function describeDeletionInventory(inventory) {
  const items = inventory?.items ?? [];
  const erased = items.filter((item) => item.retained === true && !NOT_ERASED_BY_PURGE.includes(item.id));
  const lines = erased.length === 0
    ? ['No local library or feedback data is currently retained.']
    : ['This will permanently erase:', ...erased.map((item) => {
      const label = INVENTORY_LABELS[item.id] ?? item.id;
      return typeof item.count === 'number' ? `• ${label} (${item.count})` : `• ${label}`;
    })];
  lines.push(
    'This does NOT erase your Audible provider credentials or the local identity seed, and it does not deregister the Audible device. Only a confirmed Disconnect does that.',
    'Automatic background sync is suppressed afterwards, so an erased library is not silently re-imported.',
  );
  // Connector-owned artifacts cannot be observed from here. Saying "removed"
  // would be a false reassurance, so say plainly that it is not known.
  const unknown = items.filter((item) => item.retained === 'unknown');
  if (unknown.length > 0) {
    lines.push(`Not checked by this screen: ${unknown.map((item) => INVENTORY_LABELS[item.id] ?? item.id).join(', ')}. These are held by the connector and are not reported as removed.`);
  }
  lines.push('What deletion cannot reach:', ...(inventory?.limitations ?? []).map((text) => `• ${text}`));
  return lines.join('\n');
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildReportList(report) {
  if (!report) return h('p', { class: 'lcars-note', text: 'No import has run yet in this session.' });
  const rows = [['Added', report.added.length], ['Updated', report.updated.length], ['Unchanged', report.unchanged.length], ['Missing from source', report.missingFromSource.length], ['Rejected', report.rejected.length]];
  const dl = h('dl', { class: 'lcars-meta-list' });
  for (const [label, count] of rows) dl.append(h('dt', { text: label }), h('dd', { text: String(count) }));
  const body = [dl];
  if (report.rejected.length > 0) {
    body.push(h('p', { id: 'rejected-records-heading', class: 'lcars-form-status', role: 'alert', text: `${report.rejected.length} record(s) were safely rejected and never applied. This is the induced-error demonstration recovering correctly, not a live failure. Only the record position and a fixed problem category are shown — rejected source content is never displayed or exported.` }));
    body.push(h('ul', { 'aria-labelledby': 'rejected-records-heading' }, report.rejected.map((entry) => h('li', { text: formatDiagnostic(entry) }))));
  }
  return h('div', {}, body);
}

export function renderDataView(root, store, { onChanged } = {}) {
  clear(root);
  if (store.runtimeMode === 'private-alpha') {
    renderPrivateAlphaDataView(root, store);
    return;
  }
  const summary = store.summary();
  const refreshStatus = h('p', { class: 'lcars-form-status', role: 'status', id: 'refresh-status' });
  const reportRegion = h('div', { id: 'import-report' });
  reportRegion.appendChild(buildReportList(store.lastImportReport));
  const refreshBtn = h('button', { type: 'button', class: 'lcars-btn lcars-btn-primary', text: 'Manual refresh (re-import clean synthetic snapshot)', onclick: () => { const result = store.manualRefresh(); refreshStatus.textContent = result.ok ? `Manual refresh completed: ${result.report.added.length} added, ${result.report.updated.length} updated, ${result.report.unchanged.length} unchanged.` : result.reason; refreshStatus.setAttribute('role', result.ok ? 'status' : 'alert'); announce(refreshStatus.textContent, { assertive: !result.ok }); clear(reportRegion); reportRegion.appendChild(buildReportList(store.lastImportReport)); if (onChanged) onChanged(); } });
  const induceErrorBtn = h('button', { type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Manual refresh (safe induced-error demonstration)', onclick: () => { const result = store.manualRefresh({ induceError: true }); refreshStatus.textContent = result.ok ? `Manual refresh ran with a deliberately malformed fixture record: ${result.report.rejected.length} record(s) safely rejected, ${result.report.updated.length} updated.` : result.reason; refreshStatus.setAttribute('role', result.ok ? 'status' : 'alert'); announce(refreshStatus.textContent, { assertive: !result.ok }); clear(reportRegion); reportRegion.appendChild(buildReportList(store.lastImportReport)); if (onChanged) onChanged(); } });
  const exportBtn = h('button', { type: 'button', class: 'lcars-btn lcars-btn-primary', text: 'Export synthetic snapshot as JSON', onclick: () => { downloadJson('audible-track-and-recommend-alpha-export.json', store.exportState()); announce('Exported the current synthetic snapshot as a JSON file. This export never leaves your device and is never sent anywhere.'); } });
  const disconnectBtn = h('button', { type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Disconnect (stop synthetic import)', onclick: async () => { const confirmed = await confirmAction({ title: 'Disconnect this synthetic session?', message: 'This stops any further manual refresh and forgets the synthetic source reference. The already-imported library evidence stays visible for inspection until you separately delete it. This cannot be undone in this tab.', confirmLabel: 'Disconnect' }); if (!confirmed) return; const result = store.disconnect(); announce(result.ok ? 'Disconnected. Manual refresh is no longer available.' : result.reason, { assertive: !result.ok }); renderDataView(root, store, { onChanged }); if (onChanged) onChanged(); } });
  const deleteBtn = h('button', { type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Delete all synthetic data', onclick: async () => { const confirmed = await confirmAction({ title: 'Delete all synthetic data?', message: 'This erases every catalog title and library entry held in this browser tab\'s memory, right now. It cannot be undone: the only way to see data again is to reload the page, which reseeds the original synthetic fixtures from scratch. Any file you already exported stays on your device; deletion here does not reach it.', confirmLabel: 'Delete everything' }); if (!confirmed) return; const result = store.deleteAll(); announce(result.ok ? 'Deleted all synthetic data from this session.' : result.reason, { assertive: !result.ok }); renderDataView(root, store, { onChanged }); if (onChanged) onChanged(); } });
  function updateLifecycleButtons() { const gated = !store.consentAcknowledged || summary.connectionStatus === 'deleted'; disconnectBtn.disabled = gated || summary.connectionStatus === 'disconnected'; deleteBtn.disabled = gated; refreshBtn.disabled = !store.canRefresh(); induceErrorBtn.disabled = !store.canRefresh(); }
  const consentCheckbox = h('input', { type: 'checkbox', id: 'consent-ack', checked: store.consentAcknowledged || undefined, onchange: (event) => { store.setConsentAcknowledged(event.target.checked); updateLifecycleButtons(); } });
  updateLifecycleButtons();
  mount(root, h('section', { 'aria-labelledby': 'data-heading' }, [
    h('h2', { id: 'data-heading', text: 'Data & lifecycle' }),
    h('div', { class: 'lcars-status-block' }, [h('p', { class: 'lcars-status-statement', text: 'This is a synthetic, import-only, offline demo. Nothing here refreshes automatically.' }), h('ul', {}, [h('li', { text: 'All books, people, and history shown anywhere in this demo are bundled synthetic fixtures.' }), h('li', { text: 'There is no connection to any Audible or Amazon account, and no credential of any kind is stored or requested.' }), h('li', { text: 'The UI loads from a loopback-only server on this computer. It sends no outbound requests; state lives only in this browser tab\'s memory and is lost on reload.' }), h('li', { text: 'The demo library only changes when you click "Manual refresh" below — it is never refreshed on a timer or in the background.' })]), ]),
    h('p', { class: 'lcars-status-statement', role: 'status', id: 'connection-status', text: `Session status: ${CONNECTION_LABELS[summary.connectionStatus]}.` }),
    h('p', { class: 'lcars-note', id: 'data-summary', text: `Currently in memory: ${summary.bookCount} catalog titles, ${summary.libraryEntryCount} library entries.` }),
    h('section', { 'aria-labelledby': 'refresh-heading' }, [h('h3', { id: 'refresh-heading', text: 'Manual, import-only refresh' }), h('div', { class: 'lcars-form-actions' }, [refreshBtn, induceErrorBtn]), refreshStatus, reportRegion]),
    h('section', { 'aria-labelledby': 'lifecycle-heading' }, [h('h3', { id: 'lifecycle-heading', text: 'Lifecycle controls' }), h('div', { class: 'lcars-checkbox-row' }, [consentCheckbox, h('label', { for: 'consent-ack' }, ['I understand this is a synthetic, disposable, in-memory session, and that disconnect/delete are irreversible for this tab.'])]), h('div', { class: 'lcars-form-actions' }, [exportBtn, disconnectBtn, deleteBtn])]),
    h('h3', { text: `Runtime profile (alpha ${ALPHA_VERSION})` }),
    buildProfileList(),
  ]));
}
