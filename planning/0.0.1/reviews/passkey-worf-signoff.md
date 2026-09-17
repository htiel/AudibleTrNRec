# Worf sign-off — passkey and account-provenance amendment

- **Date:** 2026-09-16
- **Verdict:** APPROVED
- **Scope:** Authentication, authorization, credentials, and account isolation

The following conditions are closed:

1. Audible/Amazon remains the WebAuthn relying party.
2. The OS/browser remains the WebAuthn client.
3. A participant-selected credential manager may act as authenticator.
4. ATR is none of those parties and renders no credential field.
5. Provider authentication grants ATR no authorization, API, route, or token.
6. ATR has no 1Password/vault SDK, CLI, service account, agent, extension,
   clipboard, pasteboard, or vault-access path.
7. No embedded/automated browser, profile extraction, cookie extraction, or
   passkey relay is permitted.
8. A future supported delegated route remains conditional on G1 design,
   fixture-tested controls, and explicit G2 authorization.
9. Credential-absence testing covers source, direct and transitive
   dependencies, lockfile, and build configuration.
10. Synthetic app-visible failures cannot probe authenticator/vault state,
    retry, or offer an alternate credential-handling path.
11. Account provenance mismatch quarantines; account containers cannot coexist
    or merge.
12. App-managed crypto-erasure is distinguished from provider-held,
    vault-service, user-held, and SSD limitations.

No runtime access or real-data authorization is granted. I approve the
amendment at planning depth.
