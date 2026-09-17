/**
 * Data & lifecycle view (ATR-S008 + ATR-S009): explicit synthetic/
 * import-only/manual-refresh/no-Audible-auth status, a consent
 * acknowledgment gate, manual refresh (including a safe induced-error
 * demonstration), disconnect, delete, and export — all touching only this
 * tab's in-memory state.
 */

import { h, clear, mount, announce, confirmAction } from '../dom.js';
import { formatDiagnostic } from '../format.js';
import { RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE, ALPHA_VERSION } from '../store.js';

const PROFILE_LABELS = Object.freeze({
  release: 'Release', platform: 'Client platform', dataSource: 'Data source',
  transport: 'UI transport', outboundNetwork: 'Outbound network access',
  audibleAccess: 'Audible/Amazon account access',
  browserAutomation: 'Browser automation', credentialHandling: 'Credential handling',
  aiProvider: 'AI provider', persistence: 'Persistence', externalDependencies: 'External dependencies',
});

const CONNECTION_LABELS = Object.freeze({
  connected: 'Connected (import-only, manual refresh available)',
  disconnected: 'Disconnected (source reference forgotten; existing evidence still inspectable)',
  deleted: 'Deleted (all synthetic data erased from this session)',
});

const PRIVATE_ERROR_LABELS = Object.freeze({
  'authorization-timeout': 'Amazon authorization timed out. No retry was started.',
  'authorization-browser-failed': 'The provider authorization window could not complete.',
  'authorization-callback-invalid': 'The provider returned an invalid authorization callback.',
  'authorization-failed': 'Amazon authorization or device registration failed.',
  'account-alias-invalid': 'Use a short local label containing letters, numbers, spaces, periods, underscores, or hyphens. Do not enter an email address or Audible identifier.',
  'connection-already-exists': 'This ATnR profile already has a persistent Audible connection.',
  'connector-not-installed': 'The private connector is not installed. Run npm run connector:setup.',
  'different-account-local-data-exists': 'Local data belongs to a different Audible account. The new temporary registration was removed; delete the old local snapshot before connecting another account.',
  'deregistration-unconfirmed': 'ATnR could not confirm device removal. The encrypted credentials were retained so you can retry. Remove the device manually in Amazon device management if needed.',
  'library-sync-failed': 'Audible synchronization failed. Existing local data was not replaced.',
  'library-response-invalid': 'Audible returned an unexpected library response. Existing local data was not replaced.',
  'snapshot-invalid-field-value': 'One or more Audible fields did not satisfy the closed local schema. Existing local data was not replaced.',
  'private-alpha-bootstrap-failed': 'The private connector could not initialize.',
});

function privateError(error) {
  const code = error?.code ?? String(error ?? '');
  return PRIVATE_ERROR_LABELS[code] ?? `The private-alpha operation stopped safely (${code || 'unknown-error'}).`;
}

function privateProfileList() {
  const dl = h('dl', { class: 'lcars-meta-list' });
  for (const [key, value] of Object.entries(PRIVATE_ALPHA_RUNTIME_PROFILE)) {
    dl.append(
      h('dt', { text: PROFILE_LABELS[key] ?? key }),
      h('dd', { text: String(value) }),
    );
  }
  return dl;
}

