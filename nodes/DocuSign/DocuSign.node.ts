import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

// Placeholder scaffold node. Replaced with the real Create Envelope / Get
// Envelope Status / Download Signed Document operations in Phase 3 — see
// docs/plan.md.
export class DocuSign implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocuSign',
		name: 'docuSign',
		icon: 'file:docuSign.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Send documents for signature and manage envelopes via the DocuSign eSignature API',
		defaults: {
			name: 'DocuSign',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'docuSignApi', required: true }],
		requestDefaults: {
			baseURL: 'https://api.docusign.net/restapi/v2.1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Envelope', value: 'envelope' }],
				default: 'envelope',
			},
		],
	};
}
