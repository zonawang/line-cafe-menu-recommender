import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWishlistMessages,
  createWishlistRemovedMessage,
  createWishlistSavedMessage
} from './wishlistMessages.js';

const item = {
  id: 'wishlist_123',
  ownerId: 'user_123',
  cafe: { title: 'Cafe A', uri: 'https://maps.google.com/cafe-a' },
  createdAtMs: Date.parse('2026-09-01T01:00:00Z')
};

test('creates wishlist saved and already-saved confirmations', () => {
  assert.match(createWishlistSavedMessage('Cafe A', true).text, /已把.*加入/);
  assert.match(createWishlistSavedMessage('Cafe A', false).text, /已經在/);
});

test('creates wishlist cards with map, schedule, and remove actions', () => {
  const messages = createWishlistMessages([item]);
  const flex = messages[0];
  assert.equal(flex?.type, 'flex');
  if (flex?.type !== 'flex' || flex.contents.type !== 'carousel') return;
  const bubble = flex.contents.contents[0];
  assert.equal(bubble?.type, 'bubble');
  if (bubble?.type !== 'bubble' || bubble.footer?.type !== 'box') return;
  assert.deepEqual(
    bubble.footer.contents.flatMap((content) =>
      content.type === 'button' ? [content.action.label] : []
    ),
    ['在 Google Maps 查看', '安排喝咖啡時間', '移出想去清單']
  );
});

test('offers location sharing when wishlist is empty', () => {
  const messages = createWishlistMessages([]);
  assert.equal(messages[0]?.type, 'text');
  if (messages[0]?.type !== 'text') return;
  assert.deepEqual(
    (messages[0].quickReply?.items ?? []).flatMap((quickItem) =>
      quickItem.action ? [quickItem.action.type] : []
    ),
    ['location']
  );
});

test('creates a removed confirmation', () => {
  assert.match(createWishlistRemovedMessage('Cafe A').text, /移出想去清單/);
});
