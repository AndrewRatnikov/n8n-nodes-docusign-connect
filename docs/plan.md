# n8n-nodes-docusign-connect — Implementation Plan

Status: Phase 0 mostly done (repo creation + npm publisher setup pending); Phase 1 complete
Last updated: 2026-08-22

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

## Phase 3 — Build the node

- [ ] Scaffold with the `n8n-node` CLI (same tool used for Maps)
- [ ] **Credential type: JWT auth.** This is the differentiator — get it right:
  - Fields: Integration Key, User ID (impersonated user's GUID), Private Key, environment toggle (demo vs. production base URLs)
  - RS256-sign the JWT assertion with Node's built-in `crypto` module — do **not** add `jsonwebtoken` or the `docusign-esign` SDK as a dependency (see verification note below)
  - Cache/refresh the access token (DocuSign JWT tokens last ~1 hour); re-mint on expiry
  - Credential test action: exchange for a token and hit `/oauth/userinfo`
- [ ] Call the eSignature REST API directly via `this.helpers.httpRequest` — do not pull in the `docusign-esign` SDK. It's heavy, and every one of its own dependencies has to survive the bundler cleanly to pass verification's "no runtime dependencies" check.
- [ ] Implement the 3 operations from Phase 2 against the sandbox
- [ ] Binary output handling for the downloaded PDF (follow n8n's standard binary data conventions, same as any file-returning node)

### Verification constraint to design around

Checked n8n's current verification guidelines (2026-08-21): verified community nodes must ship with **zero runtime dependencies** — `n8n-node build` bundles everything into `dist`, and the published `package.json` should have no `dependencies` key (only `devDependencies`/`peerDependencies`). Confirmed by inspecting the Maps project's `package.json`, which already follows this. Keeping DocuSign calls to hand-rolled `crypto` + `httpRequest` avoids fighting the bundler later.

## Phase 4 — Validate before publishing

- [ ] Test all 3 operations end-to-end against the sandbox (send-from-template → check status → download)
- [ ] Test failure paths: expired/invalid consent, declined envelope, wrong account base URI
- [ ] Optional: subscribe to DocuSign Personal plan for one month, send one real envelope to self, screenshot for the announcement post, then cancel

## Phase 5 — Ship

- [ ] Publish to npm with the `n8n-nodes-` prefix, MIT license
- [ ] **Reuse, don't rebuild:** copy the Maps project's `.github/workflows/publish.yml` + `ci.yml`. As of May 1 2026, n8n requires verified-node submissions to publish via GitHub Actions with npm provenance — the Maps repo already has a working implementation of this (OIDC-based npm provenance, `id-token: write` scoped down). This wasn't in the original plan and is now mandatory, not optional.
- [ ] README with clear setup instructions — this is the #1 differentiator given how much friction JWT setup has (Integration Key creation, RSA key generation, the one-time consent URL visit). Screenshot each DocuSign dashboard step.
- [ ] Submit for n8n community node verification (`npx @n8n/scan-community-package` must pass first)
- [ ] Post replies to the DocuSign threads already found (2021 request, November 2025 "we need this" post) — and acknowledge the existing early-stage community nodes rather than ignoring them
- [ ] Update portfolio + one announcement post
