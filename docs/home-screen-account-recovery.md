# Home Screen account recovery audit

Date: 2026-10-11

## Scope and limits

- Complaint: an iPhone Home Screen installation asks for setup while an existing Chrome tab still contains records under the same Google email.
- The existing admin session was recovered. The email filter found one active Google account. Individual customer financial records have not been opened; only counts/backups were inspected through the protected read-only inspector.
- No customer records were edited. Tests use a QA authentication account with mocked financial/profile/monitoring endpoints.
- Fresh mobile browser contexts emulate isolated local storage, not an actual iPhone installation or Google popup login on iOS.

## Confirmed defects

1. Approval polling used to turn a failed cloud GET into `null`, then set `cloudReady` anyway. This exposes onboarding for an existing account.
2. Bootstrap used to accept an absent embedded cloud payload as an empty account, without an authoritative data GET.
3. Local recovery swallowed upload errors and trusted an old onboarding flag even when the cache contained financial records.
4. Concurrent auth callbacks had no generation check; queued saves requested whichever account token was current when the request ran.
5. A previously saved empty setup object could replace an owned Chrome cache containing transactions. This differs from a truly new account with no saved cloud document.
6. The server accepted an onboarding/default write over an established account without an explicit reset intent, so an older client could still undo a recovery.

Before-fix browser reproduction: pending profile -> approved profile -> cloud GET 503. Onboarding became visible (`setup: true`). No setup was completed, so this test does not prove an actual customer overwrite or loss.

## Verified customer state

At 21:28 WITA on 2026-10-11, the matching account's server document had 0 transactions, 3 wallets, version 8, and onboarding false. The last data save was 20:32:17 WITA. The available backup dated 19:10:43 WITA also had 0 transactions. The customer reports 68 transactions still visible in Chrome, but those records were not available from the inspected server document or backup. These observations do not establish when the records failed to sync or whether a prior cloud version was overwritten. No real account restoration has been performed without the missing Chrome/JSON copy.

## Protection shipped

- Validate profile ownership and cloud payload structure/version before restoring or creating an account.
- Perform an authoritative GET for absent, malformed, or null embedded cloud data.
- Never open setup or autosave after an unsuccessful data read; show a retry action instead.
- Recover a valid cache only for its matching UID and only after the server confirms an empty account. Infer completed setup from meaningful records, not only the legacy flag.
- Reject corrupt owned caches without replacing them with defaults.
- Ignore outdated auth callbacks and bind financial reads/saves to their expected UID, including before/after asynchronous token retrieval.
- Do not autosave fresh onboarding defaults. Explicit, confirmed settings resets retain their existing persistence path.
- Leave login methods, server financial data, backups, public landing, and stored auth sessions intact.
- Preserve an owned local cache with transactions when the cloud document is empty. Show both counts and require a choice before uploading or accepting the cloud version; accepting empty cloud also requires an explicit warning confirmation.
- Existing empty setup documents now show a recovery screen instead of immediately restarting onboarding. Preview JSON record/wallet counts before an explicit restore. Reject invalid/empty backups, changed meaningful cloud data, and version conflicts; never force an overwrite. Successful recovery is written to the same authenticated server account used by Home Screen.
- Only a matching UID/version reset receipt on that device can resume setup after a deliberately confirmed reset. A stale receipt cannot bypass recovery.
- The server rejects onboarding writes over established records unless a confirmed reset is included. Normal edits and explicit resets retain version protection. Background backups are deferred while recovery/conflict is pending.
- Add an admin-only, read-only inspection action to the existing users route: it returns record counts, cloud version/setup flag/timestamps, and up to three backup summaries. It never returns transaction contents, names, amounts, or wallet balances, and does not write to customer documents.

## QA

- `npm run qa:release`: 19 test groups, production build, secret scan, backend syntax, and prelaunch checks.
- `npm run test:e2e:account-bootstrap`: the original 14 scenarios plus empty-cloud/local preservation, explicit local recovery, JSON recovery on mobile/desktop, changed-cloud rejection, and server CAS-conflict rejection (20 scenarios). Explicit resets are also checked after reload.
- Read-only inspector tests cover malformed/missing accounts, failed backup reads, admin guard ordering, and exclusion of sensitive transaction/wallet fields. The slow-read browser assertion compares against writes already completed before a reload, while still forbidding any additional writes during the pending read.
- Related regression scripts cover notifications, receivable wallet changes/save retry, reconciliation, and the public landing.
- Browser fixtures verify preserved record counts/balances, no writes on failed reads, no onboarding flash during slow reads, no migration across UIDs, retry recovery, and no page errors.
- Mobile/desktop error screenshots are under ignored `.e2e-artifacts/account-bootstrap-*.png`.

## Customer recovery precautions

An authorized admin JSON recovery action is available under the existing users route, without adding an API route. It checks Firebase UID/email, approved status, admin-account exclusions, an explicit confirmation, and the inspected cloud version. It refuses meaningful cloud data, preserves the previous and restored snapshots plus an admin audit record atomically, and supports replay of the same recovery mutation after a lost response. The uploaded data is not normalized or altered. Unit tests cover ownership/role restrictions, rejected input, CAS conflicts, exact backup preservation, and replay. Browser tests cover mobile/desktop preview, confirmation, failure/retry, and refreshed server counts using fixtures; the real supplied customer backup is never added to the repository.

1. Do not reset, complete replacement setup, clear Chrome storage, or discard the JSON backup while diagnosis is unfinished.
2. Reopen the existing Chrome tab and preserve a fresh backup before troubleshooting the Home Screen installation.
3. After updating, retry loading the Home Screen app with the same Google account.
4. If setup still appears, verify both Firebase UIDs and the server record count/version with authorized admin access. A successful login or an idle local sync indicator alone is not proof that all records reached the server.
5. If records exist only in Chrome/backup, reconcile that copy with the server before importing; do not blindly overwrite an existing cloud account.
6. The admin email lookup cannot recreate transaction contents absent from both the server and available backup. Preserve/export the customer Chrome copy first, then use the confirmed recovery flow; do not report the real 68 records as restored based only on fixture tests.

## Platform references

- WebKit storage isolation: https://webkit.org/tracking-prevention/
- Safari 17.2 Home Screen installation copies cookies, but no other local storage: https://webkit.org/blog/14787/webkit-features-in-safari-17-2/

Separate local storage explains why the new installation has no local copy. It does not prove the customer's cloud data is missing, nor excuse reopening setup when a cloud read fails.
