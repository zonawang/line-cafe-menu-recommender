import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINE_CHANNEL_SECRET = 'test-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

const { wishlistStoreInternals } = await import('./wishlistStore.js');

test('uses a stable safe ID for the same Google Maps cafe', () => {
  const first = wishlistStoreInternals.itemId({
    title: 'Cafe A',
    uri: 'https://maps.google.com/cafe-a'
  });
  const renamed = wishlistStoreInternals.itemId({
    title: 'Cafe A Renamed',
    uri: 'https://maps.google.com/cafe-a'
  });
  assert.equal(first, renamed);
  assert.match(first, /^[A-Za-z0-9_-]{32}$/u);
});
