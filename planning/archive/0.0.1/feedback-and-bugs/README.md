# Alpha 0.0.1 — review index

**Release lead:** William Riker
**Reconciled:** 2026-09-17
**Implementation examined:** `6145f9833281f8e9fb81a190377285b73892feff`

## Read first

1. [Release verdict](alpha-0.0.1-release-verdict.md) — distribution decisions,
   G0–G6 status, blockers, limitations, and remediation sequence.
2. [Canonical bug register](bug-register.md) — stable `ATR-A001`–`ATR-A051`
   identifiers, source attribution, evidence, dispositions, owners, acceptance
   tests, and dependency-aware WSJF order.

## Preserved specialist reports

| Report | Scope | Specialist conclusion, before reconciliation |
| --- | --- | --- |
| [Data](data-review.md) | Architecture, normalization, synchronization, correctness, performance | FAIL data gate; one Blocker and three Critical correctness findings |
| [Geordi](geordi-ui-accessibility-review.md) | Inspector UI, LCARS, accessibility | Conditional pass; reported focus-contrast blocker and two assistive-technology defects |
| [Worf](worf-security-review.md) | Security, privacy, custody, dependencies, lifecycle | Changes required; owner use conditional on explicit risk acceptance; tester distribution fails |
| [Wesley](wesley-product-gap-review.md) | Product behavior, evidence honesty, scope gaps | Conditional private-alpha pass, with pre-distribution fixes |

These reports are evidence inputs, not four independent release approvals.
They remain unchanged. The register resolves overlaps and disagreements; the
verdict supplies the consolidated release decision.

## Authority and methodology

- Read [APP_DESCRIPTION.md](../../../../APP_DESCRIPTION.md), the complete
  [charter](../01-release-charter.md),
  [gates/risk register](../05-risks-and-release-gates.md),
  [backlog](../06-backlog-index.md), and
  [persistent-connector change control](../10-private-alpha-connector-change-control.md),
  plus all four reports.
- The dated change control overrides the original ban on this particular
  persistent unofficial connector and scheduled library refresh. It does **not**
  waive four-domain G3 proof, remaining G2 evidence, legal review before
  conveyance, or the public/commercial shipping block.
- Checked HEAD and the working-tree diff. HEAD matches the reviewed commit;
  there were no tracked implementation changes. Inspected implementation only
  to resolve report conflicts, stale line references, scope/behavior ambiguity,
  and the resulting acceptance criteria. This is reconciliation, not a fresh
  exhaustive code audit or a new specialist sign-off.
- Deduplicated by underlying failure mode, not by wording. A defect can have
  several sources and gates. Distinct remedies retain distinct IDs; composite
  source findings are split where necessary. IDs never change with priority.
- Kept **severity**, **release blocking**, and **delivery priority** separate.
  Worf's Highs and Data's Blocker/Critical findings remain blocking. A
  conditional specialist pass cannot override another officer's open blocker.
- Confirmed source behavior is distinguished from a hypothetical failure,
  an unverified external semantic assertion, a missing gate artifact, and an
  accepted alpha limitation. No performance estimate or unobserved UI behavior
  is represented as a measured result.
- Corrected several stale citations to current file lines. All implementation
  paths in the register are relative to `code/Alpha0.x/`; planning references
  are explicitly repository-relative. Report IDs remain the original IDs.
- Findings inherited without a substantive conflict retain their specialist's
  evidence attribution. No live exploit, account request, or visual/AT test
  was repeated. In particular, Geordi's ring-versus-button-fill calculation
  does not establish contrast against the actual **offset ring surroundings**;
  rendered focus verification remains open, not passed.

## Verified test evidence carried forward

| Evidence supplied for this reconciliation | Result | Interpretation |
| --- | --- | --- |
| Node suite | **156 total / 155 pass / 0 fail / 1 Windows symlink skip** | Regression baseline; the skipped containment case is not a pass |
| Python connector suite | **9 pass** | Connector baseline; Worf reports a real Windows DPAPI round trip among these tests |
| Private-alpha policy check | **PASS** | Configuration respects the bounded private-alpha policy |
| `npm pack` / reported dry-run packaging attempt | **BLOCKED** | Expected successful enforcement of the shipping prohibition, not a build regression |

These are supplied verified results, corroborated by the reports/change-control
record, **not newly executed results**. They do not close missing tests, prove
provider progress units, prove production idempotency, or authorize packaging.
No pack, installation, server request, or test suite was run during reconciliation.

## Safety and document control

No personal runtime data was read. No sync, connect, disconnect, deregistration,
delete, or server-stop operation was invoked. No implementation, original
report, planning baseline, or other existing file was modified.

The reconciliation creates exactly this index, the bug register, and the
release verdict. It neither publishes a release nor changes the approved
connector policy. Proposed remediations require their own approved plan and
relevant officer review before implementation; changed access, retry,
retention, export, or data-promotion semantics require explicit reconciliation
with the controlling change control.

Closure requires a linked patch, the register's acceptance evidence, relevant
officer re-review, and the gate decision. Missing evidence is not a waiver.
Any Captain override must name the IDs, scope, rationale, residual risks, and
approval; it cannot be inferred from the earlier authorization to implement.
