import type { INodeProperties } from 'n8n-workflow';
import { resolveAccountBaseUrl } from '../../GenericFunctions';
import { buildCreateEnvelopeBody, createFromTemplateFieldsDescription } from './createFromTemplate';
import { downloadDocumentFieldsDescription } from './downloadDocument';
import { getStatusFieldsDescription } from './getStatus';

const showOnlyForEnvelope = {
	resource: ['envelope'],
};

export const envelopeDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForEnvelope },
		options: [
			{
				name: 'Create From Template',
				value: 'createFromTemplate',
				action: 'Create an envelope from a template',
				description: "Send (or draft) an envelope by filling in an existing template's roles",
				routing: {
					request: { method: 'POST', url: '/envelopes' },
					send: { preSend: [resolveAccountBaseUrl, buildCreateEnvelopeBody] },
				},
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				action: 'Get envelope status',
				description: 'Check whether an envelope is sent, delivered, completed, declined, or voided',
				routing: {
					request: { method: 'GET', url: '=/envelopes/{{$parameter.envelopeId}}' },
					send: { preSend: [resolveAccountBaseUrl] },
				},
			},
			{
				name: 'Download Document',
				value: 'downloadDocument',
				action: 'Download a signed document',
				description: "Download a completed envelope's document(s) as a binary file",
				routing: {
					request: {
						method: 'GET',
						url: '=/envelopes/{{$parameter.envelopeId}}/documents/{{$parameter.documentId}}',
						encoding: 'arraybuffer',
					},
					send: { preSend: [resolveAccountBaseUrl] },
					output: {
						postReceive: [
							{
								type: 'binaryData',
								properties: { destinationProperty: '={{$parameter.binaryPropertyName}}' },
							},
						],
					},
				},
			},
		],
		default: 'createFromTemplate',
	},
	...createFromTemplateFieldsDescription,
	...getStatusFieldsDescription,
	...downloadDocumentFieldsDescription,
];
