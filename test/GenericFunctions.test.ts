import { describe, expect, it, vi } from 'vitest';
import type { IExecuteSingleFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { resolveAccountBaseUrl } from '../nodes/DocuSign/GenericFunctions';
import { buildCreateEnvelopeBody } from '../nodes/DocuSign/resources/envelope/createFromTemplate';

const testNode: INode = {
	name: 'DocuSign',
	type: 'test',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function createMockContext(options: {
	parameters?: Record<string, unknown>;
	credentials?: Record<string, unknown>;
	userInfo?: unknown;
	httpError?: unknown;
}): IExecuteSingleFunctions & { httpRequestWithAuthentication: ReturnType<typeof vi.fn> } {
	const parameters = options.parameters ?? {};
	const httpRequestWithAuthentication = vi.fn(async () => {
		if (options.httpError) throw options.httpError;
		return options.userInfo;
	});

	const context = {
		getNodeParameter: (name: string, fallback?: unknown) => parameters[name] ?? fallback,
		getNode: () => testNode,
		getCredentials: async () => options.credentials ?? { environment: 'demo' },
		continueOnFail: () => false,
		helpers: { httpRequestWithAuthentication },
		httpRequestWithAuthentication,
	};

	return context as unknown as IExecuteSingleFunctions & {
		httpRequestWithAuthentication: ReturnType<typeof vi.fn>;
	};
}

const userInfoWithDefaultAccount = {
	accounts: [
		{ account_id: 'not-default', base_uri: 'https://eu.docusign.net', is_default: false },
		{ account_id: 'default-account', base_uri: 'https://demo.docusign.net', is_default: true },
	],
};

describe('resolveAccountBaseUrl', () => {
	it('builds the account-specific eSignature base URL from userinfo', async () => {
		const ctx = createMockContext({ userInfo: userInfoWithDefaultAccount });
		const requestOptions: IHttpRequestOptions = { url: '/envelopes' };

		await resolveAccountBaseUrl.call(ctx, requestOptions);

		expect(requestOptions.baseURL).toBe(
			'https://demo.docusign.net/restapi/v2.1/accounts/default-account',
		);
	});

	it('discovers the host on the demo auth host by default', async () => {
		const ctx = createMockContext({ userInfo: userInfoWithDefaultAccount });

		await resolveAccountBaseUrl.call(ctx, { url: '/envelopes' });

		expect(ctx.httpRequestWithAuthentication).toHaveBeenCalledWith(
			'docuSignApi',
			expect.objectContaining({ url: 'https://account-d.docusign.com/oauth/userinfo' }),
		);
	});

	it('uses the production auth host when the credential says production', async () => {
		const ctx = createMockContext({
			credentials: { environment: 'production' },
			userInfo: userInfoWithDefaultAccount,
		});

		await resolveAccountBaseUrl.call(ctx, { url: '/envelopes' });

		expect(ctx.httpRequestWithAuthentication).toHaveBeenCalledWith(
			'docuSignApi',
			expect.objectContaining({ url: 'https://account.docusign.com/oauth/userinfo' }),
		);
	});

	it('falls back to the first account when none is flagged as default', async () => {
		const ctx = createMockContext({
			userInfo: {
				accounts: [
					{ account_id: 'first', base_uri: 'https://demo.docusign.net', is_default: false },
					{ account_id: 'second', base_uri: 'https://demo.docusign.net', is_default: false },
				],
			},
		});
		const requestOptions: IHttpRequestOptions = { url: '/envelopes' };

		await resolveAccountBaseUrl.call(ctx, requestOptions);

		expect(requestOptions.baseURL).toBe('https://demo.docusign.net/restapi/v2.1/accounts/first');
	});

	it('throws a readable error when userinfo returns no accounts', async () => {
		const ctx = createMockContext({ userInfo: { accounts: [] } });

		await expect(resolveAccountBaseUrl.call(ctx, { url: '/envelopes' })).rejects.toThrow(
			/no accounts for this User ID/,
		);
	});
});

describe('buildCreateEnvelopeBody', () => {
	it('maps recipients onto the template roles DocuSign expects', async () => {
		const ctx = createMockContext({
			parameters: {
				templateId: 'template-123',
				status: 'sent',
				emailSubject: '',
				recipients: {
					values: [{ roleName: 'Signer 1', name: 'Ada Lovelace', email: 'ada@example.com' }],
				},
			},
		});
		const requestOptions: IHttpRequestOptions = { url: '/envelopes' };

		await buildCreateEnvelopeBody.call(ctx, requestOptions);

		expect(requestOptions.json).toBe(true);
		expect(requestOptions.body).toEqual({
			templateId: 'template-123',
			status: 'sent',
			templateRoles: [{ roleName: 'Signer 1', name: 'Ada Lovelace', email: 'ada@example.com' }],
		});
	});

	it('omits emailSubject entirely when blank, so the template keeps its own', async () => {
		const ctx = createMockContext({
			parameters: {
				templateId: 'template-123',
				status: 'created',
				emailSubject: '',
				recipients: {},
			},
		});
		const requestOptions: IHttpRequestOptions = { url: '/envelopes' };

		await buildCreateEnvelopeBody.call(ctx, requestOptions);

		expect(requestOptions.body).not.toHaveProperty('emailSubject');
	});

	it('sends an empty templateRoles array rather than undefined when no recipients are set', async () => {
		const ctx = createMockContext({
			parameters: {
				templateId: 'template-123',
				status: 'sent',
				emailSubject: 'Please sign',
				recipients: {},
			},
		});
		const requestOptions: IHttpRequestOptions = { url: '/envelopes' };

		await buildCreateEnvelopeBody.call(ctx, requestOptions);

		expect(requestOptions.body).toEqual({
			templateId: 'template-123',
			status: 'sent',
			emailSubject: 'Please sign',
			templateRoles: [],
		});
	});
});
