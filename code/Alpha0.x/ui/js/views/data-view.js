import { h, clear, mount, announce, confirmAction } from '../dom.js';
import { formatDiagnostic } from '../format.js';
import { RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE, ALPHA_VERSION } from '../../../src/index.js';
import { describePrivateError } from '../private-alpha-messages.js';
import { CONNECTION_STATES, resolveConnectionState } from '../bootstrap-state.js';
import {
  EXPORT_CANCELLED_MESSAGE,
  EXPORT_COMPLETED_MESSAGE,
  buildExportConsentNotice,
  runGuardedExport,
} from '../export-consent.js';

/**
 * Neutral, theme-independent component vocabulary.
 *
 * This view no longer names a visual theme in its markup. Every element asks
 * for a *role* (`button`, `panel`, `note`, ...) and the role resolves to a
 * neutral `atnr-*` class. No theme name is emitted at all: `ui/css/components.css`
 * defines every role, and each theme restyles those same roles. Neither
 * presentation depends on the other's class names, so this view renders
 * identically-structured markup under any theme.
 *
 * Adding a role here is a UI decision that must be matched by a rule in
 * `ui/css/components.css` (owned by the UI/CSS stream). Never reintroduce a
 * theme-specific class here to borrow styling.
 */
export const NEUTRAL_COMPONENTS = Object.freeze({
  button: 'atnr-button',
  buttonPrimary: 'atnr-button-primary',
  buttonSecondary: 'atnr-button-secondary',
  buttonDanger: 'atnr-button-danger',
  panel: 'atnr-panel',
  notice: 'atnr-notice',
  statement: 'atnr-statement',
  note: 'atnr-note',
  error: 'atnr-error',
  metaList: 'atnr-meta-list',
  formActions: 'atnr-form-actions',
  formStatus: 'atnr-form-status',
  field: 'atnr-field',
  fieldWide: 'atnr-field-wide',
  fieldLabel: 'atnr-field-label',
  checkboxRow: 'atnr-checkbox-row',
});

/**
 * Resolve one or more component roles to a neutral class string. An unknown
 * role throws rather than silently rendering an unstyled element, and no
 * theme-specific class is ever produced.
 */
export function componentClass(...roles) {
  return roles.map((role) => {
    const resolved = NEUTRAL_COMPONENTS[role];
    if (!resolved) throw new Error(`unknown-component-role:${role}`);
    return resolved;
  }).join(' ');
}

/** Neutral button component; `variant` selects the emphasis, never a theme. */
function uiButton({ variant = 'primary', text, onclick, disabled = false, operation = null, id = null }) {
  const variantRole = { primary: 'buttonPrimary', secondary: 'buttonSecondary', danger: 'buttonDanger' }[variant];
  if (!variantRole) throw new Error(`unknown-button-variant:${variant}`);
  return h('button', {
    type: 'button',
    class: componentClass('button', variantRole),
    text,
    id,
    disabled: disabled || undefined,
    'data-private-operation': operation,
    onclick,
  });
}

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
 * Connection state is **consumed**, not re-derived here.
 *
 * `resolveConnectionState()` in `bootstrap-state.js` is the data/runtime
 * layer's contract (issue #8): credential presence is custody, not proof, so
 * `connected`/`verified` is true only for a recorded provider interaction.
 * This view adds presentation only. If a store already resolved the state it
 * is reused unchanged; otherwise the contract is applied to the raw status.
 *
 * Expected shape (closed vocabulary `CONNECTION_STATES`):
 *   { state, label, detail, recovery, tone, connected, credentialsPresent,
 *     verified, lastVerifiedAt, lastVerificationBasis }
 *
 * Anything that does not present a `state` string is treated as unresolved and
 * re-resolved through the contract rather than trusted.
 */
export function connectionStateOf(store) {
  const held = store?.connectionState;
  if (held && typeof held.state === 'string' && CONNECTION_STATES.includes(held.state)) return held;
  return resolveConnectionState(store?.connectionInfo ?? null);
}

/** One line of connection disclosure, taken verbatim from the contract. */
export function describeConnectionState(connection) {
  const parts = [`ATnR connection: ${connection.label}.`, connection.detail];
  if (connection.recovery) parts.push(connection.recovery);
  if (connection.verified && connection.lastVerifiedAt) {
    parts.push(`Last confirmed by a provider interaction at ${connection.lastVerifiedAt}.`);
  }
  return parts.join(' ');
}

/**
 * Data's public connection-refresh contract, consumed as published.
 *
 *   `noteSyncFailure(failure)`  -> { state, code, refreshed }
 *   `refreshConnectionState()`  -> { ok, state, code }
 *   `store.connectionState`     -> the resolved contract object
 *
 * Note carefully that neither method returns a *resolved state object*: they
 * return a report whose `state` is a bare string. The renderable object is the
 * one the store applied to itself. Treating the report as the state would put
 * `undefined` labels on screen, so the report is used only to decide whether
 * the answer was fresh, and the state is then read from the store.
 */
export const CONNECTION_REFRESH_METHODS = Object.freeze({
  afterFailure: 'noteSyncFailure',
  refresh: 'refreshConnectionState',
});

