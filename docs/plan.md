# n8n-nodes-docusign-connect — Implementation Plan

Status: not started
Last updated: 2026-08-21

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

- [ ] `git init`; create the GitHub repo (`AndrewRatnikov/n8n-nodes-docusign-connect`, matches the local dir name)
- [ ] Scaffold with `npx @n8n/node-cli new` (same CLI/version family as Maps — currently `@n8n/node-cli@0.45.x`) — generates `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.js`, node/credential skeletons
- [ ] Reconcile scaffolded `package.json` with the Maps conventions:
  - `name`: `n8n-nodes-docusign-connect`
  - `license: MIT`, `publishConfig.access: public`
  - `author`: name + `ratnikov.am@gmail.com`
  - `repository.url` → the new GitHub repo
  - `keywords: ["n8n-community-node-package"]`
  - `n8n.n8nNodesApiVersion: 1`, `n8n.strict: true`, `n8n.credentials`/`n8n.nodes` pointing at `dist/`
  - No `dependencies` key — only `devDependencies`/`peerDependencies` (see Phase 3 verification note)
- [ ] Copy `.gitignore` from Maps (`node_modules/`, `dist/`, `.env*`, `.DS_Store`, `.idea/`, n8n-node-cli local dev state; keep `.vscode/launch.json` tracked)
- [ ] Copy `LICENSE` (MIT) from Maps, update copyright name/year
- [ ] Copy `.github/workflows/publish.yml` and `ci.yml` from Maps as-is, update the package name references — this is the GitHub Actions + npm provenance workflow verification will require (see Phase 5)
- [ ] Set up npm Trusted Publisher for the new package (npmjs.org → package → Publish access → Trusted Publishers → point at `publish.yml`), same as was done for Maps
- [ ] `npm install`; confirm `npm run build`, `npm run lint`, `npm test` all run clean on the empty scaffold before writing any DocuSign-specific code
- [ ] First commit + push; confirm `ci.yml` runs green on GitHub Actions

## Phase 1 — Setup (~1-2 days, free)

- [ ] Create a free DocuSign Developer/Demo sandbox account (`account-d.docusign.com`)
- [ ] Create an Integration Key (client ID) on the Apps and Keys page
- [ ] Generate the RSA key pair under Service Integration; store private key securely (not in git)
- [ ] Enable JWT Grant (impersonation) on the Integration Key
- [ ] **One-time manual consent step (not automatable):** open the consent URL in a real browser and click Allow for the sandbox user. Required once per Integration Key + user before any JWT token exchange will succeed. Document this explicitly — it's the #1 place users will get stuck.
  ```
  https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<INTEGRATION_KEY>&redirect_uri=<REDIRECT_URI>
  ```
- [ ] Write a standalone Node test script (outside n8n) that:
  - RS256-signs a JWT assertion using Node's built-in `crypto` module (no `jsonwebtoken` dependency — see Phase 3 notes)
  - Exchanges it at `https://account-d.docusign.com/oauth/token` for an access token
  - Calls `GET /oauth/userinfo` to confirm the token works and to discover the account's base URI (needed for all later API calls)
- [ ] Confirm one successful token exchange before touching any node code

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