function renderPrivateAlphaDataView(root, store) {
  const info = store.connectionInfo ?? {};
  const local = info.local ?? {};
  const operationStatus = h('p', { class: 'lcars-form-status', role: 'status', id: 'private-operation-status' });
  let busy = false;
  let connectButton = null;
  let acknowledgeCheckbox = null;

  const setBusy = (value) => {
    busy = value;
    for (const button of root.querySelectorAll('button[data-private-operation]')) {
      button.disabled = value || (button === connectButton && !acknowledgeCheckbox?.checked);
    }
  };
  const run = async (label, operation) => {
    if (busy) return;
    setBusy(true);
    operationStatus.setAttribute('role', 'status');
    operationStatus.textContent = label;
    announce(label);
    try {
      await operation();
    } catch (error) {
      const message = privateError(error);
      operationStatus.setAttribute('role', 'alert');
      operationStatus.textContent = message;
      announce(message, { assertive: true });
      setBusy(false);
    }
  };

  const statusItems = [
    `ATnR connection: ${info.connected ? 'connected' : 'disconnected'}.`,
    `Amazon device display: ${info.providerDeviceDisplayName ?? 'Audible for iPhone'} (the upstream client does not provide a supported rename hook).`,
    `Marketplace: ${info.marketplace?.toUpperCase() ?? 'US (selected for connect)'}.`,
    `Automatic refresh: every ${info.automaticSyncIntervalMinutes ?? 15} minutes while this private server is running.`,
    `Local encrypted snapshot: ${local.hasLocalSnapshot ? `${local.itemCount} titles` : 'none'}.`,
    `Last successful sync: ${local.lastSuccessAt ?? info.lastSuccessfulSyncAt ?? 'never'}.`,
  ];
  if (local.lastErrorCode) statusItems.push(`Last sync stopped safely: ${local.lastErrorCode}.`);

  const status = h('div', { class: 'lcars-status-block' }, [
    h('p', {
      class: 'lcars-status-statement',
      text: 'Private alpha only. This build uses a community-tested, unofficial, reverse-engineered Audible client. Commercial and public shipping are mechanically blocked.',
    }),
    h('ul', {}, statusItems.map((text) => h('li', { text }))),
    h('p', {
      class: 'lcars-note',
      text: 'The device remains registered across refreshes, browser closes, app shutdowns, and restarts. It is deregistered only when you explicitly confirm Disconnect Audible.',
    }),
  ]);

  const actions = [];
  if (!info.connected) {
    const alias = h('input', {
      id: 'audible-account-alias',
      name: 'audible-account-alias',
      type: 'text',
      maxlength: '64',
      autocomplete: 'off',
      value: 'Personal Audible US',
    });
    const acknowledge = h('input', { id: 'private-alpha-ack', type: 'checkbox' });
    const connect = h('button', {
      type: 'button',
      class: 'lcars-btn lcars-btn-primary',
      text: 'Connect Audible in Edge',
      disabled: true,
      'data-private-operation': 'connect',
      onclick: () => run('Waiting for you to authorize ATnR on Amazon\u2019s page\u2026', async () => {
        await store.connectionApi.connect(alias.value.trim());
        window.location.reload();
      }),
    });
    acknowledgeCheckbox = acknowledge;
    connectButton = connect;
    acknowledge.onchange = () => { connect.disabled = !acknowledge.checked || busy; };
    actions.push(
      h('div', { class: 'lcars-field lcars-field-wide' }, [
        h('label', { for: 'audible-account-alias', class: 'lcars-field-label', text: 'Private local account label' }),
        alias,
      ]),
      h('div', { class: 'lcars-checkbox-row' }, [
        acknowledge,
        h('label', { for: 'private-alpha-ack', text: 'I understand this is an unofficial private integration and is not approved for commercial or public shipping.' }),
      ]),
      connect,
    );
  } else {
    actions.push(
      h('button', {
        type: 'button',
        class: 'lcars-btn lcars-btn-primary',
        text: 'Sync now',
        'data-private-operation': 'sync',
        onclick: () => run('Synchronizing your Audible library\u2026', async () => {
          await store.connectionApi.sync();
          window.location.reload();
        }),
      }),
      h('button', {
        type: 'button',
        class: 'lcars-btn lcars-btn-danger',
        text: 'Disconnect Audible',
        'data-private-operation': 'disconnect',
        onclick: async () => {
          const confirmed = await confirmAction({
            title: 'Disconnect Audible and remove the ATnR device?',
            message: 'This asks Amazon to deregister the persistent Audible device, then removes ATnR\u2019s encrypted provider credentials. Your encrypted local library snapshot remains until you delete it separately.',
            confirmLabel: 'Disconnect Audible',
          });
          if (!confirmed) return;
          run('Deregistering the Audible device\u2026', async () => {
            await store.connectionApi.disconnect();
            window.location.reload();
          });
        },
      }),
    );
  }

  if (local.hasLocalSnapshot) {
    actions.push(h('button', {
      type: 'button',
      class: 'lcars-btn lcars-btn-danger',
      text: 'Delete local library snapshot',
      'data-private-operation': 'delete-local',
      onclick: async () => {
        const confirmed = await confirmAction({
          title: 'Delete the encrypted local library snapshot?',
          message: 'This permanently removes the local Audible title snapshot. It does not disconnect or deregister the Audible device.',
          confirmLabel: 'Delete local snapshot',
        });
        if (!confirmed) return;
        run('Deleting the encrypted local snapshot\u2026', async () => {
          await store.connectionApi.deleteLocal();
          window.location.reload();
        });
      },
    }));
  }

  const section = h('section', { 'aria-labelledby': 'data-heading' }, [
    h('h2', { id: 'data-heading', text: 'Audible connection & local data' }),
    store.bootstrapError
      ? h('p', { class: 'lcars-error', role: 'alert', text: privateError({ code: store.bootstrapError }) })
      : null,
    status,
    h('section', { 'aria-labelledby': 'private-actions-heading' }, [
      h('h3', { id: 'private-actions-heading', text: info.connected ? 'Connection controls' : 'Connect this private alpha' }),
      h('div', { class: 'lcars-form-actions' }, actions),
      operationStatus,
    ]),
    h('h3', { text: `Runtime profile (alpha ${ALPHA_VERSION})` }),
    privateProfileList(),
  ]);
  mount(root, section);
}