/**
 * A failed confirmation is not a revocation.
 *
 * When the runtime cannot be re-read at all (timeout, offline, server gone),
 * we know exactly two things: an authorization is still held on this device,
 * and we just failed to confirm it. So the claim is downgraded to custody by
 * asking the contract itself with the connector's verification claim removed.
 * The result is `unverified` + stale, never `authorization-failed`: inventing
 * a revocation from a network error would tell the owner their account was
 * refused when it may be perfectly healthy.
 *
 * Data deliberately lets the last known state stand when the runtime cannot be
 * asked. That is right for the store, which must not *discard* evidence. It is
 * not right for the screen, which must not keep *claiming* a verification it
 * just failed to confirm. This is the presentation-side downgrade, and it is
 * applied without editing or contradicting Data's record.
 */
export function staleConnectionAfterUnreachableRefresh(info) {
  const source = info ?? {};
  return resolveConnectionState({
    ...source,
    credentialsPresent: source.credentialsPresent === true || source.connected === true,
    connected: false,
    connectionState: null,
  });
}

export const STALE_CONNECTION_NOTICE = 'ATnR could not re-check this connection just now, so the status above may be out of date. Nothing was revoked: your stored Audible authorization and local data are untouched.';

/**
 * Re-resolve the connection after an operation failed, so a provider refusal
 * can never leave a stale "verified" claim on screen.
 *
 * Returns `{ connection, info, fresh, via }`. `fresh: false` means the runtime
 * could not be reached, and the state shown is custody-only and stale. This
 * function never throws: a failure to re-check must not become a second,
 * louder failure stacked on top of the real one.
 */
