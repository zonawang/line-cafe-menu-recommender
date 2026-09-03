import assert from 'node:assert/strict';
import test from 'node:test';

import { createPreferencePostbackData, parsePreferencePostbackData } from './preferencePostbackActions.js';

test('preference postback data round-trips', () => {
  const data = createPreferencePostbackData('confirm', 'abc123');
  assert.deepEqual(parsePreferencePostbackData(data), { action: 'confirm', id: 'abc123' });
});

test('preference postback rejects unsafe ids', () => {
  assert.equal(parsePreferencePostbackData('v=1&a=preference_confirm&id=a%2Fb'), undefined);
});
