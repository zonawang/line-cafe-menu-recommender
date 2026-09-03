import assert from 'node:assert/strict';
import test from 'node:test';

import { createGoogleCalendarLink } from './calendarLink.js';

test('creates a Google Calendar link for a selected cafe datetime', () => {
  const link = createGoogleCalendarLink({
    cafe: { title: 'Cafe A', uri: 'https://maps.google.com/cafe-a' },
    startTime: '2026-08-17T06:30:00.000Z',
    durationMinutes: 90
  });
  const query = new URL(link).searchParams;
  assert.equal(query.get('text'), '去 Cafe A 喝咖啡');
  assert.equal(query.get('dates'), '20260817T063000Z/20260817T080000Z');
});
