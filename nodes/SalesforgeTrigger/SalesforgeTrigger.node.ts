import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { getWorkspaceId, salesforgeApiRequest, throwForStatus, workspacePath } from '../Salesforge/api';
import { WEBHOOK_EVENT_ID_HEADER, WEBHOOK_SIGNATURE_HEADER } from '../Salesforge/constants';
import { salesforgeEvents } from '../Salesforge/events';
import { verifySalesforgeWebhookSignature } from '../Salesforge/webhookSignature';

type RegisteredWebhook = {
	id?: string;
	url?: string;
	type?: string;
	sequenceId?: string | null;
	sequenceIds?: string[];
	signingSecret?: string;
};

type WebhookStaticData = IDataObject & {
	webhookId?: string;
	signingSecret?: string;
};

// SalesforgeTrigger is programmatic because declarative nodes cannot register
// or remove a remote webhook when a workflow is activated and deactivated.
export class SalesforgeTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Salesforge Trigger',
		name: 'salesforgeTrigger',
		icon: { light: 'file:../Salesforge/salesforge.svg', dark: 'file:../Salesforge/salesforge.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a Salesforge sequence event happens',
		defaults: {
			name: 'Salesforge Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'salesforgeApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: salesforgeEvents,
				default: 'email_sent',
				description:
					'Event that starts this workflow. A Salesforge webhook receives one event type, so add another Salesforge Trigger for each additional event. Turn the workflow off and on again after changing this.',
			},
			{
				displayName: 'Sequence ID',
				name: 'sequenceId',
				type: 'string',
				default: '',
				description:
					'Receive events for this sequence only. Leave empty to receive events for every sequence in the workspace. Turn the workflow off and on again after changing this.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = webhookStaticData(this);
				const webhookId = staticData.webhookId;
				const signingSecret = staticData.signingSecret;
				if (!webhookId || !signingSecret) {
					return false;
				}

				const workspaceId = await getWorkspaceId(this);
				const response = await salesforgeApiRequest<RegisteredWebhook>(
					this,
					'GET',
					workspacePath(workspaceId, `/integrations/webhooks/${encodeURIComponent(webhookId)}`),
				);
				if (response.statusCode === 404) {
					clearWebhookStaticData(staticData);
					return false;
				}
				throwForStatus(this, response);

				const webhookUrl = requiredWebhookUrl(this);
				if (!webhookMatches(response.body, webhookUrl, selectedEvent(this), selectedSequenceId(this))) {
					return false;
				}

				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				await deleteStoredWebhook.call(this);

				const workspaceId = await getWorkspaceId(this);
				const event = selectedEvent(this);
				const sequenceId = selectedSequenceId(this);
				const webhookUrl = requiredWebhookUrl(this);
				const workflowName = this.getWorkflow().name || 'workflow';

				const body: IDataObject = {
					name: `n8n: ${workflowName} / ${event}`.slice(0, 200),
					type: event,
					url: webhookUrl,
				};
				if (sequenceId !== '') {
					body.sequenceIds = [sequenceId];
				}

				const response = await salesforgeApiRequest<RegisteredWebhook>(
					this,
					'POST',
					workspacePath(workspaceId, '/integrations/webhooks'),
					body,
				);
				throwForStatus(this, response);

				const webhookId = response.body.id;
				const signingSecret = response.body.signingSecret;
				if (!webhookId || !signingSecret) {
					throw new NodeApiError(this.getNode(), {
						message: 'Salesforge did not return a webhook id and signing secret.',
					} as JsonObject);
				}

				const staticData = webhookStaticData(this);
				staticData.webhookId = webhookId;
				staticData.signingSecret = signingSecret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				await deleteStoredWebhook.call(this);
				clearWebhookStaticData(webhookStaticData(this));
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const signingSecret = webhookStaticData(this).signingSecret;
		if (!signingSecret) {
			throw new NodeOperationError(
				this.getNode(),
				'Salesforge webhook signing secret is missing. Turn the workflow off and on again to register it.',
			);
		}

		const request = this.getRequestObject();
		const eventId = request.header(WEBHOOK_EVENT_ID_HEADER) ?? '';
		const signatureHeader = request.header(WEBHOOK_SIGNATURE_HEADER) ?? '';
		const rawBody = request.rawBody;
		const valid =
			Buffer.isBuffer(rawBody) &&
			verifySalesforgeWebhookSignature({
				secret: signingSecret,
				eventId,
				signatureHeader,
				rawBody,
			});
		if (!valid) {
			throw new NodeOperationError(this.getNode(), 'Salesforge webhook signature is invalid.');
		}

		return {
			workflowData: [this.helpers.returnJsonArray(this.getBodyData())],
		};
	}
}

function webhookStaticData(context: IHookFunctions | IWebhookFunctions): WebhookStaticData {
	return context.getWorkflowStaticData('node') as WebhookStaticData;
}

function selectedEvent(context: IHookFunctions): string {
	return context.getNodeParameter('event') as string;
}

function selectedSequenceId(context: IHookFunctions): string {
	const sequenceId = context.getNodeParameter('sequenceId', '') as string;
	return sequenceId.trim();
}

function requiredWebhookUrl(context: IHookFunctions): string {
	const webhookUrl = context.getNodeWebhookUrl('default');
	if (!webhookUrl) {
		throw new NodeOperationError(
			context.getNode(),
			'Salesforge needs a public webhook URL. On self-hosted n8n, set WEBHOOK_URL to a URL Salesforge can reach.',
		);
	}

	return webhookUrl;
}

function webhookMatches(
	webhook: RegisteredWebhook,
	webhookUrl: string,
	event: string,
	sequenceId: string,
): boolean {
	if (webhook.url !== webhookUrl || webhook.type !== event) {
		return false;
	}

	const sequenceIds =
		webhook.sequenceIds && webhook.sequenceIds.length > 0
			? webhook.sequenceIds
			: webhook.sequenceId
				? [webhook.sequenceId]
				: [];
	if (sequenceId === '') {
		return sequenceIds.length === 0;
	}

	return sequenceIds.length === 1 && sequenceIds[0] === sequenceId;
}

async function deleteStoredWebhook(this: IHookFunctions): Promise<void> {
	const webhookId = webhookStaticData(this).webhookId;
	if (!webhookId) {
		return;
	}

	const workspaceId = await getWorkspaceId(this);
	const response = await salesforgeApiRequest(
		this,
		'DELETE',
		workspacePath(workspaceId, `/integrations/webhooks/${encodeURIComponent(webhookId)}`),
	);
	if (response.statusCode === 404) {
		return;
	}
	throwForStatus(this, response);
}

function clearWebhookStaticData(staticData: WebhookStaticData): void {
	delete staticData.webhookId;
	delete staticData.signingSecret;
}
