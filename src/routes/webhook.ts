import { middleware, type WebhookRequestBody } from '@line/bot-sdk';
import { Router, type Request, type Response } from 'express';

import { handleWebhookEvent } from '../handlers/webhookEventHandler.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post(
  '/',
  middleware({ channelSecret: env.LINE_CHANNEL_SECRET }),
  (req: Request<unknown, unknown, WebhookRequestBody>, res: Response) => {
    res.sendStatus(200);

    void Promise.allSettled(req.body.events.map(handleWebhookEvent)).then(
      (results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') {
            logger.error('Webhook event failed', {
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason)
            });
          }
        });
      }
    );
  }
);

export default router;
