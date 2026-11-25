import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { SALESFORGE_API_BASE_URL, SALESFORGE_CREDENTIAL_TYPE } from './constants';

type SalesforgeContext = IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions;

export type SalesforgeResponse<T> = {
	statusCode: number;
	body: T;
};

type FullHttpResponse = {
	body?: unknown;
	statusCode?: number;
	status?: number;
};

// salesforgeApiRequest calls the Salesforge public API with the credential's API key.
// Non-JSON and empty bodies (including HTTP 204) come back as objects instead of throwing.
export async function salesforgeApiRequest<T>(
	context: SalesforgeContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<SalesforgeResponse<T>> {
	const options: IHttpRequestOptions = {
		method,
		url: `${SALESFORGE_API_BASE_URL}${path}`,
		qs,
		json: false,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		arrayFormat: 'brackets',
		headers: {
			Accept: 'application/json',
		},
	};

	if (body !== undefined) {
		options.body = JSON.stringify(body);
		options.headers = {
			...options.headers,
			'Content-Type': 'application/json',
		};
	}

	let response: FullHttpResponse;
	try {
		response = (await context.helpers.httpRequestWithAuthentication.call(
			context,
			SALESFORGE_CREDENTIAL_TYPE,
			options,
		)) as FullHttpResponse;
	} catch (error) {
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}

	return {
		statusCode: response.statusCode ?? response.status ?? 0,
		body: parseResponseBody(response.body) as T,
	};
}

export async function getWorkspaceId(context: SalesforgeContext): Promise<string> {
	const credentials = await context.getCredentials(SALESFORGE_CREDENTIAL_TYPE);
	const workspaceId =
		typeof credentials.workspaceId === 'string' ? credentials.workspaceId.trim() : '';
	if (workspaceId === '') {
		throw new NodeOperationError(
			context.getNode(),
			'Workspace ID is required in the Salesforge API credential.',
		);
	}

	return workspaceId;
}

export function workspacePath(workspaceId: string, suffix: string): string {
	return `/workspaces/${encodeURIComponent(workspaceId)}${suffix}`;
}

type ListBody<T> = {
	data?: T[];
	total?: number;
};

// salesforgeList pages a Salesforge list endpoint and returns the items themselves.
// returnAll walks every page. Otherwise it stops after limit items.
export async function salesforgeList<T>(
	context: SalesforgeContext,
	path: string,
	options: {
		returnAll: boolean;
		limit: number;
		pageSize?: number;
		qs?: IDataObject;
		itemIndex?: number;
	},
): Promise<T[]> {
	const pageSize = options.pageSize ?? 1000;
	const wanted = options.returnAll ? Number.POSITIVE_INFINITY : Math.max(options.limit, 0);
	const collected: T[] = [];
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;

	while (collected.length < wanted && collected.length < total) {
		const response = await salesforgeApiRequest<ListBody<T>>(context, 'GET', path, undefined, {
			...options.qs,
			limit: Math.min(pageSize, wanted - collected.length),
			offset,
		});
		throwForStatus(context, response, options.itemIndex);

		const page = response.body.data ?? [];
		total = response.body.total ?? collected.length + page.length;
		collected.push(...page);
		if (page.length === 0) {
			break;
		}
		offset += page.length;
	}

	return options.returnAll ? collected : collected.slice(0, wanted);
}

// throwForStatus raises a node API error for any non-2xx Salesforge response.
export function throwForStatus(
	context: SalesforgeContext,
	response: SalesforgeResponse<unknown>,
	itemIndex?: number,
): void {
	if (response.statusCode >= 200 && response.statusCode < 300) {
		return;
	}

	const body = asJsonObject(response.body);
	throw new NodeApiError(
		context.getNode(),
		{
			...body,
			message: messageFromBody(response.body, response.statusCode),
			statusCode: response.statusCode,
		},
		itemIndex === undefined ? {} : { itemIndex },
	);
}

function parseResponseBody(body: unknown): unknown {
	if (typeof body !== 'string') {
		return body ?? {};
	}

	const trimmed = body.trim();
	if (trimmed === '') {
		return {};
	}

	try {
		return JSON.parse(trimmed) as unknown;
	} catch {
		return { message: trimmed };
	}
}

function asJsonObject(body: unknown): JsonObject {
	if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
		return body as JsonObject;
	}

	return {};
}

function messageFromBody(body: unknown, statusCode: number): string {
	if (body !== null && typeof body === 'object' && 'message' in body) {
		const message = (body as { message?: unknown }).message;
		if (typeof message === 'string' && message !== '') {
			return message;
		}
	}

	return `Salesforge API returned HTTP ${statusCode}`;
}
