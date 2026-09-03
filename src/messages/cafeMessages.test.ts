import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCafeDatetimeResultMessage,
  createCafeResultMessages
} from './cafeMessages.js';

const result = {
  summary: '測試推薦',
  sources: [
    {
      title: 'Cafe A',
      uri: 'https://maps.google.com/cafe-a'
    }
  ]
};

test('adds postback actions when a search session is available', () => {
  const messages = createCafeResultMessages(result, 'session_123');
  const flex = messages[1];

  assert.equal(flex?.type, 'flex');
  if (flex?.type !== 'flex') return;

  assert.deepEqual(
    (flex.quickReply?.items ?? []).flatMap((item) =>
      item.action ? [item.action.type] : []
    ),
    ['postback', 'postback', 'location']
  );
});

test('adds datetime, journey, and wishlist buttons to each cafe card', () => {
  const messages = createCafeResultMessages(result, 'session_123');
  const flex = messages[1];
  assert.equal(flex?.type, 'flex');
  if (flex?.type !== 'flex' || flex.contents.type !== 'carousel') return;
  const bubble = flex.contents.contents[0];
  assert.equal(bubble?.type, 'bubble');
  if (bubble?.type !== 'bubble' || !bubble.footer || bubble.footer.type !== 'box') return;
  assert.deepEqual(
    bubble.footer.contents.flatMap((content) =>
      content.type === 'button' ? [content.action.label] : []
    ),
    ['在 Google Maps 查看', '安排喝咖啡時間', '記錄這次造訪', '加入想去清單']
  );
});

test('still offers datetime and location actions when session storage is unavailable', () => {
  const messages = createCafeResultMessages(result);
  const flex = messages[1];

  assert.equal(flex?.type, 'flex');
  if (flex?.type !== 'flex') return;

  assert.deepEqual(
    (flex.quickReply?.items ?? []).flatMap((item) =>
      item.action ? [item.action.type] : []
    ),
    ['datetimepicker', 'location']
  );
});

test('confirms the selected cafe datetime and allows choosing again', () => {
  const message = createCafeDatetimeResultMessage(
    '2026 年 8 月 17 日 14:30'
  );

  assert.equal(message.text, '☕ 已安排「這間咖啡廳」的時間：\n2026 年 8 月 17 日 14:30');
  assert.deepEqual(
    (message.quickReply?.items ?? []).flatMap((item) =>
      item.action ? [item.action.type] : []
    ),
    ['datetimepicker', 'location']
  );
});
