import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { envelopeDescription } from './resources/envelope';

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
			// baseURL is set per-request by each operation's resolveAccountBaseUrl
			// preSend (see GenericFunctions.ts) — DocuSign's API host is
			// account-specific and can only be discovered with an authenticated
			// call, which happens too late to resolve an expression here.
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
			...envelopeDescription,
		],
	};
}
