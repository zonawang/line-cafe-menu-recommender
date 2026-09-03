import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCafeDatetimePickerAction,
  createCafeDatetimePickerActionForCafe,
  cafeDatetimeToIso,
  formatCafeDatetime,
  isCafeDatetimePostbackData,
  parseCafeDatetimePickerData
} from './cafeDatetimePickerActions.js';

test('creates a datetime picker action for scheduling cafe time', () => {
  const action = createCafeDatetimePickerAction();

  assert.equal(action.type, 'datetimepicker');
  assert.equal(action.label, '安排喝咖啡時間');
  assert.equal(action.data, 'v=1&a=schedule_cafe');
  assert.equal(action.mode, 'datetime');
  assert.match(action.min ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u);
  assert.match(action.max ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u);
  assert.equal(isCafeDatetimePostbackData(action.data ?? ''), true);
});

test('formats the datetime selected by LINE', () => {
  assert.equal(
    formatCafeDatetime('2026-08-17T14:30'),
    '2026 年 8 月 17 日 14:30'
  );
});

test('binds a datetime picker to a cafe and search session', () => {
  const action = createCafeDatetimePickerActionForCafe('session_123', 2);
  assert.equal(action.data, 'v=2&a=pick_time&s=session_123&c=2');
  assert.deepEqual(parseCafeDatetimePickerData(action.data ?? ''), {
    sessionId: 'session_123',
    cafeNumber: 2
  });
  assert.equal(isCafeDatetimePostbackData(action.data ?? ''), true);
});

test('converts LINE Taipei datetime to an ISO instant', () => {
  assert.equal(cafeDatetimeToIso('2026-08-17T14:30'), '2026-08-17T06:30:00.000Z');
});

test('rejects malformed or impossible datetime values', () => {
  assert.equal(formatCafeDatetime('2026-02-30T14:30'), undefined);
  assert.equal(formatCafeDatetime('2026-08-17T25:00'), undefined);
  assert.equal(formatCafeDatetime('not-a-datetime'), undefined);
});
