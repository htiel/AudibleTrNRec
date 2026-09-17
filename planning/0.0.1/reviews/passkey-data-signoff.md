# Data sign-off — passkey and account-provenance amendment

- **Date:** 2026-09-16
- **Verdict:** APPROVED
- **Scope:** Data identity, provenance, lifecycle, and determinism

The amendment closes both data blockers:

1. At most one account container may exist. The lifecycle is totally ordered:
   close, destroy the key, delete managed artifacts, issue a non-personal
   receipt, obtain new consent, create a new container, then capture.
2. Participant-attested alias and marketplace are manifest-only,
   non-key-forming provenance bound to the internal participant key. They do
   not prove an account or replace source-evidenced marketplace identity.

Attested/source-evidenced marketplace mismatch quarantines the capture and
prevents promotion. Missing source marketplace remains unknown. Attested
provenance is digest-included and compared using canonical NFC and exact ordinal
Unicode-code-point equality.

An initial traceability blocker was corrected additively: deletion disclosures
now preserve provider-held copies while also naming vault-service and user-held
copies. No baseline count, estimate, dependency, gate, or status changed.