export async function refreshConnectionState(store, failure = null) {
  const previous = store?.connectionInfo ?? {};
  try {
    // Preferred: Data's failure-aware path. It records the failing code and
    // re-reads the connector's recorded evidence in one step.
    if (typeof store?.[CONNECTION_REFRESH_METHODS.afterFailure] === 'function') {
      const report = await store[CONNECTION_REFRESH_METHODS.afterFailure](failure);
      const fresh = report?.refreshed === true;
      return {
        connection: fresh ? connectionStateOf(store) : staleConnectionAfterUnreachableRefresh(store?.connectionInfo ?? previous),
        info: store?.connectionInfo ?? previous,
        fresh,
        via: CONNECTION_REFRESH_METHODS.afterFailure,
      };
    }
    // Next: Data's plain refresh.
    if (typeof store?.[CONNECTION_REFRESH_METHODS.refresh] === 'function') {
      const report = await store[CONNECTION_REFRESH_METHODS.refresh]();
      const fresh = report?.ok === true;
      return {
        connection: fresh ? connectionStateOf(store) : staleConnectionAfterUnreachableRefresh(store?.connectionInfo ?? previous),
        info: store?.connectionInfo ?? previous,
        fresh,
        via: CONNECTION_REFRESH_METHODS.refresh,
      };
    }
    // Last resort: the runtime's read-only status route, resolved through the
    // same contract. It asks what the runtime already knows and changes
    // nothing on the provider side.
    const info = await store.connectionApi.status();
    return { connection: resolveConnectionState(info), info, fresh: true, via: 'connectionApi.status' };
  } catch {
    return {
      connection: staleConnectionAfterUnreachableRefresh(previous),
      info: previous,
      fresh: false,
      via: 'unreachable',
    };
  }
}

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
  const dl = h('dl', { class: componentClass('metaList') });
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
  const connection = connectionStateOf(store);
  const operationStatus = h('p', { class: componentClass('formStatus'), role: 'status', id: 'private-operation-status' });
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
    describeConnectionState(connection),
    `Amazon device display: ${info.providerDeviceDisplayName ?? 'Audible for iPhone'} (the upstream client does not provide a supported rename hook).`,
    `Marketplace: ${info.marketplace?.toUpperCase() ?? 'US (selected for connect)'}.`,
    `Automatic refresh: every ${info.automaticSyncIntervalMinutes ?? 15} minutes while this private server is running.`,
    `Local encrypted snapshot: ${local.hasLocalSnapshot ? 'present' : 'absent'}.`,
    `Last successful sync: ${local.lastSuccessAt ?? info.lastSuccessfulSyncAt ?? 'never'}.`,
  ];
  if (local.lastErrorCode) statusItems.push(`Last sync stopped safely: ${local.lastErrorCode}.`);

  // The connection disclosure is rendered into a container that can be
  // repainted in place. A provider refusal must never leave the previous,
  // now-false claim on screen while the error message scrolls past.
  const connectionList = h('ul', { id: 'connection-status-items' }, statusItems.map((text) => h('li', { text })));
  const connectionRecovery = h('p', { class: componentClass('statement'), id: 'connection-recovery', hidden: true });
  const connectionStaleNotice = h('p', { class: componentClass('note'), id: 'connection-stale-notice', hidden: true });

  /**
   * Repaint the connection panel from a state the *runtime* produced. The view
   * never decides the state; it only stops claiming the old one.
   */
  const paintConnection = (next, { fresh = true } = {}) => {
    const nextInfo = next.info ?? {};
    const nextLocal = nextInfo.local ?? {};
    const items = [
      describeConnectionState(next.connection),
      `Amazon device display: ${nextInfo.providerDeviceDisplayName ?? 'Audible for iPhone'} (the upstream client does not provide a supported rename hook).`,
      `Marketplace: ${nextInfo.marketplace?.toUpperCase() ?? 'US (selected for connect)'}.`,
      `Automatic refresh: every ${nextInfo.automaticSyncIntervalMinutes ?? 15} minutes while this private server is running.`,
      `Local encrypted snapshot: ${nextLocal.hasLocalSnapshot ? 'present' : 'absent'}.`,
      `Last successful sync: ${nextLocal.lastSuccessAt ?? nextInfo.lastSuccessfulSyncAt ?? 'never'}.`,
    ];
    if (nextLocal.lastErrorCode) items.push(`Last sync stopped safely: ${nextLocal.lastErrorCode}.`);
    clear(connectionList);
    for (const text of items) connectionList.append(h('li', { text }));

    // Recovery guidance is shown as its own alert when the connection is not
    // usable, so an authorization refusal cannot be a quiet list entry.
    const recovery = next.connection.recovery;
    if (recovery && !next.connection.verified) {
      connectionRecovery.hidden = false;
      connectionRecovery.setAttribute('role', 'alert');
      connectionRecovery.textContent = `${next.connection.label}: ${next.connection.detail} ${recovery}`;
    } else {
      connectionRecovery.hidden = true;
      connectionRecovery.removeAttribute('role');
      connectionRecovery.textContent = '';
    }

    connectionStaleNotice.hidden = fresh;
    connectionStaleNotice.textContent = fresh ? '' : STALE_CONNECTION_NOTICE;
  };

  const status = h('div', { class: componentClass('panel'), id: 'connection-panel' }, [
    h('p', { class: componentClass('statement'), text: 'Private alpha only. This build uses a community-tested, unofficial, reverse-engineered Audible client. Commercial and public shipping are mechanically blocked.' }),
    // Redundant, closed-vocabulary disclosure: what a prior deletion actually
    // did (removed local content, paused automatic re-import) and what it did
    // not do (touch the Audible account, device authorization, or provider
    // credentials — only a confirmed Disconnect reaches those).
    localDataSuppressed ? h('p', {
      class: componentClass('statement'),
      role: 'status',
      id: 'local-data-suppressed-notice',
      text: 'Local library and private feedback data were deleted on this device. Automatic background sync is paused so a deleted library is never silently re-imported. Your Audible account, device authorization, and encrypted provider credentials were not affected. Sync stays paused until you explicitly choose Sync now or reconnect Audible below.',
    }) : null,
    connectionList,
    connectionRecovery,
    connectionStaleNotice,
    h('p', { class: componentClass('note'), text: 'Connection transparency appears here once. The main Library view avoids repeating source or provenance columns on every book row.' }),
  ]);

  // Initial paint, so an already-failed authorization shows its recovery
  // guidance on arrival and not only after a sync attempt.
  paintConnection({ connection, info }, { fresh: true });

  // Non-destructive inventory (B7). Rendered as its own panel so presence
  // ("snapshot: present") is no longer the only thing the owner can see.
  const inventoryList = h('dl', { class: componentClass('metaList'), id: 'private-inventory-items' });
  const inventoryBasis = h('p', { class: componentClass('note'), id: 'private-inventory-basis', hidden: true });
  const inventoryOther = h('p', { class: componentClass('note'), id: 'private-inventory-other', hidden: true });
  const inventoryStatus = h('p', { class: componentClass('formStatus'), role: 'status', id: 'private-inventory-status', text: INVENTORY_LOADING_MESSAGE });
  const inventoryPanel = h('section', { class: componentClass('panel'), id: 'private-inventory', 'aria-labelledby': 'private-inventory-heading' }, [
    h('h3', { id: 'private-inventory-heading', text: 'What this device is holding' }),
    h('p', { class: componentClass('note'), text: INVENTORY_PRIVACY_NOTICE }),
    inventoryList,
    inventoryBasis,
    inventoryOther,
    inventoryStatus,
  ]);

  const paintInventory = (result) => {
    const rows = summarizePrivateInventory({
      inventory: result.inventory,
      local: (store.connectionInfo ?? info)?.local ?? local,
      reported: result.reported,
    });
    clear(inventoryList);
    for (const row of rows) {
      inventoryList.append(
        h('dt', { text: row.label }),
        h('dd', { id: row.id, 'data-inventory-known': row.known ? 'true' : 'false', text: row.value }),
      );
    }
    // What those import counts describe, taken from the runtime's declared
    // basis and authority — never inferred from the numbers.
    const basis = describeImportProvenance(result.reported?.lastImport ?? null);
    inventoryBasis.hidden = basis.length === 0;
    inventoryBasis.textContent = basis;

    const other = describeRetainedArtifacts(result.inventory);
    inventoryOther.hidden = other.length === 0;
    inventoryOther.textContent = other;
    if (result.error) {
      inventoryStatus.setAttribute('role', 'alert');
      inventoryStatus.textContent = `The local inventory could not be read (${result.error}). Only counts the local status record already evidenced are shown; everything it would have confirmed is shown as unknown.`;
    } else {
      inventoryStatus.setAttribute('role', 'status');
      inventoryStatus.textContent = `Read from the local record without any destructive action (${result.via}). Counts not evidenced by the runtime are shown as unknown.`;
    }
  };

  const refreshInventory = async () => { paintInventory(await readPrivateInventory(store)); };

  const actions = [];
  // Which controls exist depends on whether an authorization is *held*
  // (custody), while what the screen *claims* depends on whether that
  // authorization was *verified* (proof). Conflating the two is exactly the
  // defect in issue #8: an unverified connection must still offer Sync and
  // Disconnect so the owner can confirm or clear it.
  if (!connection.credentialsPresent) {
    const alias = h('input', { id: 'audible-account-alias', type: 'text', maxlength: '64', autocomplete: 'off', value: 'Personal Audible US' });
    const acknowledge = h('input', { id: 'private-alpha-ack', type: 'checkbox' });
    const connect = uiButton({ variant: 'primary', text: 'Connect Audible in Edge', disabled: true, operation: 'connect', onclick: () => run("Waiting for you to authorize ATnR on Amazon's page…", async () => { await store.connectionApi.connect(alias.value.trim()); window.location.reload(); }) });
    acknowledgeCheckbox = acknowledge;
    connectButton = connect;
    acknowledge.onchange = () => { connect.disabled = !acknowledge.checked || busy; };
    actions.push(h('div', { class: componentClass('field', 'fieldWide') }, [h('label', { for: 'audible-account-alias', class: componentClass('fieldLabel'), text: 'Private local account label' }), alias]), h('div', { class: componentClass('checkboxRow') }, [acknowledge, h('label', { for: 'private-alpha-ack', text: 'I understand this is an unofficial private integration and is not approved for commercial or public shipping.' })]), connect);
  } else {
    const syncLabel = localDataSuppressed ? 'Sync now (resume local library data)' : 'Sync now';
    // A failed sync re-resolves the connection through the runtime before the
    // error is reported, so a provider authorization refusal cannot leave a
    // stale "verified" claim on screen. The refresh never invents a state: it
    // asks Data's path (or the read-only status route) and, if the runtime
    // cannot be reached at all, falls back to custody-only + stale rather than
    // reporting a revocation that never happened.
    const performSync = () => run('Synchronizing your Audible library…', async () => {
      let result;
      try {
        result = await store.connectionApi.sync();
      } catch (error) {
        const next = await refreshConnectionState(store, error);
        paintConnection(next, { fresh: next.fresh });
        throw error;
      }
      // The completed sync is the only thing that can turn the import counts
      // into measured evidence. The result is handed to Data unchanged; Data
      // decides whether it proves anything. A result carrying no
      // reconciliation is refused there, and that refusal is reported here
      // rather than papered over with invented numbers.
      const noted = typeof store[SYNC_RECONCILIATION_METHOD] === 'function'
        ? store[SYNC_RECONCILIATION_METHOD](result)
        : { ok: false, code: 'sync-reconciliation-unsupported' };
      await refreshInventory();
      if (!noted?.ok) {
        // Visible, not live-region-only: the synchronization succeeded, but it
        // proved nothing about what changed, and the owner is told so plainly.
        const message = `The synchronization completed, but it reported no reconciliation (${noted?.code ?? 'sync-reconciliation-missing'}), so the import counts stay unknown.`;
        operationStatus.setAttribute('role', 'status');
        operationStatus.textContent = message;
        announce(message);
      }
      window.location.reload();
    });
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
      uiButton({ variant: 'primary', text: syncLabel, operation: 'sync', onclick: syncOnClick }),
      uiButton({ variant: 'danger', text: 'Disconnect Audible', operation: 'disconnect', onclick: async () => { const confirmed = await confirmAction({ title: 'Disconnect Audible and remove the ATnR device?', message: 'This asks Amazon to deregister the persistent Audible device, then removes ATnR\'s encrypted provider credentials. Your encrypted local library snapshot and private feedback remain until you delete them separately.', confirmLabel: 'Disconnect Audible' }); if (!confirmed) return; run('Deregistering the Audible device…', async () => { await store.connectionApi.disconnect(); window.location.reload(); }); } }),
    );
  }
  if (local.hasLocalSnapshot) actions.push(uiButton({ variant: 'danger', text: 'Delete local library snapshot', operation: 'delete-local', onclick: async () => { const confirmed = await confirmAction({ title: 'Delete the encrypted local library snapshot?', message: 'This permanently removes the local Audible title snapshot. It does not delete saved private feedback and does not disconnect the Audible device.', confirmLabel: 'Delete local snapshot' }); if (!confirmed) return; run('Deleting the encrypted local snapshot…', async () => { await store.connectionApi.deleteLocal(); window.location.reload(); }); } }));

  // Export (issue #7). The consent prompt is raised *before* anything else:
  // `runGuardedExport()` only calls `exportAll()` after an explicit `true`,
  // so a cancelled export issues no request, obtains and spends no
  // confirmation nonce, and writes no file. A failure after consent is
  // reported as a failure by `run()`; it never degrades into a partial file.
  actions.push(uiButton({ variant: 'primary', text: 'Export my data as JSON', operation: 'export', onclick: async () => {
    if (busy) return;
    const fail = (error) => { const message = describePrivateError(error); operationStatus.setAttribute('role', 'alert'); operationStatus.textContent = message; announce(message, { assertive: true }); };
    try {
      await runGuardedExport({
        confirm: (prompt) => confirmAction(prompt),
        exportAll: async () => {
          setBusy(true);
          operationStatus.setAttribute('role', 'status');
          operationStatus.textContent = 'Preparing your export…';
          announce('Preparing your export…');
          try { return await store.connectionApi.exportAll({ consentConfirmed: true }); } finally { setBusy(false); }
        },
        deliver: (payload) => { downloadJson('atnr-export.json', payload); operationStatus.setAttribute('role', 'status'); operationStatus.textContent = EXPORT_COMPLETED_MESSAGE; announce(EXPORT_COMPLETED_MESSAGE); },
        onCancel: (message) => { operationStatus.setAttribute('role', 'status'); operationStatus.textContent = message; announce(message); },
      });
    } catch (error) { fail(error); }
  } }));
  actions.push(h('button', { type: 'button', class: componentClass('button', 'buttonDanger'), text: 'Delete library and feedback data', 'data-private-operation': 'delete-all', onclick: () => run('Checking what is currently stored…', async () => {
    // Consent requires knowing what will actually go and what deletion cannot
    // reach. If the inventory cannot be loaded we stop here: a destructive
    // confirmation must never be presented over a guess.
    const inventory = await store.connectionApi.deletionInventory();
    const confirmed = await confirmAction({
      title: 'Delete all local library and feedback data?',
      message: `${describeDeletionInventory(inventory)}\n\nThis cannot be undone. Your current session will end and the page will reload.`,
      confirmLabel: 'Delete library and feedback',
    });
    if (!confirmed) return;
    await store.connectionApi.deleteAllLocal();
    window.location.reload();
  }) }));

  mount(root, h('section', { 'aria-labelledby': 'data-heading' }, [
    h('h2', { id: 'data-heading', text: 'Audible connection & local data' }),
    store.bootstrapError ? h('p', { class: componentClass('error'), role: 'alert', text: describePrivateError({ code: store.bootstrapError }) }) : null,
    status,
    inventoryPanel,
    h('section', { 'aria-labelledby': 'private-actions-heading' }, [
      h('h3', { id: 'private-actions-heading', text: connection.credentialsPresent ? 'Connection controls' : 'Connect this private alpha' }),
      // Visible on the page, before the control is used: the export warning is
      // never live-region-only.
      buildExportConsentNotice(h, { classes: { notice: componentClass('notice'), statement: componentClass('statement') } }),
      h('div', { class: componentClass('formActions') }, actions),
      operationStatus,
    ]),
    h('h3', { text: `Runtime profile (alpha ${ALPHA_VERSION})` }),
    privateProfileList(),
  ]));

  // Non-blocking: the view is already usable, and the inventory panel states
  // plainly that it is still reading.
  refreshInventory();
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