function buildProfileList() {
  const dl = h('dl', { class: 'lcars-meta-list' });
  for (const [key, label] of Object.entries(PROFILE_LABELS)) {
    dl.append(h('dt', { text: label }), h('dd', { text: String(RUNTIME_PROFILE[key]) }));
  }
  return dl;
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
  const rows = [
    ['Added', report.added.length],
    ['Updated', report.updated.length],
    ['Unchanged', report.unchanged.length],
    ['Missing from source', report.missingFromSource.length],
    ['Rejected', report.rejected.length],
  ];
  const dl = h('dl', { class: 'lcars-meta-list' });
  for (const [label, count] of rows) dl.append(h('dt', { text: label }), h('dd', { text: String(count) }));
  const body = [dl];
  if (report.rejected.length > 0) {
    body.push(h('p', {
      id: 'rejected-records-heading', class: 'lcars-form-status', role: 'alert',
      text: `${report.rejected.length} record(s) were safely rejected and never applied. This is the induced-error demonstration recovering correctly, not a live failure. Only the record position and a fixed problem category are shown — rejected source content is never displayed or exported.`,
    }));
    body.push(h('ul', { 'aria-labelledby': 'rejected-records-heading' },
      report.rejected.map((r) => h('li', { text: formatDiagnostic(r) }))));
  }
  return h('div', {}, body);
}

