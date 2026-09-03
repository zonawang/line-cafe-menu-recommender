import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createJourneyDoneData,
  createJourneyRatingData,
  createJourneyTagData,
  createJourneyVisitData,
  parseJourneyPostbackData
} from './journeyPostbackActions.js';

test('round-trips every journey postback action', () => {
  assert.deepEqual(parseJourneyPostbackData(createJourneyVisitData('session_123', 2)), {
    action: 'visit', sessionId: 'session_123', cafeNumber: 2
  });
  assert.deepEqual(parseJourneyPostbackData(createJourneyRatingData('journey_123', 5)), {
    action: 'rate', journeyId: 'journey_123', rating: 5
  });
  assert.deepEqual(parseJourneyPostbackData(createJourneyTagData('journey_123', 'quiet')), {
    action: 'tag', journeyId: 'journey_123', tag: 'quiet'
  });
  assert.deepEqual(parseJourneyPostbackData(createJourneyDoneData('journey_123')), {
    action: 'done', journeyId: 'journey_123'
  });
});

test('rejects malformed journey postback data', () => {
  assert.equal(parseJourneyPostbackData('v=1&a=visit&s=bad/session&c=1'), undefined);
  assert.equal(parseJourneyPostbackData('v=1&a=visit&s=session&c=9'), undefined);
  assert.equal(parseJourneyPostbackData('v=1&a=rate&j=journey&r=0'), undefined);
  assert.equal(parseJourneyPostbackData('v=1&a=tag&j=journey&t=unknown'), undefined);
  assert.equal(parseJourneyPostbackData('v=2&a=done&j=journey'), undefined);
});

test('keeps LINE postback data within the 300 character limit', () => {
  assert.equal(createJourneyVisitData('s'.repeat(128), 5).length <= 300, true);
  assert.equal(createJourneyTagData('j'.repeat(128), 'work').length <= 300, true);
});