/**
 * Non-destructive inventory (issue B7).
 *
 * The lifecycle screen previously disclosed only *presence* ("snapshot:
 * present"). Presence is not an inventory: an owner cannot consent to, or
 * audit, what they cannot count. This reads the **same authoritative
 * inventory the deletion flow reads**, without performing a destructive
 * action and without obtaining or spending a confirmation nonce —
 * `deletionInventory()` is a plain `GET /api/v1/inventory`, while every
 * destructive route goes through the nonce-protected `#confirmed()` path.
 *
 * Nothing here is inferred. A count is rendered only when the runtime
 * evidenced it; everything else is rendered as an explicit Unknown. A missing
 * number is never displayed as zero, because "0 ratings retained" is a claim
 * of erasure and a false one is worse than no answer at all.
 */
export const UNKNOWN_INVENTORY_VALUE = 'Unknown — not evidenced on this device';

/** Counts only: this panel never renders private content. */
export const INVENTORY_PRIVACY_NOTICE = 'Counts only. No book title, identifier, rating, comment or tag text is shown here. Reading this inventory performs no destructive action, obtains and spends no confirmation code, and makes no Audible or Amazon request.';

export const INVENTORY_LOADING_MESSAGE = 'Reading the local inventory…';

/**
 * Where the inventory may come from, in preference order.
 *
 * `loadInventory()` is Data's published store contract (`ui/js/private-store.js`).
 * It is a pure read of state already in memory plus a feedback-list read; it
 * starts nothing, deletes nothing and contacts no provider. Its shape is
 * consumed exactly as published:
 *
 *   { titles:     { known, count, libraryEntryCount, observedAt, reason },
 *     feedback:   { known, count, reason },
 *     lastImport: { known, observedAt, reason,
 *                   counts: { added, updated, unchanged, missingFromSource, rejected } } }
 *
 * Each section carries its own `known` flag, and that flag — not the presence
 * of a number — decides whether a count may be printed. `deletionInventory()`
 * remains only as a fallback for an older store that predates `loadInventory()`.
 *
 * Contract drift is asserted in `test/deletion-consent.test.js`: the method
 * name, the nested field names and the `known`-before-count rule are all
 * pinned against the real `PrivateAppStore`.
 */
