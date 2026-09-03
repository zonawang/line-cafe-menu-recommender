import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFollowUpPostbackData,
  parseFollowUpPostbackData
} from './followUpPostbackActions.js';

test('creates and parses follow-up postback data', () => {
  const data = createFollowUpPostbackData('rate', 'visit_123');
  assert.deepEqual(parseFollowUpPostbackData(data), {
    action: 'rate',
    plannedVisitId: 'visit_123'
  });
  assert.ok(data.length <= 300);
});

test('rejects unknown actions and unsafe IDs', () => {
  assert.equal(parseFollowUpPostbackData('v=1&a=followup_delete&p=visit_123'), undefined);
  assert.equal(parseFollowUpPostbackData('v=1&a=followup_rate&p=../visit'), undefined);
  assert.throws(() => createFollowUpPostbackData('skip', '../visit'));
});
