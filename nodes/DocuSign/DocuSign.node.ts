import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { envelopeDescription } from './resources/envelope';

// Maps the raw parameter values (e.g. "createFromTemplate") shown in the
// canvas subtitle to their display names (e.g. "Create From Template"), since
// $parameter[...] in a routing expression returns the value, not the label
// shown in the dropdown.
const resourceDisplayNames: Record<string, string> = {
	envelope: 'Envelope',
};

const operationDisplayNames: Record<string, string> = {
	createFromTemplate: 'Create From Template',
	getStatus: 'Get Status',
	downloadDocument: 'Download Document',
};

export class DocuSign implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocuSign',
		name: 'docuSign',
		icon: { light: 'file:docuSign.svg', dark: 'file:docuSign.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: `={{(${JSON.stringify(operationDisplayNames)})[$parameter["operation"]] + ": " + (${JSON.stringify(resourceDisplayNames)})[$parameter["resource"]]}}`,
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
			{
				displayName: 'Request Options',
				name: 'requestOptions',
				type: 'collection',
				isNodeSetting: true,
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Batching',
						name: 'batching',
						placeholder: 'Add Batching',
						type: 'fixedCollection',
						typeOptions: { multipleValues: false },
						default: {
							batch: {},
						},
						options: [
							{
								displayName: 'Batching',
								name: 'batch',
								values: [
									{
										displayName: 'Items per Batch',
										name: 'batchSize',
										type: 'number',
										typeOptions: { minValue: -1 },
										default: 10,
										description:
											'Input will be split in batches to throttle requests. -1 for disabled. 0 will be treated as 1.',
									},
									{
										displayName: 'Batch Interval (Ms)',
										name: 'batchInterval',
										type: 'number',
										typeOptions: { minValue: 0 },
										default: 1000,
										description:
											'Time (in milliseconds) between each batch of requests. 0 for disabled.',
									},
								],
							},
						],
					},
				],
			},
		],
	};
}
