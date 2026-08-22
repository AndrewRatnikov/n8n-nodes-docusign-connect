import type { INodeProperties } from 'n8n-workflow';

const showOnlyForDownloadDocument = {
	resource: ['envelope'],
	operation: ['downloadDocument'],
};

export const downloadDocumentFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Envelope ID',
		name: 'envelopeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showOnlyForDownloadDocument },
	},
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		default: 'combined',
		displayOptions: { show: showOnlyForDownloadDocument },
		description:
			'A specific document ID, "combined" for every document merged into one PDF, or "certificate" for the certificate of completion',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		displayOptions: { show: showOnlyForDownloadDocument },
		description: 'The name of the output binary field to write the downloaded file to',
	},
];
