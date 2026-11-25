const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { buildContactBody, ContactInputError } = require('../dist/nodes/Salesforge/operations');

describe('buildContactBody', () => {
	it('keeps the fields the API accepts and drops empty ones', () => {
		assert.deepEqual(
			buildContactBody(
				{
					firstName: ' Ada ',
					lastName: ' Lovelace ',
					email: ' ada@example.com ',
					linkedinUrl: '',
					company: 'Analytical Engines',
					position: '',
					tags: [' outbound ', ''],
					tagIds: [],
					customVars: { variable: [{ name: ' city ', value: ' London ' }, { name: '', value: 'x' }] },
				},
				false,
			),
			{
				firstName: 'Ada',
				lastName: 'Lovelace',
				email: 'ada@example.com',
				company: 'Analytical Engines',
				tags: ['outbound'],
				customVars: { city: 'London' },
			},
		);
	});

	it('requires an email or a LinkedIn URL', () => {
		assert.throws(
			() => buildContactBody({ firstName: 'Ada' }, false),
			ContactInputError,
		);
	});

	it('requires a tag when creating many contacts', () => {
		assert.throws(
			() => buildContactBody({ firstName: 'Ada', email: 'ada@example.com' }, true),
			ContactInputError,
		);
	});
});
