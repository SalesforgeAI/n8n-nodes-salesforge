export const SALESFORGE_API_BASE_URL = 'https://api.salesforge.ai/public/v2';

export const SALESFORGE_CREDENTIAL_TYPE = 'salesforgeApi';

/** Deliveries older than this are rejected, which limits replay of a captured payload. */
export const WEBHOOK_SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

export const WEBHOOK_SIGNATURE_HEADER = 'x-salesforgeai-webhook-signature';

export const WEBHOOK_EVENT_ID_HEADER = 'x-salesforgeai-webhook-event-id';
