import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

// Placeholder scaffold credential. Replaced with the real JWT Grant
// implementation (Integration Key, User ID, RSA private key, environment
// toggle, token exchange) in Phase 3 — see docs/plan.md.
export class DocuSignApi implements ICredentialType {
	name = 'docuSignApi';

	displayName = 'DocuSign API';

	icon = { light: 'file:docuSign.svg', dark: 'file:docuSign.svg' } as const;

	documentationUrl = 'https://github.com/AndrewRatnikov/n8n-nodes-docusign-connect#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Integration Key',
			name: 'integrationKey',
			type: 'string',
			required: true,
			default: '',
		},
	];

	// Placeholder test. Replaced with a real JWT token exchange + /oauth/userinfo
	// call in Phase 3.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://account-d.docusign.com',
			url: '/oauth/userinfo',
		},
	};
}
