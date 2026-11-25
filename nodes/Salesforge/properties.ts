import type { INodeProperties } from 'n8n-workflow';

const resource: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Contact', value: 'contact' },
		{ name: 'Label', value: 'label' },
		{ name: 'Sequence', value: 'sequence' },
		{ name: 'Thread', value: 'thread' },
	],
	default: 'thread',
};

const operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a contact',
				description: 'Create a contact',
			},
			{
				name: 'Create Many',
				value: 'createMany',
				action: 'Create many contacts',
				description: 'Create up to 100 contacts in one request',
			},
		],
		default: 'create',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['label'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many labels',
				description: 'Get many Primebox labels',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['sequence'] } },
		options: [
			{
				name: 'Add Contacts',
				value: 'addContacts',
				action: 'Add contacts to a sequence',
				description: 'Add contacts to a sequence',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many sequences',
				description: 'Get many sequences',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['thread'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many threads',
				description: 'Get many threads',
			},
			{
				name: 'Update Label',
				value: 'updateLabel',
				action: 'Update a thread label',
				description: 'Set the Primebox label on a thread',
			},
		],
		default: 'updateLabel',
	},
];

const listFields: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['getAll'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { operation: ['getAll'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
];

function show(resourceName: string, operationName: string | string[]): INodeProperties['displayOptions'] {
	return {
		show: {
			resource: [resourceName],
			operation: Array.isArray(operationName) ? operationName : [operationName],
		},
	};
}

function contactValues(mode: 'create' | 'createMany'): INodeProperties[] {
	const tagDescription =
		mode === 'createMany'
			? 'Tag names to apply. Each contact needs a tag name or a tag ID.'
			: 'Tag names to apply. Leave empty and Salesforge adds a date tag.';

	return [
		{
			displayName: 'First Name',
			name: 'firstName',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'Last Name',
			name: 'lastName',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Email',
			name: 'email',
			type: 'string',
			placeholder: 'name@example.com',
			default: '',
			description: 'Email address. Provide an email, a LinkedIn URL, or both.',
		},
		{
			displayName: 'LinkedIn URL',
			name: 'linkedinUrl',
			type: 'string',
			default: '',
			description: 'LinkedIn profile URL. Provide an email, a LinkedIn URL, or both.',
		},
		{
			displayName: 'Company',
			name: 'company',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Position',
			name: 'position',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Tags',
			name: 'tags',
			type: 'string',
			typeOptions: { multipleValues: true },
			default: [],
			description: tagDescription,
		},
		{
			displayName: 'Tag Names or IDs',
			name: 'tagIds',
			type: 'multiOptions',
			typeOptions: { loadOptionsMethod: 'getTags' },
			default: [],
			description:
				'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		},
		{
			displayName: 'Custom Variables',
			name: 'customVars',
			type: 'fixedCollection',
			placeholder: 'Add Variable',
			typeOptions: { multipleValues: true },
			default: {},
			options: [
				{
					displayName: 'Variable',
					name: 'variable',
					values: [
						{
							displayName: 'Name',
							name: 'name',
							type: 'string',
							default: '',
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
						},
					],
				},
			],
		},
	];
}

const contactFields: INodeProperties[] = contactValues('create').map((field) => ({
	...field,
	displayOptions: show('contact', 'create'),
}));

const createManyFields: INodeProperties[] = [
	{
		displayName: 'Contacts',
		name: 'contacts',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Contact',
		default: {},
		displayOptions: show('contact', 'createMany'),
		description: '1 to 100 contacts. The whole request fails if any contact is invalid.',
		options: [
			{
				displayName: 'Contact',
				name: 'contact',
				values: contactValues('createMany'),
			},
		],
	},
];

const sequenceFields: INodeProperties[] = [
	{
		displayName: 'Sequence Name or ID',
		name: 'sequenceId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSequences' },
		required: true,
		default: '',
		displayOptions: show('sequence', 'addContacts'),
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Contact IDs',
		name: 'contactIds',
		type: 'string',
		typeOptions: { multipleValues: true },
		required: true,
		default: [],
		displayOptions: show('sequence', 'addContacts'),
		description: 'IDs of the contacts to add to the sequence',
	},
	{
		displayName: 'Type',
		name: 'sequenceType',
		type: 'options',
		options: [
			{ name: 'All', value: 'all' },
			{ name: 'Legacy', value: 'legacy' },
			{ name: 'Multichannel', value: 'multichannel' },
		],
		default: 'all',
		displayOptions: show('sequence', 'getAll'),
		description: 'Which sequences to return',
	},
];

const threadFields: INodeProperties[] = [
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		displayOptions: show('thread', 'getAll'),
		description: 'Text to match against threads. Leave empty to skip this filter.',
	},
	{
		displayName: 'Sequence IDs',
		name: 'sequenceIds',
		type: 'string',
		typeOptions: { multipleValues: true },
		default: [],
		displayOptions: show('thread', 'getAll'),
		description: 'Return threads from these sequences only. Leave empty for every sequence.',
	},
	{
		displayName: 'Thread ID',
		name: 'threadId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: show('thread', 'updateLabel'),
		description: 'ID of the thread to label. Accepts email threads and LinkedIn-only threads.',
	},
	{
		displayName: 'Label Name or ID',
		name: 'labelId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLabels' },
		required: true,
		default: '',
		displayOptions: show('thread', 'updateLabel'),
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
];

export const salesforgeProperties: INodeProperties[] = [
	resource,
	...operations,
	...listFields,
	...contactFields,
	...createManyFields,
	...sequenceFields,
	...threadFields,
];
