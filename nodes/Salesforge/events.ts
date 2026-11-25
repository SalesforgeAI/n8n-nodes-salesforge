import type { INodePropertyOptions } from 'n8n-workflow';

/** One Salesforge webhook subscribes to exactly one of these event types. */
export const salesforgeEvents: INodePropertyOptions[] = [
	{
		name: 'Contact Unsubscribed',
		value: 'contact_unsubscribed',
		description: 'A contact unsubscribes',
	},
	{
		name: 'Email Bounced',
		value: 'email_bounced',
		description: 'A sequence email bounces',
	},
	{
		name: 'Email Opened',
		value: 'email_opened',
		description: 'A contact opens a sequence email',
	},
	{
		name: 'Email Replied',
		value: 'email_replied',
		description: 'A contact replies to a sequence email',
	},
	{
		name: 'Email Sent',
		value: 'email_sent',
		description: 'A sequence email is sent',
	},
	{
		name: 'Label Changed',
		value: 'label_changed',
		description: 'A thread label changes',
	},
	{
		name: 'Link Clicked',
		value: 'link_clicked',
		description: 'A contact clicks a link in a sequence email',
	},
	{
		name: 'LinkedIn Reply',
		value: 'linkedin_replied',
		description: 'A contact replies on LinkedIn',
	},
	{
		name: 'Negative Reply',
		value: 'negative_reply',
		description: 'A reply is marked as negative',
	},
	{
		name: 'Positive Reply',
		value: 'positive_reply',
		description: 'A reply is marked as positive',
	},
];
