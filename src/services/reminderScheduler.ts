import { CloudTasksClient, protos } from '@google-cloud/tasks';

import { env } from '../utils/env.js';
import {
  attachReminderTask,
  createPlannedVisit,
  deleteUnscheduledPlannedVisit,
  type PlannedVisit
} from './plannedVisitStore.js';
import type { CafeSearchSource } from './searchSessionStore.js';

const tasksClient = new CloudTasksClient();

function assertReminderConfig(): void {
  if (!env.REMINDER_CALLBACK_URL || !/^https:\/\//u.test(env.REMINDER_CALLBACK_URL)) {
    throw new Error('REMINDER_CALLBACK_URL must be an HTTPS URL');
  }
  if (env.REMINDER_TASK_SECRET.length < 24) {
    throw new Error('REMINDER_TASK_SECRET must contain at least 24 characters');
  }
}

export function calculateReminderTime(scheduledAtMs: number): number {
  return scheduledAtMs + env.FOLLOW_UP_DELAY_MINUTES * 60_000;
}

export function buildReminderTask(
  visit: PlannedVisit
): protos.google.cloud.tasks.v2.ITask {
  assertReminderConfig();
  const taskName = tasksClient.taskPath(
    env.GOOGLE_CLOUD_PROJECT,
    env.CLOUD_TASKS_LOCATION,
    env.CLOUD_TASKS_QUEUE,
    `visit-${visit.id}`
  );
  return {
    name: taskName,
    scheduleTime: {
      seconds: Math.floor(visit.remindAtMs / 1000)
    },
    httpRequest: {
      httpMethod: 'POST',
      url: env.REMINDER_CALLBACK_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-Cafe-Reminder-Secret': env.REMINDER_TASK_SECRET
      },
      body: Buffer.from(JSON.stringify({ plannedVisitId: visit.id })).toString('base64')
    }
  };
}

export async function enqueueReminder(visit: PlannedVisit): Promise<string> {
  const parent = tasksClient.queuePath(
    env.GOOGLE_CLOUD_PROJECT,
    env.CLOUD_TASKS_LOCATION,
    env.CLOUD_TASKS_QUEUE
  );
  const task = buildReminderTask(visit);
  try {
    const [created] = await tasksClient.createTask({ parent, task });
    return created.name ?? task.name ?? '';
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 6) {
      return task.name ?? '';
    }
    throw error;
  }
}

export async function scheduleCafeFollowUp(input: {
  ownerId: string;
  conversationId: string;
  cafe: CafeSearchSource;
  scheduledAtMs: number;
}): Promise<PlannedVisit> {
  const visit = await createPlannedVisit({
    ...input,
    remindAtMs: calculateReminderTime(input.scheduledAtMs)
  });

  try {
    const taskName = await enqueueReminder(visit);
    await attachReminderTask(visit.id, taskName);
    return { ...visit, taskName };
  } catch (error) {
    await deleteUnscheduledPlannedVisit(visit.id);
    throw error;
  }
}

export function formatFollowUpDateTime(valueMs: number): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(valueMs);
}
