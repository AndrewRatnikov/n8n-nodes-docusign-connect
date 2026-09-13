# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Hand-built scaffold following the [google-maps-platform-node](../google-maps-platform-node) playbook (the `@n8n/node-cli` generator has no working non-interactive path). All three envelope operations are implemented and verified end to end against a DocuSign demo sandbox; `0.1.0` is **not yet published** — the GitHub repo and npm Trusted Publisher setup are still outstanding. Before making further changes, read the planning doc in full:

- [docs/plan.md](docs/plan.md) — the single source of truth: competitive landscape, scoped MVP, the JWT/consent setup sequence, both n8n-internals bugs found while building, and the Phase 4 failure-path test plan that is the current open work. It tracks progress with checkboxes — check items off as they're done.

For n8n's own conventions on node/credential file structure — separate from this project's specifics above — see `@AGENTS.md`.

## What this project is

An n8n community node wrapping the DocuSign eSignature REST API. Package name (fixed by n8n's naming convention, must start with `n8n-nodes-`): `n8n-nodes-docusign-connect`.

Scope is deliberately one resource and three operations — create an envelope from an existing template, check its status, download the signed document. Raw document upload with anchor tabs, templates management, bulk send, embedded signing, and DocuSign Connect webhooks are all explicitly out of scope for v1. Community DocuSign nodes already exist; the differentiation is JWT auth done correctly plus real setup documentation, not breadth or being first.

## Architecture

Built as a **declarative ("HTTP API") node**, same as the Maps node — routing lives in each operation's `routing` block, with `preSend`/`postReceive` hooks in `GenericFunctions.ts` for anything declarative routing can't express.

Two n8n internals shape the whole design, both discovered by reading n8n's source, not from its docs:

- **`preAuthentication` only runs if the credential declares a `type: 'hidden'` property with `typeOptions: { expirable: true }`.** Without that trigger field the method is dead code that never runs and never errors. That's what the `accessToken` field in `DocuSignApi.credentials.ts` is for — it is never shown to or filled in by the user.
- **n8n resolves a request's `baseURL`/`url` expressions *before* running `preAuthentication`/`authenticate`.** So `$credentials.baseUri`/`$credentials.accountId` can never be used in a URL expression. DocuSign's API host is per-account and only discoverable through an authenticated `/oauth/userinfo` call, so every operation instead carries a `resolveAccountBaseUrl` preSend ([GenericFunctions.ts](nodes/DocuSign/GenericFunctions.ts)) that discovers the host and sets `requestOptions.baseURL` directly. A structural test enforces that every operation has it.

- **Auth**: single credential type, "DocuSign API", using **JWT Grant** (RS256 assertion → access token → userinfo), signed with Node's built-in `node:crypto`. No `jsonwebtoken`, no `docusign-esign` SDK — verified community nodes must ship with **zero runtime dependencies**, so `package.json` has no `dependencies` key at all. Requires a one-time browser consent grant per impersonated user; `preAuthentication` detects `consent_required` and returns the consent URL in the error message.
- **Resources/operations** (1 resource, 3 operations):
  - Envelope → Create From Template, Get Status, Download Document
- **Error handling**: the eSignature API uses real HTTP status codes, so n8n's declarative routing raises `NodeApiError` on its own — unlike the Maps node, no `postReceive` error handler is needed. Errors raised in our own code use `NodeOperationError` (in preSend hooks, which have `getNode()`) or a plain `Error` (in the credential's `preAuthentication`, which does not).

## Commands

```bash
# Install dependencies
npm install

# Local dev — boots n8n with the node pre-loaded
# IMPORTANT: if you pass --custom-user-folder, point it OUTSIDE this repo
# (e.g. ~/.n8n-docusign-dev). A path inside the repo creates a recursive
# symlink loop that makes any tool walking the tree fail with ENAMETOOLONG.
npm run dev

# Lint
npm run lint

# Unit + structural tests
npm test

# Build
npm run build

# Verify JWT auth outside n8n (reads .env, no n8n involved)
npm run docusign:jwt-test

# Build, lint, tag, and publish to npm in one step
npm run release
```

Sandbox credentials for local testing live in `.env` (gitignored, see `.env.example`) and the RSA key pair in `secrets/` (also gitignored). Paste the values into the "DocuSign API" credential in the n8n dev instance's UI to test live.

## Distribution context

Two long-standing community request threads (a 2021 request and a November 2025 "we need this" post) are the target audience, alongside several existing early-stage community DocuSign nodes. That shapes README priorities: JWT setup has far more friction than an API key (Integration Key, RSA key generation, the one-time consent URL), so screenshotted, step-by-step credential docs are the actual product differentiator — and the announcement should acknowledge the existing nodes rather than pitch this as greenfield.