export const INVENTORY_SOURCES = Object.freeze({
  store: 'loadInventory',
  api: 'deletionInventory',
});

/**
 * Data's recording path for a completed, requested synchronization.
 *
 * This is the only thing that can make `lastImport.known` true. The sync
 * result is passed through unchanged; Data judges whether it carries a
 * reconciliation and refuses it if not. The view never constructs, edits or
 * supplements those counts.
 */
export const SYNC_RECONCILIATION_METHOD = 'noteSyncReconciliation';

const inventoryCount = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

const inventoryItem = (inventory, id) => (inventory?.items ?? []).find((item) => item?.id === id) ?? null;

/**
 * Count for one inventory item. `retained: false` is evidenced absence and
 * therefore a genuine zero; `retained: 'unknown'` is not observable from here
 * and must never collapse into one.
 */
function retainedCount(item, fallback = null) {
  if (!item) return null;
  if (item.retained === false) return 0;
  if (item.retained !== true) return null;
  const own = inventoryCount(item.count);
  return own === null ? inventoryCount(fallback) : own;
}

/**
 * Read the inventory through the best available contract. Never throws: a
 * screen that cannot read the inventory must say so, not fail the view.
 */
export async function readPrivateInventory(store) {
  if (typeof store?.[INVENTORY_SOURCES.store] === 'function') {
    try {
      const reported = await store[INVENTORY_SOURCES.store]();
      if (reported && typeof reported === 'object') {
        return { via: INVENTORY_SOURCES.store, reported, inventory: null, error: null };
      }
      return { via: INVENTORY_SOURCES.store, reported: null, inventory: null, error: 'inventory-unavailable' };
    } catch (error) {
      return { via: INVENTORY_SOURCES.store, reported: null, inventory: null, error: error?.code ?? 'inventory-unavailable' };
    }
  }
  if (typeof store?.connectionApi?.[INVENTORY_SOURCES.api] === 'function') {
    try {
      const inventory = await store.connectionApi[INVENTORY_SOURCES.api]();
      return { via: INVENTORY_SOURCES.api, reported: null, inventory: inventory ?? null, error: inventory ? null : 'inventory-unavailable' };
    } catch (error) {
      return { via: INVENTORY_SOURCES.api, reported: null, inventory: null, error: error?.code ?? 'inventory-unavailable' };
    }
  }
  return { via: null, reported: null, inventory: null, error: 'inventory-unavailable' };
}

