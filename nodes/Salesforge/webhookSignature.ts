import { createHmac, timingSafeEqual } from 'node:crypto';

import { WEBHOOK_SIGNATURE_MAX_AGE_SECONDS } from './constants';

export type SalesforgeSignatureInput = {
	secret: string;
	eventId: string;
	signatureHeader: string;
	rawBody: Buffer;
	nowSeconds?: number;
};

// verifySalesforgeWebhookSignature checks the Stripe-style signature Salesforge
// sends on X-SalesforgeAI-Webhook-Signature. The signed bytes are
// `{eventId}.{timestamp}.{rawBody}`.
export function verifySalesforgeWebhookSignature(input: SalesforgeSignatureInput): boolean {
	const { secret, eventId, signatureHeader, rawBody } = input;
	if (secret === '' || eventId === '' || signatureHeader === '') {
		return false;
	}

	const parsed = parseSignatureHeader(signatureHeader);
	if (parsed === undefined) {
		return false;
	}

	const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
	if (Math.abs(nowSeconds - parsed.timestamp) > WEBHOOK_SIGNATURE_MAX_AGE_SECONDS) {
		return false;
	}

	const prefix = Buffer.from(`${eventId}.${parsed.timestamp}.`, 'utf8');
	const expected = createHmac('sha256', secret)
		.update(Buffer.concat([prefix, rawBody]))
		.digest('hex');

	const expectedBuffer = Buffer.from(expected, 'utf8');
	const providedBuffer = Buffer.from(parsed.signature, 'utf8');
	if (expectedBuffer.length !== providedBuffer.length) {
		return false;
	}

	return timingSafeEqual(expectedBuffer, providedBuffer);
}

function parseSignatureHeader(
	header: string,
): { timestamp: number; signature: string } | undefined {
	let timestamp: number | undefined;
	let signature: string | undefined;

	for (const part of header.split(',')) {
		const separator = part.indexOf('=');
		if (separator === -1) {
			continue;
		}

		const key = part.slice(0, separator).trim();
		const value = part.slice(separator + 1).trim();
		if (key === 't') {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				timestamp = parsed;
			}
		}
		if (key === 'v1' && /^[0-9a-f]{64}$/.test(value)) {
			signature = value;
		}
	}

	if (timestamp === undefined || signature === undefined) {
		return undefined;
	}

	return { timestamp, signature };
}
