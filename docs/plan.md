# n8n-nodes-docusign-connect — Implementation Plan

Status: Phase 0 mostly done (repo creation + npm publisher setup pending); Phases 1–3 complete; Phase 4 failure-path testing is the open work
Last updated: 2026-09-05

Mirrors the [google-maps-platform-node](../../google-maps-platform-node) playbook: scaffold with `n8n-node` CLI, ship a tight MVP, publish under MIT, submit for community verification.

## Competitive landscape (checked 2026-08-21)

No official DocuSign node exists in n8n core. Several community attempts already exist but are early/unpolished:

- `n8n-nodes-docusign` (hansdoebel) — broad resource coverage, explicitly "use with caution in production," ~14 weekly downloads, 0 stars
- `n8n-docusign-node`
- `n8n-nodes-docusign-esign` (janmaaarc)
- `tumf/n8n-nodes-docusign`

Differentiation is JWT auth done correctly + tight scope + real documentation, not being first. The README and announcement post should acknowledge these exist rather than pitch this as greenfield.

---

## Phase 0 — Repo, npm, git setup

- [x] `git init`
- [x] Create the GitHub repo (`AndrewRatnikov/n8n-nodes-docusign-connect`, matches the local dir name) — **needs your GitHub login, not done yet**
- [x] ~~Scaffold with `npx @n8n/node-cli new`~~ — the CLI's interactive prompt (`@clack/prompts`) doesn't accept piped/non-TTY input, so it couldn't run headless. Built the scaffold by hand instead, matching the CLI's own output conventions from the Maps project (`package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.js`, node/credential skeleton) — verified equivalent by running `npm run build` / `npm run lint` clean.
- [x] Reconciled `package.json` with the Maps conventions:
  - `name`: `n8n-nodes-docusign-connect`
  - `license: MIT`, `publishConfig.access: public`
  - `author`: name + `ratnikov.am@gmail.com`
  - `repository.url` → the new GitHub repo
  - `keywords: ["n8n-community-node-package"]`
  - `n8n.n8nNodesApiVersion: 1`, `n8n.strict: true`, `n8n.credentials`/`n8n.nodes` pointing at `dist/`
  - No `dependencies` key — only `devDependencies`/`peerDependencies` (see Phase 3 verification note)
- [x] Copied `.gitignore` from Maps (`node_modules/`, `dist/`, `.env*`, `.DS_Store`, `.idea/`, n8n-node-cli local dev state; `.vscode/launch.json` tracked)
- [x] Copied `LICENSE` (MIT) from Maps, updated copyright name/year
- [x] Copied `.github/workflows/publish.yml` and `ci.yml` from Maps, updated package name references. **Found and fixed a real bug while copying:** the Maps repo's own `ci.yml` and `publish.yml` have their GitHub Actions expressions truncated on disk — `group: ci-$` instead of `group: ci-${{ github.ref }}`, and `NPM_TOKEN: $` instead of `NPM_TOKEN: ${{ secrets.NPM_TOKEN }}`. This repo's copies have the expressions written out in full and verified with `grep`. **The Maps repo should get the same fix** — its concurrency cancellation and npm token secret are currently no-ops.
- [ ] Set up npm Trusted Publisher for the new package (npmjs.org → package → Publish access → Trusted Publishers → point at `publish.yml`) — **needs your npmjs.com login, not done yet**
- [x] `npm install`; `npm run build` and `npm run lint` run clean (1 cosmetic icon-theming warning, no errors). `npm test` currently exits non-zero with "no test files found" — expected on an empty scaffold; real tests land in Phase 3 alongside real logic, same as Maps did.
- [x] Placeholder node (`DocuSign`) and credential (`DocuSignApi`) added so the build has something to compile — minimal shells only, to be replaced with the real JWT auth and 3 operations in Phase 3. Icon is a plain placeholder "DS" square, not real DocuSign branding — needs proper assets before Phase 5.
- [x] First commits made locally (small, one concern per commit: docs, config, gitignore/license/vscode, node/credential scaffold, CI workflows)
- [x] Push to GitHub; confirm `ci.yml` runs green — **blocked on the GitHub repo above**

