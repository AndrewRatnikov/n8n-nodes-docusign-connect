import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

const showOnlyForCreateFromTemplate = {
	resource: ['envelope'],
	operation: ['createFromTemplate'],
};

export const createFromTemplateFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showOnlyForCreateFromTemplate },
		description: "The ID of an existing DocuSign template (found on the template's detail page)",
	},
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: { show: showOnlyForCreateFromTemplate },
		description:
			"Fills the template's roles. Each Role Name must match a role already defined on the template.",
		options: [
			{
				name: 'values',
				displayName: 'Recipient',
				values: [
					{
						displayName: 'Role Name',
						name: 'roleName',
						type: 'string',
						default: '',
						description: 'Must match a role name defined on the template exactly',
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
					},
				],
			},
		],
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'sent',
		displayOptions: { show: showOnlyForCreateFromTemplate },
		options: [
			{ name: 'Send Now', value: 'sent' },
			{ name: 'Save as Draft', value: 'created' },
		],
	},
	{
		displayName: 'Email Subject',
		name: 'emailSubject',
		type: 'string',
		default: '',
		displayOptions: { show: showOnlyForCreateFromTemplate },
		description:
			"Overrides the template's default email subject. Leave blank to use the template's own subject.",
	},
];

interface RecipientValue {
	roleName: string;
	name: string;
	email: string;
}

export async function buildCreateEnvelopeBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const templateId = this.getNodeParameter('templateId') as string;
	const status = this.getNodeParameter('status') as string;
	const emailSubject = this.getNodeParameter('emailSubject') as string;
	const recipients = this.getNodeParameter('recipients') as { values?: RecipientValue[] };

	const body: IDataObject = {
		templateId,
		status,
		templateRoles: (recipients.values ?? []).map((recipient) => ({
			roleName: recipient.roleName,
			name: recipient.name,
			email: recipient.email,
		})),
	};

	if (emailSubject) {
		body.emailSubject = emailSubject;
	}

	requestOptions.body = body;
	requestOptions.json = true;

	return requestOptions;
}
