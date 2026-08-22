#!/usr/bin/env node
// Standalone JWT Grant test script — Phase 1 of docs/plan.md.
//
// Deliberately lives outside nodes/ and credentials/ so it's never bundled
// into the published package, and deliberately uses only Node's built-in
// `crypto` + global `fetch` (no `jsonwebtoken`, no `docusign-esign` SDK) —
// same "zero runtime dependencies" constraint the real node will follow in
// Phase 3.
//
// Usage (Node 20.6+ / 22 LTS):
//   node --env-file=.env scripts/docusign-jwt-test.mjs
//
// Requires .env (copy .env.example -> .env and fill in the values from the
// DocuSign Apps and Keys page) and a completed one-time consent click — see
// docs/plan.md Phase 1 for both.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const USER_ID = process.env.DOCUSIGN_USER_ID;
const PRIVATE_KEY_PATH = process.env.DOCUSIGN_PRIVATE_KEY_PATH ?? './secrets/docusign-private.pem';
const ENVIRONMENT = process.env.DOCUSIGN_ENV ?? 'demo';

const AUTH_HOST = ENVIRONMENT === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';

function requireEnv(name, value) {
	if (!value) {
		console.error(`Missing ${name}. Copy .env.example to .env and fill it in first.`);
		process.exit(1);
	}
}

requireEnv('DOCUSIGN_INTEGRATION_KEY', INTEGRATION_KEY);
requireEnv('DOCUSIGN_USER_ID', USER_ID);

function base64url(input) {
	return Buffer.from(input)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function buildAssertion(privateKeyPem) {
	const header = { alg: 'RS256', typ: 'JWT' };
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iss: INTEGRATION_KEY,
		sub: USER_ID,
		aud: AUTH_HOST,
		iat: now,
		// DocuSign JWT access tokens are valid for up to 1 hour; the
		// assertion's own exp just needs to be in the future.
		exp: now + 3600,
		scope: 'signature impersonation',
	};

	const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
	const signer = createSign('RSA-SHA256');
	signer.update(signingInput);
	signer.end();
	const signature = signer.sign(privateKeyPem).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

	return `${signingInput}.${signature}`;
}

async function exchangeToken(assertion) {
	const res = await fetch(`https://${AUTH_HOST}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion,
		}),
	});

	const body = await res.json().catch(() => ({}));

	if (!res.ok) {
		if (body.error === 'consent_required') {
			const consentUrl =
				`https://${AUTH_HOST}/oauth/auth?response_type=code&scope=signature%20impersonation` +
				`&client_id=${INTEGRATION_KEY}&redirect_uri=https://localhost`;
			console.error(
				'DocuSign returned consent_required — the one-time consent click has not been done yet.\n' +
					'Open this URL in a real browser, log in as the impersonated user, and click Allow:\n\n' +
					`  ${consentUrl}\n\n` +
					'Then re-run this script.',
			);
			process.exit(1);
		}
		console.error('Token exchange failed:', res.status, body);
		process.exit(1);
	}

	return body;
}

async function fetchUserInfo(accessToken) {
	const res = await fetch(`https://${AUTH_HOST}/oauth/userinfo`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		console.error('userinfo call failed:', res.status, body);
		process.exit(1);
	}
	return body;
}

async function main() {
	let privateKeyPem;
	try {
		privateKeyPem = readFileSync(PRIVATE_KEY_PATH, 'utf8');
	} catch (err) {
		console.error(`Could not read private key at ${PRIVATE_KEY_PATH}:`, err.message);
		process.exit(1);
	}

	const assertion = buildAssertion(privateKeyPem);
	console.log(`Requesting token from https://${AUTH_HOST}/oauth/token ...`);
	const tokenResponse = await exchangeToken(assertion);
	console.log('Token exchange OK:', {
		token_type: tokenResponse.token_type,
		expires_in: tokenResponse.expires_in,
	});

	const userInfo = await fetchUserInfo(tokenResponse.access_token);
	console.log('userinfo OK. Accounts:');
	for (const account of userInfo.accounts ?? []) {
		console.log(
			`  - account_id=${account.account_id} base_uri=${account.base_uri} is_default=${account.is_default}`,
		);
	}
	console.log(
		'\nSave the base_uri for your default account — Phase 3 needs it (or re-discover it via this same userinfo call) for every eSignature API request.',
	);
}

main();
