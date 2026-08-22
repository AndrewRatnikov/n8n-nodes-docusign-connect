import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';

interface DocuSignAccount {
	account_id: string;
	base_uri: string;
	is_default: boolean;
}

interface DocuSignUserInfo {
	accounts: DocuSignAccount[];
}

/**
 * n8n resolves a request's `baseURL`/`url` expressions before running the
 * credential's own `preAuthentication` + `authenticate` steps, so those steps
 * can add an Authorization header (which they do, via the credential's
 * `accessToken`) but can't influence the URL itself. DocuSign's API host is
 * account-specific, discovered via `/oauth/userinfo` — so this preSend makes
 * an authenticated call to discover it and sets `baseURL` before the real
 * request goes out. Reuses `httpRequestWithAuthentication` rather than
 * re-signing a JWT here, so the credential's signing logic stays in one place.
 */
export async function resolveAccountBaseUrl(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const credentials = await this.getCredentials('docuSignApi');
	const authHost =
		credentials.environment === 'production' ? 'account.docusign.com' : 'account-d.docusign.com';

	const userInfo = (await this.helpers.httpRequestWithAuthentication.call(this, 'docuSignApi', {
		method: 'GET',
		url: `https://${authHost}/oauth/userinfo`,
	})) as DocuSignUserInfo;

	const account = userInfo.accounts.find((a) => a.is_default) ?? userInfo.accounts[0];
	if (!account) {
		throw new Error('DocuSign userinfo returned no accounts for this User ID.');
	}

	requestOptions.baseURL = `${account.base_uri}/restapi/v2.1/accounts/${account.account_id}`;
	return requestOptions;
}
