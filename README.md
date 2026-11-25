# n8n-nodes-salesforge

This is an n8n community node. It lets you use [Salesforge](https://www.salesforge.ai) in your n8n workflows.

Salesforge sends outbound sales sequences. This node starts a workflow when a sequence event happens, creates contacts, and updates Primebox labels.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/n8n-community-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Install the package `n8n-nodes-salesforge`.

## Operations

**Salesforge Trigger**

The trigger listens for one event. Add another Salesforge Trigger for each additional event. The events are:

- Contact Unsubscribed
- Email Bounced
- Email Opened
- Email Replied
- Email Sent
- Label Changed
- Link Clicked
- LinkedIn Reply
- Negative Reply
- Positive Reply

Leave Sequence ID empty to receive events for the whole workspace. Set it to receive events for one sequence.

Activating the workflow creates the Salesforge webhook. Deactivating the workflow deletes it. Turn the workflow off and on again after changing the event or sequence.

**Salesforge**

- Contact: Create one contact, or Create Many (1 to 100 contacts in one request). Each contact needs a first name and an email or LinkedIn URL. Create Many also needs a tag on every contact.
- Label: Get Many Primebox labels.
- Sequence: Get Many, and Add Contacts. Add Contacts works for legacy and multichannel sequences.
- Thread: Get Many, and Update Label. Update Label works for email threads and LinkedIn-only threads.

## Credentials

You need a Salesforge API key and a workspace ID.

1. In Salesforge, open Settings → Integrations → n8n and create an API key. A key from Settings → API works as well.
2. Copy the workspace ID from the workspace settings or from the workspace URL.
3. In n8n, create a Salesforge API credential and paste both values.

The credential test requests that workspace. The API key is sent as the `Authorization` header.

## Compatibility

Tested against the Salesforge public API at `https://api.salesforge.ai/public/v2`.

Self-hosted n8n must expose a public webhook URL. Set the `WEBHOOK_URL` environment variable to a URL Salesforge can reach. n8n Cloud already has a public webhook URL.

## Usage

**Notify Slack of a positive reply**

1. Add a Salesforge Trigger.
2. Set Event to Positive Reply.
3. Connect the trigger to a Slack node and map the contact and sequence fields from the webhook payload.

The payload includes `webhookInfo`, `contact`, `sequence`, `mailbox`, and the event data.

**Label a thread after a reply**

1. Add a Salesforge Trigger and set Event to Email Replied.
2. Add a Salesforge node.
3. Set Resource to Thread and Operation to Update Label.
4. Set Thread ID to the thread id from the trigger output, and choose a label.

Each delivery is signed. The node checks `X-SalesforgeAI-Webhook-Signature` before the workflow runs. A delivery with a missing or invalid signature does not start the workflow.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [Salesforge API](https://help.salesforge.ai/en/articles/10333607-salesforge-api)
* [Salesforge webhooks](https://help.salesforge.ai/en/articles/8680365-how-to-use-webhooks)
