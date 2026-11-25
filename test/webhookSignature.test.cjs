const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { describe, it } = require('node:test');

const {
	verifySalesforgeWebhookSignature,
} = require('../dist/nodes/Salesforge/webhookSignature');

const secret = 'whsec_test_secret';
const eventId = 'wh_sent_123';
const timestamp = 1700000000;
const rawBody = Buffer.from('{"webhookInfo":{"type":"email_sent"}}', 'utf8');

function headerFor(body, at = timestamp, event = eventId, key = secret) {
	const signed = Buffer.concat([Buffer.from(`${event}.${at}.`, 'utf8'), body]);
	const signature = createHmac('sha256', key).update(signed).digest('hex');
	return `t=${at},v1=${signature}`;
}

describe('verifySalesforgeWebhookSignature', () => {
	it('accepts a signature over the raw body', () => {
		assert.equal(
			verifySalesforgeWebhookSignature({
				secret,
				eventId,
				signatureHeader: headerFor(rawBody),
				rawBody,
				nowSeconds: timestamp,
			}),
			true,
		);
	});

	it('rejects a body that was re-serialized', () => {
		const spaced = Buffer.from('{ "webhookInfo": { "type": "email_sent" } }', 'utf8');
		assert.equal(
			verifySalesforgeWebhookSignature({
				secret,
				eventId,
				signatureHeader: headerFor(rawBody),
				rawBody: spaced,
				nowSeconds: timestamp,
			}),
			false,
		);
	});

	it('rejects a stale timestamp', () => {
		assert.equal(
			verifySalesforgeWebhookSignature({
				secret,
				eventId,
				signatureHeader: headerFor(rawBody),
				rawBody,
				nowSeconds: timestamp + 5 * 60 + 1,
			}),
			false,
		);
	});

	it('rejects the wrong secret, event id, or signature', () => {
		assert.equal(
			verifySalesforgeWebhookSignature({
				secret: 'whsec_other',
				eventId,
				signatureHeader: headerFor(rawBody),
				rawBody,
				nowSeconds: timestamp,
			}),
			false,
		);
		assert.equal(
			verifySalesforgeWebhookSignature({
				secret,
				eventId: 'wh_other',
				signatureHeader: headerFor(rawBody),
				rawBody,
				nowSeconds: timestamp,
			}),
			false,
		);
		assert.equal(
			verifySalesforgeWebhookSignature({
				secret,
				eventId,
				signatureHeader: 't=1700000000,v1=abcd',
				rawBody,
				nowSeconds: timestamp,
			}),
			false,
		);
	});
});
