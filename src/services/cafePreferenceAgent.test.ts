import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINE_CHANNEL_SECRET = 'test';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

const { cafePreferenceAgentInternals } = await import('./cafePreferenceAgent.js');

test('parses a set-preferences function call', () => {
  assert.deepEqual(
    cafePreferenceAgentInternals.parseDecision([
      { name: 'set_cafe_preferences', args: { preferences: ['quiet', 'outlets', 'quiet'] } }
    ], ''),
    { name: 'set', preferences: ['quiet', 'outlets'] }
  );
});

test('falls back when a preference call has unknown values', () => {
  assert.deepEqual(
    cafePreferenceAgentInternals.parseDecision([
      { name: 'remove_cafe_preferences', args: { preferences: ['unknown'] } }
    ], ''),
    { name: 'none', reply: '你可以說「設定我的偏好：安靜、有插座」，或說「查看我的偏好」。' }
  );
});
