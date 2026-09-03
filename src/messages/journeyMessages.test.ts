import assert from 'node:assert/strict';
import test from 'node:test';

import type { CafeJourney } from '../services/journeyStore.js';
import {
  createJourneyCompletedMessage,
  createJourneyHistoryMessages,
  createJourneyRatingMessage,
  createJourneyTagMessage
} from './journeyMessages.js';

const journey: CafeJourney = {
  id: 'journey_123',
  ownerId: 'user_123',
  conversationId: 'user_123',
  cafeTitle: '測試咖啡',
  cafeUri: 'https://maps.google.com/test',
  rating: 5,
  tags: ['quiet', 'work'],
  status: 'completed',
  createdAtMs: Date.parse('2026-08-26T01:00:00Z'),
  completedAtMs: Date.parse('2026-08-26T02:00:00Z')
};

test('creates five rating actions', () => {
  const message = createJourneyRatingMessage({ ...journey, rating: undefined, status: 'draft' });
  assert.equal(message.quickReply?.items?.length, 5);
  assert.equal(message.quickReply?.items?.every((item) => item.action?.type === 'postback'), true);
});

test('keeps tag actions available until the user completes the record', () => {
  const message = createJourneyTagMessage({ ...journey, status: 'draft' });
  assert.equal(message.text.includes('安靜、適合工作'), true);
  assert.equal(message.quickReply?.items?.length, 5);
  assert.equal(message.quickReply?.items?.at(-1)?.action?.label, '完成紀錄');
});

test('creates completed and history messages', () => {
  assert.equal(createJourneyCompletedMessage(journey).text.includes('已收進你的咖啡足跡'), true);
  const history = createJourneyHistoryMessages([journey]);
  assert.equal(history[0]?.type, 'flex');
});

test('offers location sharing when history is empty', () => {
  const history = createJourneyHistoryMessages([]);
  assert.equal(history[0]?.type, 'text');
  if (history[0]?.type !== 'text') return;
  assert.equal(history[0].quickReply?.items?.[0]?.action?.type, 'location');
});
