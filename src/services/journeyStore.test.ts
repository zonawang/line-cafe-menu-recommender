import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINE_CHANNEL_SECRET = 'test-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

const { deriveJourneyRecommendationProfile } = await import('./journeyStore.js');
type CafeJourney = import('./journeyStore.js').CafeJourney;

function journey(input: Partial<CafeJourney> & Pick<CafeJourney, 'cafeTitle' | 'rating'>): CafeJourney {
  return {
    id: input.id ?? input.cafeTitle,
    ownerId: 'user',
    conversationId: 'user',
    cafeTitle: input.cafeTitle,
    cafeUri: 'https://maps.google.com/test',
    rating: input.rating,
    tags: input.tags ?? [],
    status: 'completed',
    createdAtMs: input.createdAtMs ?? 1,
    completedAtMs: input.completedAtMs ?? 1
  };
}

test('derives soft preferences from highly rated visit tags', () => {
  const profile = deriveJourneyRecommendationProfile([
    journey({ cafeTitle: 'Cafe A', rating: 5, tags: ['quiet', 'outlets', 'revisit'] }),
    journey({ cafeTitle: 'Cafe B', rating: 4, tags: ['work'] })
  ]);
  assert.deepEqual(profile.preferences, ['quiet', 'outlets', 'work_friendly']);
  assert.deepEqual(profile.avoidCafeNames, []);
});

test('avoids low-rated cafes using only the latest visit to each cafe', () => {
  const profile = deriveJourneyRecommendationProfile([
    journey({ cafeTitle: 'Cafe A', rating: 5, tags: ['quiet'], completedAtMs: 3 }),
    journey({ cafeTitle: 'Cafe A', rating: 1, completedAtMs: 2 }),
    journey({ cafeTitle: 'Cafe B', rating: 2, completedAtMs: 1 })
  ]);
  assert.deepEqual(profile.preferences, ['quiet']);
  assert.deepEqual(profile.avoidCafeNames, ['Cafe B']);
});
