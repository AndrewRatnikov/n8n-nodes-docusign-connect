import { createSign } from 'node:crypto';
import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';

function base64url(input: Buffer | string): string {
	return Buffer.from(input)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

interface DocuSignAccount {
	account_id: string;
	base_uri: string;
	is_default: boolean;
}

export class DocuSignApi implements ICredentialType {
	name = 'docuSignApi';

	displayName = 'DocuSign API';

	icon = { light: 'file:docuSign.svg', dark: 'file:docuSign.svg' } as const;

	documentationUrl = 'https://github.com/AndrewRatnikov/n8n-nodes-docusign-connect#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{ name: 'Demo/Sandbox', value: 'demo' },
				{ name: 'Production', value: 'production' },
			],
			default: 'demo',
		},
		{
			displayName: 'Integration Key',
			name: 'integrationKey',
			type: 'string',
			required: true,
			default: '',
			description:
				'The Integration Key (Client ID) from your app on the DocuSign Apps and Keys page',
		},
		{
			displayName: 'User ID',
			name: 'userId',
			type: 'string',
			required: true,
			default: '',
			description:
				"The impersonated user's ID (a GUID, not an email address) — shown on the Apps and Keys page under your account name",
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: { password: true, rows: 6 },
			required: true,
			default: '',
			description:
				'The RSA private key (PEM format, including the BEGIN/END lines) whose matching public key was uploaded to this Integration Key under Service Integration. Requires a one-time consent grant for this User ID — see the README.',
		},
		{
			// n8n only invokes `preAuthentication` when a credential declares a
			// hidden `expirable` property — this is that trigger. Its value is
			// managed entirely by preAuthentication's return value below; it's
			// never shown to or entered by the user.
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'hidden',
			typeOptions: { expirable: true, password: true },
			default: '',
		},
	];

	async preAuthentication(
		this: IHttpRequestHelper,
		credentials: ICredentialDataDecryptedObject,
	): Promise<IDataObject> {
		const authHost =
			credentials.environment === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';
		const now = Math.floor(Date.now() / 1000);
		const header = { alg: 'RS256', typ: 'JWT' };
		const payload = {
			iss: credentials.integrationKey,
			sub: credentials.userId,
			aud: authHost,
			iat: now,
			exp: now + 3600,
			scope: 'signature impersonation',
		};

		const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
		const signer = createSign('RSA-SHA256');
		signer.update(signingInput);
		signer.end();
		const assertion = `${signingInput}.${base64url(signer.sign(credentials.privateKey as string))}`;

		const tokenResponse = (await this.helpers.httpRequest({
			method: 'POST',
			url: `https://${authHost}/oauth/token`,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion,
			}).toString(),
		})) as { access_token: string };

		// The API host is per-account, not a fixed DocuSign domain — discover it
		// from userinfo rather than hardcoding api.docusign.net.
		const userInfo = (await this.helpers.httpRequest({
			method: 'GET',
			url: `https://${authHost}/oauth/userinfo`,
			headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
		})) as { accounts: DocuSignAccount[] };

		const account = userInfo.accounts.find((a) => a.is_default) ?? userInfo.accounts[0];
		if (!account) {
			throw new Error('DocuSign userinfo returned no accounts for this User ID.');
		}

		return {
			accessToken: tokenResponse.access_token,
			accountId: account.account_id,
			baseUri: account.base_uri,
		};
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	// Only references `environment`, which is a plain stored field — unlike
	// `baseUri`/`accountId`, it's resolvable before preAuthentication runs (see
	// GenericFunctions.ts for why those two can't be used in a URL here).
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.environment === "production" ? "https://account.docusign.com" : "https://account-d.docusign.com"}}',
			url: '/oauth/userinfo',
		},
	};
}
