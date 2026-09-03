import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWishlistAddData,
  createWishlistDatetimePickerAction,
  createWishlistRemoveData,
  parseWishlistDatetimePickerData,
  parseWishlistPostbackData
} from './wishlistActions.js';

test('round-trips wishlist add and remove postbacks', () => {
  assert.deepEqual(
    parseWishlistPostbackData(createWishlistAddData('session_123', 2)),
    { action: 'add', sessionId: 'session_123', cafeNumber: 2 }
  );
  assert.deepEqual(
    parseWishlistPostbackData(createWishlistRemoveData('wishlist_123')),
    { action: 'remove', wishlistItemId: 'wishlist_123' }
  );
});

test('rejects malformed wishlist postbacks', () => {
  assert.equal(parseWishlistPostbackData('v=1&wa=add&s=bad/session&c=1'), undefined);
  assert.equal(parseWishlistPostbackData('v=1&wa=add&s=session&c=6'), undefined);
  assert.equal(parseWishlistPostbackData('v=1&wa=remove&w=bad/item'), undefined);
  assert.equal(parseWishlistPostbackData('v=2&wa=remove&w=item'), undefined);
});

test('creates and parses a wishlist datetime picker', () => {
  const action = createWishlistDatetimePickerAction('wishlist_123');
  assert.equal(action.type, 'datetimepicker');
  assert.equal(action.mode, 'datetime');
  assert.equal(typeof action.data, 'string');
  if (!action.data) return;
  assert.deepEqual(parseWishlistDatetimePickerData(action.data), {
    wishlistItemId: 'wishlist_123'
  });
  assert.equal(parseWishlistDatetimePickerData('v=1&wa=schedule&w=bad/item'), undefined);
});

test('keeps wishlist postback data within LINE limits', () => {
  assert.equal(createWishlistAddData('s'.repeat(128), 5).length <= 300, true);
  assert.equal(createWishlistRemoveData('w'.repeat(128)).length <= 300, true);
});
