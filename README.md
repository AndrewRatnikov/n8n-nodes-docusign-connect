# n8n-nodes-docusign-connect

An n8n community node for the DocuSign eSignature API — send an envelope from a template, check its status, and download the signed document — with JWT Grant authentication wired up properly instead of hand-rolled HTTP Request nodes.

Other community DocuSign nodes already exist. This one is deliberately narrow: three operations that cover the common case, correct JWT auth (including the one-time consent step that trips up most first-time setups), and setup documentation that actually walks through the DocuSign dashboard.

## What's included

| Resource | Operation | What it does |
|---|---|---|
| Envelope | Create From Template | Fills an existing DocuSign template's roles and sends it for signature (or saves it as a draft) |
| Envelope | Get Status | Returns the envelope's current state — sent, delivered, completed, declined, or voided |
| Envelope | Download Document | Downloads a document from the envelope as a binary file — a single document, all of them combined into one PDF, or the certificate of completion |

The node is also available to n8n's **AI Agent** nodes as a tool (`usableAsTool: true`) — an agent can send a contract for signature or check whether it's been signed without a separate HTTP Request tool definition.

**Not included in v1** (deliberately — ask for them if you need them): raw document upload with anchor tabs, template management, bulk send, embedded signing, and DocuSign Connect webhook events.

## Installation

In n8n: **Settings → Community Nodes → Install**, then enter `n8n-nodes-docusign-connect`.

For a self-hosted/npm-based install:

```bash
npm install n8n-nodes-docusign-connect
```

## Credentials

This node authenticates with **JWT Grant** (DocuSign's server-to-server flow) rather than a user-facing OAuth redirect, so it works in unattended workflows. Setup takes about ten minutes and has one step that cannot be automated — a one-time consent click in a real browser.

### 1. Get a DocuSign account and an Integration Key

1. Create a free [DocuSign Developer account](https://developers.docusign.com/) if you don't already have one. Developer accounts live on `account-d.docusign.com` — that's the **Demo/Sandbox** environment in the credential.
2. Go to **Settings → Apps and Keys** and click **Add App and Integration Key**. Name it whatever you like (e.g. `n8n`).
3. Copy the **Integration Key** (also called the Client ID) — you'll paste it into n8n.
4. On the same page, note the **User ID** shown under your account name. It is a GUID, *not* your email address. This is the user the node will impersonate.

### 2. Generate an RSA key pair

On the app's page, under **Service Integration**, you can click **Generate RSA** — but DocuSign then displays the private key in the browser. To keep the private key off a third-party UI entirely, generate it locally and upload only the public half:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out docusign-private.pem
```

```bash
openssl rsa -in docusign-private.pem -pubout -out docusign-public.pem
```

Then use **Service Integration → Upload RSA** and paste the contents of `docusign-public.pem`. Keep `docusign-private.pem` — n8n needs it.

### 3. Grant consent, once

JWT impersonation requires the impersonated user to consent once, in a browser. Until that happens every request fails with `consent_required`. Open this URL, substituting your Integration Key (and, if your app registers a different redirect URI, that URI), sign in as the impersonated user, and click **Allow**:

```
https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=https://www.docusign.com
```

You'll be redirected to a page that looks like nothing happened — that's expected, the consent is recorded server-side. For production, use `account.docusign.com` instead of `account-d.docusign.com`.

If you skip this step, the node's credential test fails with a message containing this exact URL, so it's recoverable.

### 4. Create the credential in n8n

Create a **DocuSign API** credential and fill in:

| Field | Value |
|---|---|
| Environment | **Demo/Sandbox** for a developer account, **Production** for a live one |
| Integration Key | From step 1 |
| User ID | The impersonated user's GUID from step 1 — not their email |
| Private Key | The full contents of `docusign-private.pem`, including the `-----BEGIN`/`-----END` lines |

Click **Test** — a green check means the JWT was signed, exchanged for a token, and accepted.

The node discovers your account's API host automatically (DocuSign's eSignature host is per-account — `demo.docusign.net`, `na3.docusign.net`, `eu.docusign.net`, and so on), so there's no base-URL field to get wrong.

## Example use case

Send a contract for signature when a deal closes, then wait for it to come back signed:

1. **Envelope → Create From Template** with the template ID of your contract and the signer's name and email filled into the template's role. Returns an `envelopeId`.
2. **Envelope → Get Status** with that `envelopeId`, on a schedule or after a wait, until `status` is `completed`.
3. **Envelope → Download Document** with `documentId` set to `combined` to pull the fully signed PDF into a binary field, ready to store in Drive/S3 or attach to an email.

Because the operation works from an existing template, the signature placement, email wording, and routing order are whatever you already configured in DocuSign's web UI — no hand-computed `signHere` coordinates.

## Notes and limits

- **Templates only.** Create From Template requires a template that already exists in your DocuSign account, and every Role Name you enter must match a role defined on that template exactly. A mismatched role name is rejected by DocuSign, not silently ignored.
- **The private key is stored in n8n's credential store**, encrypted at rest with your n8n encryption key, like every other n8n credential. It's a full impersonation credential for the configured user — scope the DocuSign user accordingly.
- **Consent is per Integration Key, per user, per environment.** Moving from the sandbox to production means a new Integration Key, a new consent click, and a different User ID.
- **Demo accounts have envelope limits.** DocuSign's developer sandbox caps how many envelopes you can send; it's a sandbox, not a free production tier.

## Development

See [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) for the project's architecture notes and n8n node-building conventions, and [docs/plan.md](docs/plan.md) for the full build history — including the two n8n internals bugs (silent `preAuthentication`, unresolvable `$credentials` in URLs) that shaped the design.

```bash
npm install              # install dependencies
npm run dev              # boots a local n8n with this node loaded
                         # pass --custom-user-folder only with a path OUTSIDE this repo
npm run build            # compile TypeScript
npm run lint             # eslint-plugin-n8n-nodes-base rules
npm test                 # vitest unit + structural tests
npm run docusign:jwt-test  # verify JWT auth outside n8n, reads .env
```

## License

MIT — see [LICENSE](LICENSE).
