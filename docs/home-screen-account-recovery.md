# Home Screen account recovery audit

Date: 2026-10-11

## Scope and limits

- Complaint: an iPhone Home Screen installation asks for setup while an existing Chrome tab still contains records under the same Google email.
- The initial Codex browser connection failed, then a new tab recovered the existing admin session. The target account was found active with Google login. Individual customer financial records have not been opened; cloud counts/backups are checked separately through the protected read-only inspector.
- No customer records were edited. Tests use a QA authentication account with mocked financial/profile/monitoring endpoints.
- Fresh mobile browser contexts emulate isolated local storage, not an actual iPhone installation or Google popup login on iOS.

## Confirmed defects

1. Approval polling used to turn a failed cloud GET into `null`, then set `cloudReady` anyway. This exposes onboarding for an existing account.
2. Bootstrap used to accept an absent embedded cloud payload as an empty account, without an authoritative data GET.
3. Local recovery swallowed upload errors and trusted an old onboarding flag even when the cache contained financial records.
4. Concurrent auth callbacks had no generation check; queued saves requested whichever account token was current when the request ran.

Before-fix browser reproduction: pending profile -> approved profile -> cloud GET 503. Onboarding became visible (`setup: true`). No setup was completed, so this test does not prove an actual customer overwrite or loss.

## Protection shipped

- Validate profile ownership and cloud payload structure/version before restoring or creating an account.
- Perform an authoritative GET for absent, malformed, or null embedded cloud data.
- Never open setup or autosave after an unsuccessful data read; show a retry action instead.
- Recover a valid cache only for its matching UID and only after the server confirms an empty account. Infer completed setup from meaningful records, not only the legacy flag.
- Reject corrupt owned caches without replacing them with defaults.
- Ignore outdated auth callbacks and bind financial reads/saves to their expected UID, including before/after asynchronous token retrieval.
- Do not autosave fresh onboarding defaults. Explicit, confirmed settings resets retain their existing persistence path.
- Leave login methods, server financial data, backups, public landing, and stored auth sessions intact.
- Add an admin-only, read-only inspection action to the existing users route: it returns record counts, cloud version/setup flag/timestamps, and up to three backup summaries. It never returns transaction contents, names, amounts, or wallet balances, and does not write to customer documents.

## QA

- `npm run qa:release`: 19 test groups, production build, secret scan, backend syntax, and prelaunch checks.
- `npm run test:e2e:account-bootstrap`: fresh storage with 68 records, slow reads, missing embedded cloud, startup failure/retry, approval failure/retry, malformed cloud on mobile/desktop, legacy owned cache, corrupt cache, another account's cache, a genuinely new account, explicit confirmed reset, and read-only admin inspection/failure/retry on mobile/desktop (14 scenarios).
- Read-only inspector tests cover malformed/missing accounts, failed backup reads, admin guard ordering, and exclusion of sensitive transaction/wallet fields. The slow-read browser assertion compares against writes already completed before a reload, while still forbidding any additional writes during the pending read.
- Related regression scripts cover notifications, receivable wallet changes/save retry, reconciliation, and the public landing.
- Browser fixtures verify preserved record counts/balances, no writes on failed reads, no onboarding flash during slow reads, no migration across UIDs, retry recovery, and no page errors.
- Mobile/desktop error screenshots are under ignored `.e2e-artifacts/account-bootstrap-*.png`.

## Customer recovery precautions

1. Do not reset, complete replacement setup, clear Chrome storage, or discard the JSON backup while diagnosis is unfinished.
2. Reopen the existing Chrome tab and preserve a fresh backup before troubleshooting the Home Screen installation.
3. After updating, retry loading the Home Screen app with the same Google account.
4. If setup still appears, verify both Firebase UIDs and the server record count/version with authorized admin access. A successful login or an idle local sync indicator alone is not proof that all records reached the server.
5. If records exist only in Chrome/backup, reconcile that copy with the server before importing; do not blindly overwrite an existing cloud account.

## Platform references

- WebKit storage isolation: https://webkit.org/tracking-prevention/
- Safari 17.2 Home Screen installation copies cookies, but no other local storage: https://webkit.org/blog/14787/webkit-features-in-safari-17-2/

Separate local storage explains why the new installation has no local copy. It does not prove the customer's cloud data is missing, nor excuse reopening setup when a cloud read fails.