## Phase 1 — Setup (~1-2 days, free) — ✅ complete

- [x] Create a free DocuSign Developer/Demo sandbox account (`account-d.docusign.com`)
- [x] Create an Integration Key (client ID) on the Apps and Keys page — app named "n8n", `795580cf-1e68-442f-b523-a95000a76d83`, Private custom integration, redirect URI `https://www.docusign.com`
- [x] Generate the RSA key pair — done locally via `openssl` (2048-bit, PKCS8 private key) instead of DocuSign's own "Generate RSA" button, so the private key is never displayed by/transmitted to a third-party UI. Private key at `secrets/docusign-private.pem`, public key at `secrets/docusign-public.pem` — both gitignored (`secrets/`).
- [x] Enable JWT Grant (impersonation) on the Integration Key — public key uploaded via Service Integration → Upload RSA
- [x] **One-time manual consent step:** consent URL opened in browser, Allow clicked for the sandbox user
- [x] Write a standalone Node test script (outside n8n) — `scripts/docusign-jwt-test.mjs` (run via `npm run docusign:jwt-test`, reads `.env`). RS256-signs a JWT assertion using Node's built-in `crypto` module (no `jsonwebtoken` dependency — see Phase 3 notes), exchanges it at `https://account-d.docusign.com/oauth/token`, and calls `GET /oauth/userinfo` to confirm the token works.
- [x] Confirm one successful token exchange — ran 2026-08-22, `token_type: Bearer, expires_in: 3600`, `userinfo` returned `account_id=0a44104e-04e1-408d-a445-118923a12548`, `base_uri=https://demo.docusign.net`. **Save this `base_uri` — Phase 3 needs it for every eSignature API call (it's account-specific, not a fixed host).**

## Phase 2 — Scope the MVP

Three operations covering the 80% case. Everything else waits for real user demand (same rule as Maps).

1. **Create Envelope** — send a document for signature
   - v1 primary path: **send from an existing DocuSign template** (`POST /envelopes` with `templateId` + recipient roles) — most real users already have templates built in the DocuSign web UI, and this avoids hand-computing `signHere` tab X/Y coordinates or anchor-text placement, which is real complexity for comparatively little value
   - Stretch/v1.1 candidate: raw document upload with anchor-text tabs (`anchorString`, not pixel coordinates — anchor tabs are far less brittle than absolute positioning)
2. **Get Envelope Status** — `GET /envelopes/{envelopeId}` → signed / sent / delivered / declined / voided
3. **Download Signed Document** — `GET /envelopes/{envelopeId}/documents/{documentId}` (or `/combined` for the full signed set) as binary output

**Explicitly out of scope for v1:** templates management (create/edit templates), bulk send, embedded signing, DocuSign Connect / webhook events. Common asks, real complexity — let users request them.

## Phase 3 — Build the node — ✅ complete

- [x] ~~Scaffold with the `n8n-node` CLI~~ — reused the Phase 0 hand-built scaffold (still no working non-interactive path for the CLI's own generator)
- [x] **Credential type: JWT auth.** [DocuSignApi.credentials.ts](../credentials/DocuSignApi.credentials.ts):
  - Fields: Environment, Integration Key, User ID, Private Key (PEM, password-masked)
  - RS256-signs the assertion with Node's built-in `crypto` — no `jsonwebtoken`/`docusign-esign` dependency
  - `preAuthentication` exchanges the JWT for a token and calls `/oauth/userinfo`; result is cached via a hidden `accessToken` field
  - Credential test hits `/oauth/userinfo` against a fixed auth-host URL
- [x] Call the eSignature REST API directly via declarative routing (`this.helpers.httpRequest` under the hood) — no `docusign-esign` SDK
- [x] Implement the 3 operations from Phase 2 against the sandbox — [resources/envelope/](../nodes/DocuSign/resources/envelope)
- [x] Binary output handling for the downloaded PDF — `encoding: 'arraybuffer'` + `postReceive: [{ type: 'binaryData', ... }]`

### Two real bugs found while live-testing against the sandbox (not guesses — traced through n8n's own source)

1. **`preAuthentication` was silently never called.** n8n only invokes a credential's `preAuthentication` when the credential declares a hidden property with `type: 'hidden'` and `typeOptions: { expirable: true }` — that field acts as the trigger n8n checks before deciding whether to refresh. Without it (my first version), the method is just dead code — no error, it just never runs. Fixed by adding the `accessToken` hidden/expirable field to `DocuSignApi.credentials.ts`.
2. **`$credentials.baseUri`/`$credentials.accountId` can't be used in `request.url`/`request.baseURL` expressions.** n8n resolves a request's URL template *before* running `preAuthentication`/`authenticate` — those two only get a chance to add headers, not rewrite the URL, by the time they run (confirmed by reading `n8n-core`'s `httpRequestWithAuthentication` directly). Since DocuSign's API host is account-specific and only discoverable via an authenticated call, this meant `requestDefaults.baseURL` could never resolve correctly. Fixed with a `resolveAccountBaseUrl` preSend ([GenericFunctions.ts](../nodes/DocuSign/GenericFunctions.ts)) on each operation, which calls `httpRequestWithAuthentication` itself to discover the account's `base_uri`/`accountId` and sets `requestOptions.baseURL` directly — reusing the credential's own JWT-signing logic rather than duplicating it.

### Live-instance verification — ✅ complete (2026-08-23)

A third bug surfaced along the way, unrelated to the two above: the first `--custom-user-folder` path Andrew was given (`./.dev-n8n`, nested inside the project) created a **recursive symlink loop** — the custom-node symlink pointed back at the project root, which now contained the very folder holding the symlink, so any tool walking the tree (`ENAMETOOLONG`) never terminated. Nothing DocuSign-specific; fixed by using a folder outside the repo (`~/.n8n-docusign-dev`) instead. The earlier "generic 400 on credential test" thread turned out to be a dead end down the same rabbit hole, not a real bug — never reproduced once testing moved to a real n8n instance.

Andrew then ran all 3 operations by hand against the real sandbox, end to end:

- **Create From Template** — `POST /envelopes` against the throwaway test template → `envelopeId 52672969-dc26-8673-81f7-fe2525841718`, `status: "sent"`
- **Get Status** — same envelope ID → full envelope object back, `status: "sent"`
- **Download Document** — same envelope ID, `documentId: combined` → binary output, `application/pdf`, 127 kB

All 3 confirmed working. Phase 3 is done.

**Incident note:** while debugging, a `pkill -f "n8n-node dev"` broad-pattern kill accidentally stopped the unrelated `google-maps-platform-node` dev server that had been running since the previous session. Flagged to Andrew, offered to restart it — not yet confirmed done, worth checking.

### Verification constraint to design around

Checked n8n's current verification guidelines (2026-08-21): verified community nodes must ship with **zero runtime dependencies** — `n8n-node build` bundles everything into `dist`, and the published `package.json` should have no `dependencies` key (only `devDependencies`/`peerDependencies`). Confirmed by inspecting the Maps project's `package.json`, which already follows this. Keeping DocuSign calls to hand-rolled `crypto` + `httpRequest` avoids fighting the bundler later.

## Phase 4 — Validate before publishing

- [x] Happy path for all 3 operations (done in Phase 3 — see above)

For each failure test below: run it, and check two things — (1) does the node fail cleanly with a readable message (not a raw stack trace or a silent hang), and (2) is the message something a non-technical n8n user could act on. Reword/fix in code where it isn't.

### A — Auth failures
- [x] ~~**Known gap:** no `consent_required` handling~~ — fixed 2026-09-05: `preAuthentication` now catches it and throws a message containing the ready-to-open consent URL (rethrowing any other error untouched). **Still needs the live test below to confirm the detection actually matches n8n's error shape.**
- [ ] **Revoked consent.** In DocuSign, go to your account's connected-apps settings and revoke access for the "n8n" app (undoes the one-time consent click from Phase 1). Re-run any operation. Expected: DocuSign returns `consent_required` on the token exchange. **Known gap:** `preAuthentication` currently has no special handling for this — it'll likely surface as a generic HTTP error, not the friendly "click this URL to re-consent" message the standalone script gives. Worth fixing in `DocuSignApi.credentials.ts` if the raw error is unreadable. Redo the consent click afterward to restore access.
- [ ] **Wrong Integration Key or User ID.** Temporarily edit the credential with an invalid value, run an operation. Expected: clear auth-failure message, not a crash.
- [ ] **Environment mismatch.** Set Environment to "Production" while using the demo sandbox's Integration Key. Expected: clean failure (DocuSign will reject the key on the production auth host), not a hang or confusing binding-to-wrong-account behavior.

### B — Create Envelope input errors
- [ ] **Wrong Template ID** (use a random GUID). Expected: DocuSign 404, surfaced with enough detail to know the template wasn't found.
- [ ] **Role Name that doesn't match the template** (e.g. `Signer2` against a template that only defines `Signer1`). Expected: clear DocuSign validation error, not a silent no-op.
- [ ] **Empty Recipients.** Leave Recipients blank and execute. Expected: clean validation error rather than a confusing 500.

### C — Get Status / Download Document edge cases
- [ ] **Non-existent Envelope ID** on both operations. Expected: 404 surfaced clearly, not swallowed.
- [ ] **Download before completion** — already incidentally covered in Phase 3 (downloaded the `sent`-status envelope's combined PDF successfully), but worth confirming that's expected DocuSign behavior, not a fluke.
- [ ] **Invalid Document ID** (e.g. `999` on an envelope with only one document). Expected: clean 404.

### D — Envelope lifecycle states
- [ ] **Void an envelope** (via DocuSign's web UI, using the test envelope from Phase 3 or a new one) and confirm **Get Status** correctly reports `voided`.
- [ ] **Decline an envelope** — open the signing link as the test recipient and click Decline — confirm **Get Status** reports `declined`.

### E — Error message quality pass
- [ ] After running A–D, review every error message that came back. n8n's default declarative-routing error handling may just dump DocuSign's raw JSON body — decide whether that's good enough or whether a `postReceive` error handler is worth adding to extract DocuSign's `errorCode`/`message` fields into something cleaner. This is the kind of polish the differentiation pitch (README) is resting on.

### F — Optional real-world validation
- [ ] Subscribe to DocuSign Personal plan for one month, send one real envelope to self, screenshot for the announcement post, then cancel

## Phase 5 — Ship

- [ ] Publish to npm with the `n8n-nodes-` prefix, MIT license
- [ ] **Reuse, don't rebuild:** copy the Maps project's `.github/workflows/publish.yml` + `ci.yml`. As of May 1 2026, n8n requires verified-node submissions to publish via GitHub Actions with npm provenance — the Maps repo already has a working implementation of this (OIDC-based npm provenance, `id-token: write` scoped down). This wasn't in the original plan and is now mandatory, not optional.
- [x] README with clear setup instructions — this is the #1 differentiator given how much friction JWT setup has (Integration Key creation, RSA key generation, the one-time consent URL visit). Written 2026-09-05: [README.md](../README.md) walks through all four setup steps including the consent URL. **Still missing screenshots of each DocuSign dashboard step** — those need a live browser session and are the remaining gap before submission.
- [ ] Submit for n8n community node verification (`npx @n8n/scan-community-package` must pass first)
- [ ] Post replies to the DocuSign threads already found (2021 request, November 2025 "we need this" post) — and acknowledge the existing early-stage community nodes rather than ignoring them
- [ ] Update portfolio + one announcement post
