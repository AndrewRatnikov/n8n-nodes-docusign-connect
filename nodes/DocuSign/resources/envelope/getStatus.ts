import type { INodeProperties } from 'n8n-workflow';

const showOnlyForGetStatus = {
	resource: ['envelope'],
	operation: ['getStatus'],
};

export const getStatusFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Envelope ID',
		name: 'envelopeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showOnlyForGetStatus },
		description: 'The envelope ID returned when the envelope was created',
	},
];