/**
 * Read one `{known, count, reason}` section of Data's contract.
 *
 * `known` is the authority, and it is checked *before* the number: a section
 * that says it has not looked is unknown even if it also carries a value, and
 * a section that claims `known` but carries a non-integer is treated as
 * unknown rather than printed. Defence in depth against contract drift —
 * "null" must never reach the screen as a count.
 */
function sectionCount(section, field = 'count') {
  if (!section || typeof section !== 'object' || section.known !== true) return null;
  return inventoryCount(section[field]);
}

/** Why a section is unknown, when the contract says so in a closed code. */
function sectionReason(section) {
  const reason = section?.reason;
  return typeof reason === 'string' && reason.length > 0 && reason.length <= 64 ? reason : null;
}

/**
 * Turn evidence into rows. Every row is always present; only its value
 * changes, so a field can never vanish and be mistaken for "nothing stored".
 *
 * `reported` is Data's `loadInventory()` result, consumed in its published
 * nested shape:
 *
 *   titles:     { known, count, libraryEntryCount, observedAt, basis, reason }
 *   feedback:   { known, count, basis, reason }
 *   lastImport: { known, basis, authority, observedAt, reason,
 *                 counts: { added, updated, reappeared, missingFromSource,
 *                           unchanged, rejected } }
 *
 * The import basis is **declared by the runtime**, never inferred from the
 * numbers. A parsed snapshot and a real import both produce `added: 12`; only
 * the runtime knows which one happened, so only the runtime may say.
 *
 * Every bucket is rendered under its own label. `reappeared` and
 * `missingFromSource` are never folded into `updated` or `rejected`: a title
 * that came back and a title the source stopped offering were neither changed
 * nor refused. A `null` count is Unknown — sync measures `added`, `updated`,
 * `reappeared` and `missingFromSource` but not `unchanged` or `rejected`, and
 * an unmeasured bucket must never be printed as zero.
 *
 * The `deletionInventory()` branch below exists only for an older store that
 * does not publish `loadInventory()`.
 */
export function summarizePrivateInventory({ inventory = null, local = {}, reported = null } = {}) {
  const titlesSection = reported?.titles ?? null;
  const feedbackSection = reported?.feedback ?? null;
  const importSection = reported?.lastImport ?? null;
  // Fail closed on an unrecognised basis: an unknown provenance is not
  // evidence, whatever `known` claims alongside it.
  const importRecognised = importSection ? Object.hasOwn(IMPORT_BASIS_NOTES, importSection.basis ?? 'none') : false;
  const importCounts = (importSection && importSection.known === true && importRecognised)
    ? importSection.counts
    : null;

  // Fallback evidence, used only when Data's store contract is absent.
  const snapshotItem = inventoryItem(inventory, 'encrypted-snapshot');
  const localItemCount = inventoryCount(local?.itemCount);
  let titles = sectionCount(titlesSection);
  if (titles === null && !titlesSection) {
    if (snapshotItem) titles = retainedCount(snapshotItem, localItemCount);
    if (titles === null && local?.hasLocalSnapshot === false) titles = 0;
    if (titles === null && local?.hasLocalSnapshot === true) titles = localItemCount;
  }

  const libraryEntries = sectionCount(titlesSection, 'libraryEntryCount');

  let feedbackRecords = sectionCount(feedbackSection);
  if (feedbackRecords === null && !feedbackSection) {
    feedbackRecords = retainedCount(inventoryItem(inventory, 'private-reviews'));
  }
  // Deletion markers are not part of Data's store contract, so they stay
  // unknown rather than being reported as zero when only that contract exists.
  const feedbackTombstones = retainedCount(inventoryItem(inventory, 'review-tombstones'));

  const legacyImport = (!importSection && local?.lastImport && typeof local.lastImport === 'object')
    ? local.lastImport
    : null;
  const importCount = (field) => (importCounts
    ? inventoryCount(importCounts[field])
    : inventoryCount(legacyImport?.[field]));

  const titlesReason = titles === null ? sectionReason(titlesSection) : null;
  const feedbackReason = feedbackRecords === null ? sectionReason(feedbackSection) : null;
  const importReason = importCounts === null ? sectionReason(importSection) : null;

  const rows = [
    ['inventory-titles', 'Titles in the local encrypted snapshot', titles, titlesReason],
    ['inventory-library-entries', 'Library entries in that snapshot', libraryEntries, titlesReason],
    ['inventory-feedback-records', 'Private feedback records (ratings, comments, tags)', feedbackRecords, feedbackReason],
    ['inventory-feedback-tombstones', 'Private feedback deletion markers', feedbackTombstones, null],
    ['inventory-import-added', 'Latest import: added', importCount('added'), importReason],
    ['inventory-import-updated', 'Latest import: updated', importCount('updated'), importReason],
    ['inventory-import-reappeared', 'Latest import: returned to the library', importCount('reappeared'), importReason],
    ['inventory-import-missing', 'Latest import: no longer offered by the source', importCount('missingFromSource'), importReason],
    ['inventory-import-unchanged', 'Latest import: unchanged', importCount('unchanged'), importReason],
    ['inventory-import-rejected', 'Latest import: rejected', importCount('rejected'), importReason],
  ];
  return rows.map(([id, label, count, reason]) => ({
    id,
    label,
    known: count !== null,
    reason: count === null ? reason : null,
    value: count === null
      ? (reason ? `${UNKNOWN_INVENTORY_VALUE} (${reason})` : UNKNOWN_INVENTORY_VALUE)
      : String(count),
  }));
}

