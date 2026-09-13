import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

interface DocuSignAccount {
	account_id: string;
	base_uri: string;
	is_default: boolean;
}

interface DocuSignUserInfo {
	accounts: DocuSignAccount[];
}

// The eSignature API reports failures with real HTTP status codes (401 on a
// dead token, 404 on an unknown envelope, 400 with an `errorCode`/`message`
// body on a validation error), so n8n's declarative routing raises a
// NodeApiError on its own — no postReceive error handler is needed here, the
// way Google's HTTP-200-with-error-in-body APIs required one in the Maps node.

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

	const account = userInfo.accounts?.find((a) => a.is_default) ?? userInfo.accounts?.[0];
	if (!account) {
		throw new NodeOperationError(
			this.getNode(),
			'DocuSign returned no accounts for this User ID.',
			{
				description:
					'Check that the User ID in the credential is the GUID of a user on the account you expect, and that it matches the selected Environment (Demo/Sandbox vs Production).',
			},
		);
	}

	requestOptions.baseURL = `${account.base_uri}/restapi/v2.1/accounts/${account.account_id}`;
	return requestOptions;
}