export function renderDataView(root, store, { onChanged } = {}) {
  clear(root);
  if (store.runtimeMode === 'private-alpha') {
    renderPrivateAlphaDataView(root, store);
    return;
  }
  const heading = h('h2', { id: 'data-heading', text: 'Data & lifecycle' });

  const status = h('div', { class: 'lcars-status-block' }, [
    h('p', { class: 'lcars-status-statement', text: 'This is a synthetic, import-only, offline alpha prototype. Nothing here refreshes automatically.' }),
    h('ul', {}, [
      h('li', { text: 'All books, people, and history shown anywhere in this prototype are invented fixtures.' }),
      h('li', { text: 'There is no connection to any Audible or Amazon account, and no credential of any kind is stored or requested.' }),
      h('li', { text: 'The UI loads from a loopback-only server on this computer. It sends no outbound requests; state lives only in this browser tab\u2019s memory and is lost on reload.' }),
      h('li', { text: 'The library evidence only changes when you click "Manual refresh" below \u2014 it is never refreshed on a timer or in the background.' }),
    ]),
  ]);

  const summary = store.summary();
  const connectionPara = h('p', {
    class: 'lcars-status-statement', role: 'status', id: 'connection-status',
    text: `Session status: ${CONNECTION_LABELS[summary.connectionStatus]}.`,
  });
  const summaryPara = h('p', { class: 'lcars-note', id: 'data-summary', text: `Currently in memory: ${summary.bookCount} catalog titles, ${summary.libraryEntryCount} library entries.` });

  // --- Consent acknowledgment gate for disconnect/delete ---------------------
  const consentCheckbox = h('input', {
    type: 'checkbox', id: 'consent-ack', checked: store.consentAcknowledged || undefined,
    onchange: (e) => {
      store.setConsentAcknowledged(e.target.checked);
      updateLifecycleButtons();
    },
  });
  const consentRow = h('div', { class: 'lcars-checkbox-row' }, [
    consentCheckbox,
    h('label', { for: 'consent-ack' }, [
      'I understand this is a synthetic, disposable, in-memory session, and that disconnect/delete are irreversible for this tab.',
    ]),
  ]);

  // --- Manual refresh (clean + induced-error) --------------------------------
  const refreshStatus = h('p', { class: 'lcars-form-status', role: 'status', id: 'refresh-status' });
  const reportRegion = h('div', { id: 'import-report' });
  reportRegion.appendChild(buildReportList(store.lastImportReport));

  const refreshBtn = h('button', {
    type: 'button', class: 'lcars-btn lcars-btn-primary', text: 'Manual refresh (re-import clean synthetic snapshot)',
    onclick: () => {
      const result = store.manualRefresh();
      refreshStatus.textContent = result.ok
        ? `Manual refresh completed: ${result.report.added.length} added, ${result.report.updated.length} updated, ${result.report.unchanged.length} unchanged.`
        : result.reason;
      refreshStatus.setAttribute('role', result.ok ? 'status' : 'alert');
      announce(refreshStatus.textContent, { assertive: !result.ok });
      clear(reportRegion);
      reportRegion.appendChild(buildReportList(store.lastImportReport));
      if (onChanged) onChanged();
    },
  });

  const induceErrorBtn = h('button', {
    type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Manual refresh (safe induced-error demonstration)',
    onclick: () => {
      const result = store.manualRefresh({ induceError: true });
      refreshStatus.textContent = result.ok
        ? `Manual refresh ran with a deliberately malformed fixture record: ${result.report.rejected.length} record(s) safely rejected, ${result.report.updated.length} updated.`
        : result.reason;
      refreshStatus.setAttribute('role', result.ok ? 'status' : 'alert');
      announce(refreshStatus.textContent, { assertive: !result.ok });
      clear(reportRegion);
      reportRegion.appendChild(buildReportList(store.lastImportReport));
      if (onChanged) onChanged();
    },
  });

  // --- Export --------------------------------------------------------------
  const exportBtn = h('button', {
    type: 'button', class: 'lcars-btn lcars-btn-primary', text: 'Export synthetic snapshot as JSON',
    onclick: () => {
      downloadJson('audible-track-and-recommend-alpha-export.json', store.exportState());
      announce('Exported the current synthetic snapshot as a JSON file. This export never leaves your device and is never sent anywhere.');
    },
  });

  // --- Disconnect ------------------------------------------------------------
  const disconnectBtn = h('button', {
    type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Disconnect (stop synthetic import)',
    onclick: async () => {
      const confirmed = await confirmAction({
        title: 'Disconnect this synthetic session?',
        message: 'This stops any further manual refresh and forgets the synthetic source reference. The already-imported library evidence stays visible for inspection until you separately delete it. This cannot be undone in this tab.',
        confirmLabel: 'Disconnect',
      });
      if (!confirmed) return;
      const result = store.disconnect();
      announce(result.ok ? 'Disconnected. Manual refresh is no longer available.' : result.reason, { assertive: !result.ok });
      renderDataView(root, store, { onChanged });
      if (onChanged) onChanged();
    },
  });

  // --- Delete ------------------------------------------------------------------
  const deleteBtn = h('button', {
    type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Delete all synthetic data',
    onclick: async () => {
      const confirmed = await confirmAction({
        title: 'Delete all synthetic data?',
        message: 'This erases every catalog title and library entry held in this browser tab\u2019s memory, right now. It cannot be undone: the only way to see data again is to reload the page, which reseeds the original synthetic fixtures from scratch. Any file you already exported stays on your device; deletion here does not reach it.',
        confirmLabel: 'Delete everything',
      });
      if (!confirmed) return;
      const result = store.deleteAll();
      announce(result.ok ? 'Deleted all synthetic data from this session.' : result.reason, { assertive: !result.ok });
      renderDataView(root, store, { onChanged });
      if (onChanged) onChanged();
    },
  });

  function updateLifecycleButtons() {
    const gated = !store.consentAcknowledged || summary.connectionStatus === 'deleted';
    disconnectBtn.disabled = gated || summary.connectionStatus === 'disconnected';
    deleteBtn.disabled = gated;
    refreshBtn.disabled = !store.canRefresh();
    induceErrorBtn.disabled = !store.canRefresh();
  }
  updateLifecycleButtons();

  const refreshSection = h('section', { 'aria-labelledby': 'refresh-heading' }, [
    h('h3', { id: 'refresh-heading', text: 'Manual, import-only refresh' }),
    h('div', { class: 'lcars-form-actions' }, [refreshBtn, induceErrorBtn]),
    refreshStatus,
    reportRegion,
  ]);

  const lifecycleSection = h('section', { 'aria-labelledby': 'lifecycle-heading' }, [
    h('h3', { id: 'lifecycle-heading', text: 'Lifecycle controls' }),
    consentRow,
    h('div', { class: 'lcars-form-actions' }, [exportBtn, disconnectBtn, deleteBtn]),
  ]);

  const profileHeading = h('h3', { text: `Runtime profile (alpha ${ALPHA_VERSION})` });
  const profileList = buildProfileList();

  const section = h('section', { 'aria-labelledby': 'data-heading' }, [
    heading, status, connectionPara, summaryPara,
    refreshSection, lifecycleSection,
    profileHeading, profileList,
  ]);
  mount(root, section);
}
