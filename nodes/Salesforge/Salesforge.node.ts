import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { getWorkspaceId, salesforgeList, workspacePath } from './api';
import { ContactInputError, runSalesforgeOperation } from './operations';
import { salesforgeProperties } from './properties';

type NamedRecord = {
	id: string;
	name: string;
};

// Salesforge is programmatic because Update Label and Add Contacts return HTTP 204
// with an empty body, and Get Many has to page the list into separate items.
export class Salesforge implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Salesforge',
		name: 'salesforge',
		icon: { light: 'file:salesforge.svg', dark: 'file:salesforge.dark.svg' },
		group: ['output'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create contacts, manage sequences, and update Primebox labels in Salesforge',
		defaults: {
			name: 'Salesforge',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'salesforgeApi',
				required: true,
			},
		],
		properties: salesforgeProperties,
	};

	methods = {
		loadOptions: {
			async getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadNamedOptions(this, '/primebox-labels', 1000);
			},
			async getSequences(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadNamedOptions(this, '/sequences', 1000);
			},
			async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadNamedOptions(this, '/tags', 100);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const workspaceId = await getWorkspaceId(this);
				const produced = await runSalesforgeOperation(
					this,
					this.getNode(),
					resource,
					operation,
					workspaceId,
					itemIndex,
				);

				for (const json of produced) {
					returnData.push({ json, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							message: error instanceof Error ? error.message : 'Salesforge request failed',
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				if (error instanceof NodeOperationError || error instanceof ContactInputError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}

async function loadNamedOptions(
	context: ILoadOptionsFunctions,
	suffix: string,
	pageSize: number,
): Promise<INodePropertyOptions[]> {
	const workspaceId = await getWorkspaceId(context);
	const records = await salesforgeList<NamedRecord>(
		context,
		workspacePath(workspaceId, suffix),
		{ returnAll: true, limit: 0, pageSize },
	);

	return records
		.map((record) => ({ name: record.name, value: record.id }))
		.sort((left, right) => left.name.localeCompare(right.name));
}
