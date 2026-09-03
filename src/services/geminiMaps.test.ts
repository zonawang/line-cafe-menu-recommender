import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINE_CHANNEL_SECRET = 'test-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

const { geminiMapsInternals } = await import('./geminiMaps.js');

test('collectSources deduplicates Google Maps URLs', () => {
  const response = {
    candidates: [
      {
        groundingMetadata: {
          groundingChunks: [
            {
              maps: {
                title: 'Review of Cafe A - Google Maps',
                uri: 'https://maps.google.com/review-a',
                placeId: 'places/cafe-a'
              }
            },
            {
              maps: {
                title: 'Cafe A - Google Maps',
                uri: 'https://maps.google.com/place-a',
                placeId: 'places/cafe-a'
              }
            },
            {
              maps: {
                title: 'Cafe without URL'
              }
            }
          ]
        }
      }
    ]
  } as Parameters<typeof geminiMapsInternals.collectSources>[0];

  assert.deepEqual(geminiMapsInternals.collectSources(response), [
    {
      title: 'Cafe A',
      uri: 'https://maps.google.com/place-a'
    }
  ]);
});
