import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCafePostbackData,
  parseCafePostbackData
} from './cafePostbackActions.js';

test('round-trips supported cafe postback data', () => {
  const data = createCafePostbackData('reroll', 'session_123');

  assert.equal(data.length <= 300, true);
  assert.deepEqual(parseCafePostbackData(data), {
    action: 'reroll',
    sessionId: 'session_123'
  });
});
test('rejects unsupported or malformed cafe postback data', () => {
  assert.equal(parseCafePostbackData('v=2&a=reroll&s=session_123'), undefined);
  assert.equal(parseCafePostbackData('v=1&a=delete&s=session_123'), undefined);
  assert.equal(parseCafePostbackData('v=1&a=reroll&s=bad/session'), undefined);
});