/**
 * What the import counts describe, taken from the runtime's declared basis.
 *
 * A closed vocabulary: an unrecognised basis is stated as unrecognised rather
 * than described, because a screen that improvises a provenance is inventing
 * evidence. This replaces an earlier numerical heuristic here, which could not
 * tell twelve titles having just arrived from twelve titles having been parsed
 * out of the retained snapshot — both produce `added: 12`.
 */
export const IMPORT_BASIS_NOTES = Object.freeze({
  'sync-reconciliation': 'These counts compare what Audible returned against the snapshot stored before it. Buckets a synchronization does not measure are shown as unknown.',
  'snapshot-load': 'No synchronization has run in this session. The retained snapshot was read from local storage, which measures nothing about what Audible changed, so every import count stays unknown.',
  none: 'No snapshot has been read and no synchronization has run in this session, so there is nothing to report.',
});

/** Who measured the counts, in the runtime's own closed vocabulary. */
export const IMPORT_AUTHORITY_LABELS = Object.freeze({
  'requested-sync': 'Measured by the synchronization you requested.',
  'local-snapshot-parse': 'Produced by reading the stored snapshot on this device, not by contacting Audible.',
});

export function describeImportProvenance(section) {
  if (!section || typeof section !== 'object') return '';
  const basis = typeof section.basis === 'string' ? section.basis : 'none';
  const note = Object.hasOwn(IMPORT_BASIS_NOTES, basis)
    ? IMPORT_BASIS_NOTES[basis]
    : `The runtime reported an import basis this screen does not recognise (${String(basis).slice(0, 48)}), so the counts are treated as unknown.`;
  const parts = [note];
  const authority = typeof section.authority === 'string' ? section.authority : null;
  if (authority && Object.hasOwn(IMPORT_AUTHORITY_LABELS, authority)) parts.push(IMPORT_AUTHORITY_LABELS[authority]);
  if (typeof section.observedAt === 'string' && section.observedAt) parts.push(`Observed at ${section.observedAt}.`);
  return parts.join(' ');
}

/**
 * Everything else the installation is holding, using the deletion screen's own
 * labels and tri-state semantics. Connector-owned artifacts stay 'unknown'
 * rather than being reported as absent.
 */
