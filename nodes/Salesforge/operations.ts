import type { IDataObject, IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { salesforgeApiRequest, salesforgeList, throwForStatus, workspacePath } from './api';

type CustomVarRow = { name?: string; value?: string };
type CustomVarCollection = { variable?: CustomVarRow[] };

export type ContactFields = {
	firstName?: string;
	lastName?: string;
	email?: string;
	linkedinUrl?: string;
	company?: string;
	position?: string;
	tags?: string[];
	tagIds?: string[];
	customVars?: CustomVarCollection;
};

type ContactCollection = { contact?: ContactFields[] };

type ListItem = IDataObject;

const LIST_PAGE_SIZE = 1000;

// ContactInputError is a validation failure for contact fields, before any API call.
export class ContactInputError extends Error {}

export function buildContactBody(fields: ContactFields, requireTag: boolean): IDataObject {
	const firstName = text(fields.firstName);
	if (firstName === '') {
		throw new ContactInputError('First name is required');
	}

	const email = text(fields.email);
	const linkedinUrl = text(fields.linkedinUrl);
	if (email === '' && linkedinUrl === '') {
		throw new ContactInputError('Each contact needs an email or a LinkedIn URL');
	}

	const tags = stringList(fields.tags);
	const tagIds = stringList(fields.tagIds);
	if (requireTag && tags.length + tagIds.length === 0) {
		throw new ContactInputError('Each contact in Create Many needs a tag name or a tag ID');
	}

	const body: IDataObject = { firstName };
	setText(body, 'lastName', fields.lastName);
	setText(body, 'email', email);
	setText(body, 'linkedinUrl', linkedinUrl);
	setText(body, 'company', fields.company);
	setText(body, 'position', fields.position);
	if (tags.length > 0) {
		body.tags = tags;
	}
	if (tagIds.length > 0) {
		body.tagIds = tagIds;
	}

	const customVars = customVarMap(fields.customVars);
	if (Object.keys(customVars).length > 0) {
		body.customVars = customVars;
	}

	return body;
}

export async function runSalesforgeOperation(
	context: IExecuteFunctions,
	node: INode,
	resource: string,
	operation: string,
	workspaceId: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	if (resource === 'contact' && operation === 'create') {
		return [await createContact(context, workspaceId, itemIndex)];
	}
	if (resource === 'contact' && operation === 'createMany') {
		return createContacts(context, node, workspaceId, itemIndex);
	}
	if (resource === 'label' && operation === 'getAll') {
		return listResource(context, workspaceId, '/primebox-labels', itemIndex);
	}
	if (resource === 'sequence' && operation === 'getAll') {
		return listSequences(context, workspaceId, itemIndex);
	}
	if (resource === 'sequence' && operation === 'addContacts') {
		return [await addContacts(context, workspaceId, itemIndex)];
	}
	if (resource === 'thread' && operation === 'getAll') {
		return listThreads(context, workspaceId, itemIndex);
	}
	if (resource === 'thread' && operation === 'updateLabel') {
		return [await updateThreadLabel(context, workspaceId, itemIndex)];
	}

	throw new NodeOperationError(node, `Unknown operation: ${resource} ${operation}`, { itemIndex });
}

async function createContact(
	context: IExecuteFunctions,
	workspaceId: string,
	itemIndex: number,
): Promise<IDataObject> {
	const body = buildContactBody(readContactFields(context, itemIndex), false);
	const response = await salesforgeApiRequest<IDataObject>(
		context,
		'POST',
		workspacePath(workspaceId, '/contacts'),
		body,
	);
	throwForStatus(context, response, itemIndex);
	return response.body;
}

async function createContacts(
	context: IExecuteFunctions,
	node: INode,
	workspaceId: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const collection = context.getNodeParameter('contacts', itemIndex, {}) as ContactCollection;
	const contacts = collection.contact ?? [];
	if (contacts.length < 1 || contacts.length > 100) {
		throw new NodeOperationError(node, 'Create Many accepts 1 to 100 contacts per request', {
			itemIndex,
		});
	}

	const response = await salesforgeApiRequest<{ contacts?: IDataObject[] }>(
		context,
		'POST',
		workspacePath(workspaceId, '/contacts/bulk'),
		{
			contacts: contacts.map((contact, index) => {
				try {
					return buildContactBody(contact, true);
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Invalid contact';
					throw new NodeOperationError(node, `Contact ${index + 1}: ${message}`, { itemIndex });
				}
			}),
		},
	);
	throwForStatus(context, response, itemIndex);
	return response.body.contacts ?? [];
}

async function listSequences(
	context: IExecuteFunctions,
	workspaceId: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const sequenceType = context.getNodeParameter('sequenceType', itemIndex, 'all') as string;
	const qs: IDataObject = {};
	if (sequenceType === 'legacy' || sequenceType === 'multichannel') {
		qs.type = sequenceType;
	}

	return listResource(context, workspaceId, '/sequences', itemIndex, qs);
}

async function addContacts(
	context: IExecuteFunctions,
	workspaceId: string,
	itemIndex: number,
): Promise<IDataObject> {
	const sequenceId = text(context.getNodeParameter('sequenceId', itemIndex) as string);
	const contactIds = stringList(context.getNodeParameter('contactIds', itemIndex) as string[]);
	if (sequenceId === '' || contactIds.length === 0) {
		throw new ContactInputError('A sequence and at least one contact ID are required');
	}
	const response = await salesforgeApiRequest(
		context,
		'PUT',
		workspacePath(workspaceId, `/sequences/${encodeURIComponent(sequenceId)}/contacts`),
		{ contactIds },
	);
	throwForStatus(context, response, itemIndex);
	return { success: true, sequenceId, contactIds };
}

async function listThreads(
	context: IExecuteFunctions,
	workspaceId: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const search = text(context.getNodeParameter('search', itemIndex, '') as string);
	const sequenceIds = stringList(context.getNodeParameter('sequenceIds', itemIndex, []) as string[]);
	const qs: IDataObject = {};
	if (search !== '') {
		qs.q = search;
	}
	if (sequenceIds.length > 0) {
		qs.sequence_ids = sequenceIds;
	}

	return listResource(context, workspaceId, '/threads', itemIndex, qs);
}

async function updateThreadLabel(
	context: IExecuteFunctions,
	workspaceId: string,
	itemIndex: number,
): Promise<IDataObject> {
	const threadId = text(context.getNodeParameter('threadId', itemIndex) as string);
	const labelId = context.getNodeParameter('labelId', itemIndex) as string;
	const response = await salesforgeApiRequest(
		context,
		'PUT',
		workspacePath(workspaceId, `/threads/${encodeURIComponent(threadId)}/label`),
		{ labelId },
	);
	throwForStatus(context, response, itemIndex);
	return { success: true, threadId, labelId };
}

async function listResource(
	context: IExecuteFunctions,
	workspaceId: string,
	suffix: string,
	itemIndex: number,
	qs?: IDataObject,
): Promise<IDataObject[]> {
	const returnAll = context.getNodeParameter('returnAll', itemIndex) as boolean;
	const limit = returnAll ? 0 : (context.getNodeParameter('limit', itemIndex) as number);
	return salesforgeList<ListItem>(context, workspacePath(workspaceId, suffix), {
		returnAll,
		limit,
		pageSize: LIST_PAGE_SIZE,
		qs,
		itemIndex,
	});
}

function readContactFields(context: IExecuteFunctions, itemIndex: number): ContactFields {
	return {
		firstName: context.getNodeParameter('firstName', itemIndex) as string,
		lastName: context.getNodeParameter('lastName', itemIndex, '') as string,
		email: context.getNodeParameter('email', itemIndex, '') as string,
		linkedinUrl: context.getNodeParameter('linkedinUrl', itemIndex, '') as string,
		company: context.getNodeParameter('company', itemIndex, '') as string,
		position: context.getNodeParameter('position', itemIndex, '') as string,
		tags: context.getNodeParameter('tags', itemIndex, []) as string[],
		tagIds: context.getNodeParameter('tagIds', itemIndex, []) as string[],
		customVars: context.getNodeParameter('customVars', itemIndex, {}) as CustomVarCollection,
	};
}

function customVarMap(collection: CustomVarCollection | undefined): IDataObject {
	const vars: IDataObject = {};
	for (const row of collection?.variable ?? []) {
		const name = text(row.name);
		const value = text(row.value);
		if (name !== '' && value !== '') {
			vars[name] = value;
		}
	}
	return vars;
}

function stringList(values: string[] | undefined): string[] {
	return (values ?? []).map((value) => value.trim()).filter((value) => value !== '');
}

function text(value: string | undefined): string {
	return (value ?? '').trim();
}

function setText(body: IDataObject, key: string, value: string | undefined): void {
	const trimmed = text(value);
	if (trimmed !== '') {
		body[key] = trimmed;
	}
}
