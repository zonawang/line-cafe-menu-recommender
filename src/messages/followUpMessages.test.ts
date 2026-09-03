import assert from 'node:assert/strict';
import test from 'node:test';

import { createFollowUpReminderMessage } from './followUpMessages.js';

test('creates a reminder with rate and skip actions', () => {
  const message = createFollowUpReminderMessage({
    id: 'visit_123',
    ownerId: 'user_1',
    conversationId: 'user_1',
    cafe: { title: 'Zona Cafe', uri: 'https://maps.google.com/zona' },
    scheduledAtMs: Date.parse('2026-08-29T06:00:00.000Z'),
    remindAtMs: Date.parse('2026-08-29T08:00:00.000Z'),
    status: 'reminded'
  });

  assert.match(message.text, /Zona Cafe/u);
  assert.deepEqual(
    (message.quickReply?.items ?? []).flatMap((item) => item.action ? [item.action.label] : []),
    ['開始評分', '這次沒去']
  );
});
