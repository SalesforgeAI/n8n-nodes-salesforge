import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

import { SALESFORGE_API_BASE_URL } from '../nodes/Salesforge/constants';

export class SalesforgeApi implements ICredentialType {
	name = 'salesforgeApi';

	displayName = 'Salesforge API';

	icon = {
		light: 'file:salesforge.svg',
		dark: 'file:salesforge.dark.svg',
	} as const;

	documentationUrl = 'https://help.salesforge.ai/en/articles/10333607-salesforge-api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key from Settings → Integrations → n8n, or from Settings → API',
		},
		{
			displayName: 'Workspace ID',
			name: 'workspaceId',
			type: 'string',
			default: '',
			required: true,
			description: 'ID of the Salesforge workspace this credential can access',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{$credentials.apiKey.trim()}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: SALESFORGE_API_BASE_URL,
			url: '=/workspaces/{{$credentials.workspaceId.trim()}}',
			method: 'GET',
		},
	};
}