export function describeRetainedArtifacts(inventory) {
  const items = inventory?.items ?? [];
  const counted = ['encrypted-snapshot', 'private-reviews', 'review-tombstones'];
  const rest = items.filter((item) => !counted.includes(item.id));
  const retained = rest.filter((item) => item.retained === true).map((item) => INVENTORY_LABELS[item.id] ?? item.id);
  const unknown = rest.filter((item) => item.retained === 'unknown').map((item) => INVENTORY_LABELS[item.id] ?? item.id);
  const lines = [];
  if (retained.length > 0) lines.push(`Also retained on this device: ${retained.join(', ')}.`);
  if (unknown.length > 0) lines.push(`Held by the connector and not observable from this screen: ${unknown.join(', ')}. Their state is not known here and is not reported as removed.`);
  return lines.join(' ');
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
  if (!report) return h('p', { class: componentClass('note'), text: 'No import has run yet in this session.' });
  const rows = [['Added', report.added.length], ['Updated', report.updated.length], ['Unchanged', report.unchanged.length], ['Missing from source', report.missingFromSource.length], ['Rejected', report.rejected.length]];
  const dl = h('dl', { class: componentClass('metaList') });
  for (const [label, count] of rows) dl.append(h('dt', { text: label }), h('dd', { text: String(count) }));
  const body = [dl];
  if (report.rejected.length > 0) {
    body.push(h('p', { id: 'rejected-records-heading', class: componentClass('formStatus'), role: 'alert', text: `${report.rejected.length} record(s) were safely rejected and never applied. This is the induced-error demonstration recovering correctly, not a live failure. Only the record position and a fixed problem category are shown — rejected source content is never displayed or exported.` }));
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
  const refreshStatus = h('p', { class: componentClass('formStatus'), role: 'status', id: 'refresh-status' });
  const reportRegion = h('div', { id: 'import-report' });
  reportRegion.appendChild(buildReportList(store.lastImportReport));
  const refreshBtn = uiButton({ variant: 'primary', text: 'Manual refresh (re-import clean synthetic snapshot)', onclick: () => { const result = store.manualRefresh(); refreshStatus.textContent = result.ok ? `Manual refresh completed: ${result.report.added.length} added, ${result.report.updated.length} updated, ${result.report.unchanged.length} unchanged.` : result.reason; refreshStatus.setAttribute('role', result.ok ? 'status' : 'alert'); announce(refreshStatus.textContent, { assertive: !result.ok }); clear(reportRegion); reportRegion.appendChild(buildReportList(store.lastImportReport)); if (onChanged) onChanged(); } });
  const induceErrorBtn = uiButton({ variant: 'secondary', text: 'Manual refresh (safe induced-error demonstration)', onclick: () => { const result = store.manualRefresh({ induceError: true }); refreshStatus.textContent = result.ok ? `Manual refresh ran with a deliberately malformed fixture record: ${result.report.rejected.length} record(s) safely rejected, ${result.report.updated.length} updated.` : result.reason; refreshStatus.setAttribute('role', result.ok ? 'status' : 'alert'); announce(refreshStatus.textContent, { assertive: !result.ok }); clear(reportRegion); reportRegion.appendChild(buildReportList(store.lastImportReport)); if (onChanged) onChanged(); } });
  const exportBtn = uiButton({ variant: 'primary', text: 'Export synthetic snapshot as JSON', onclick: () => { downloadJson('audible-track-and-recommend-alpha-export.json', store.exportState()); announce('Exported the current synthetic snapshot as a JSON file. This export never leaves your device and is never sent anywhere.'); } });
  const disconnectBtn = uiButton({ variant: 'danger', text: 'Disconnect (stop synthetic import)', onclick: async () => { const confirmed = await confirmAction({ title: 'Disconnect this synthetic session?', message: 'This stops any further manual refresh and forgets the synthetic source reference. The already-imported library evidence stays visible for inspection until you separately delete it. This cannot be undone in this tab.', confirmLabel: 'Disconnect' }); if (!confirmed) return; const result = store.disconnect(); announce(result.ok ? 'Disconnected. Manual refresh is no longer available.' : result.reason, { assertive: !result.ok }); renderDataView(root, store, { onChanged }); if (onChanged) onChanged(); } });
  const deleteBtn = uiButton({ variant: 'danger', text: 'Delete all synthetic data', onclick: async () => { const confirmed = await confirmAction({ title: 'Delete all synthetic data?', message: 'This erases every catalog title and library entry held in this browser tab\'s memory, right now. It cannot be undone: the only way to see data again is to reload the page, which reseeds the original synthetic fixtures from scratch. Any file you already exported stays on your device; deletion here does not reach it.', confirmLabel: 'Delete everything' }); if (!confirmed) return; const result = store.deleteAll(); announce(result.ok ? 'Deleted all synthetic data from this session.' : result.reason, { assertive: !result.ok }); renderDataView(root, store, { onChanged }); if (onChanged) onChanged(); } });
  function updateLifecycleButtons() { const gated = !store.consentAcknowledged || summary.connectionStatus === 'deleted'; disconnectBtn.disabled = gated || summary.connectionStatus === 'disconnected'; deleteBtn.disabled = gated; refreshBtn.disabled = !store.canRefresh(); induceErrorBtn.disabled = !store.canRefresh(); }
  const consentCheckbox = h('input', { type: 'checkbox', id: 'consent-ack', checked: store.consentAcknowledged || undefined, onchange: (event) => { store.setConsentAcknowledged(event.target.checked); updateLifecycleButtons(); } });
  updateLifecycleButtons();
  mount(root, h('section', { 'aria-labelledby': 'data-heading' }, [
    h('h2', { id: 'data-heading', text: 'Data & lifecycle' }),
    h('div', { class: componentClass('panel') }, [h('p', { class: componentClass('statement'), text: 'This is a synthetic, import-only, offline demo. Nothing here refreshes automatically.' }), h('ul', {}, [h('li', { text: 'All books, people, and history shown anywhere in this demo are bundled synthetic fixtures.' }), h('li', { text: 'There is no connection to any Audible or Amazon account, and no credential of any kind is stored or requested.' }), h('li', { text: 'The UI loads from a loopback-only server on this computer. It sends no outbound requests; state lives only in this browser tab\'s memory and is lost on reload.' }), h('li', { text: 'The demo library only changes when you click "Manual refresh" below — it is never refreshed on a timer or in the background.' })]), ]),
    h('p', { class: componentClass('statement'), role: 'status', id: 'connection-status', text: `Session status: ${CONNECTION_LABELS[summary.connectionStatus]}.` }),
    h('p', { class: componentClass('note'), id: 'data-summary', text: `Currently in memory: ${summary.bookCount} catalog titles, ${summary.libraryEntryCount} library entries.` }),
    h('section', { 'aria-labelledby': 'refresh-heading' }, [h('h3', { id: 'refresh-heading', text: 'Manual, import-only refresh' }), h('div', { class: componentClass('formActions') }, [refreshBtn, induceErrorBtn]), refreshStatus, reportRegion]),
    h('section', { 'aria-labelledby': 'lifecycle-heading' }, [h('h3', { id: 'lifecycle-heading', text: 'Lifecycle controls' }), h('div', { class: componentClass('checkboxRow') }, [consentCheckbox, h('label', { for: 'consent-ack' }, ['I understand this is a synthetic, disposable, in-memory session, and that disconnect/delete are irreversible for this tab.'])]), h('div', { class: componentClass('formActions') }, [exportBtn, disconnectBtn, deleteBtn])]),
    h('h3', { text: `Runtime profile (alpha ${ALPHA_VERSION})` }),
    buildProfileList(),
  ]));
}
