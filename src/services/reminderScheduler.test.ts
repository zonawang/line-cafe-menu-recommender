import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINE_CHANNEL_SECRET = 'test-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
process.env.CLOUD_TASKS_LOCATION = 'asia-east1';
process.env.CLOUD_TASKS_QUEUE = 'test-reminders';
process.env.REMINDER_CALLBACK_URL = 'https://example.run.app/tasks/visit-reminders';
process.env.REMINDER_TASK_SECRET = 'a-test-secret-with-more-than-24-characters';
process.env.FOLLOW_UP_DELAY_MINUTES = '60';

const {
  buildReminderTask,
  calculateReminderTime,
  formatFollowUpDateTime
} = await import('./reminderScheduler.js');

test('schedules follow-up after the configured visit duration', () => {
  const scheduledAt = Date.parse('2026-08-29T06:00:00.000Z');
  assert.equal(calculateReminderTime(scheduledAt), Date.parse('2026-08-29T07:00:00.000Z'));
  assert.match(formatFollowUpDateTime(scheduledAt), /2026/u);
});

test('builds a deterministic authenticated Cloud Task', () => {
  const task = buildReminderTask({
    id: 'visit_123',
    ownerId: 'user_1',
    conversationId: 'user_1',
    cafe: { title: 'Zona Cafe', uri: 'https://maps.google.com/zona' },
    scheduledAtMs: Date.parse('2026-08-29T06:00:00.000Z'),
    remindAtMs: Date.parse('2026-08-29T08:00:00.000Z'),
    status: 'scheduled'
  });

  assert.match(task.name ?? '', /visit-visit_123$/u);
  assert.equal(task.httpRequest?.url, process.env.REMINDER_CALLBACK_URL);
  assert.equal(
    task.httpRequest?.headers?.['X-Cafe-Reminder-Secret'],
    process.env.REMINDER_TASK_SECRET
  );
  const body = Buffer.from(String(task.httpRequest?.body), 'base64').toString('utf8');
  assert.deepEqual(JSON.parse(body), { plannedVisitId: 'visit_123' });
});
