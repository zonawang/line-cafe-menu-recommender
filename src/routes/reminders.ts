import { timingSafeEqual } from 'node:crypto';

import express, { Router, type NextFunction, type Request, type Response } from 'express';

import { createFollowUpReminderMessage } from '../messages/followUpMessages.js';
import { lineClient } from '../services/lineClient.js';
import {
  claimReminderDelivery,
  completeReminderDelivery,
  PlannedVisitError,
  releaseReminderDelivery
} from '../services/plannedVisitStore.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

const router = Router();
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

export function reminderSecretsMatch(received: string | undefined): boolean {
  if (!received || !env.REMINDER_TASK_SECRET) return false;
  const expectedBuffer = Buffer.from(env.REMINDER_TASK_SECRET);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

router.post(
  '/',
  express.json({ limit: '8kb' }),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!reminderSecretsMatch(req.get('X-Cafe-Reminder-Secret'))) {
      res.sendStatus(401);
      return;
    }

    const plannedVisitId = req.body?.plannedVisitId;
    if (typeof plannedVisitId !== 'string' || !ID_PATTERN.test(plannedVisitId)) {
      res.status(400).json({ error: 'Invalid plannedVisitId' });
      return;
    }

    let claimed = false;
    try {
      const visit = await claimReminderDelivery(plannedVisitId);
      if (!visit) {
        res.sendStatus(204);
        return;
      }
      claimed = true;
      await lineClient.pushMessage({
        to: visit.conversationId,
        messages: [createFollowUpReminderMessage(visit)]
      });
      await completeReminderDelivery(visit.id);
      logger.info('Cafe follow-up reminder sent', { plannedVisitId: visit.id });
      res.sendStatus(204);
    } catch (error) {
      if (claimed) {
        try {
          await releaseReminderDelivery(plannedVisitId);
        } catch (releaseError) {
          logger.error('Failed to release reminder delivery lease', {
            error: releaseError instanceof Error ? releaseError.message : String(releaseError)
          });
        }
      }
      if (error instanceof PlannedVisitError && error.code === 'not_found') {
        res.sendStatus(204);
        return;
      }
      next(error);
    }
  }
);

export default router;
