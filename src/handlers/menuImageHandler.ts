import type { WebhookEvent, messagingApi } from '@line/bot-sdk';

import {
  createMenuImageFailureMessage,
  createMenuRecommendationMessages
} from '../messages/menuRecommendationMessages.js';
import {
  detectMenuImageMimeType,
  MenuImageTooLargeError,
  readMenuImage,
  UnsupportedMenuImageError
} from '../services/menuImage.js';
import { lineBlobClient, lineClient } from '../services/lineClient.js';
import { recommendDrinksFromMenu } from '../services/menuRecommender.js';
import { env } from '../utils/env.js';
import { getConversationId } from '../utils/lineEvent.js';
import { logger } from '../utils/logger.js';

async function sendMessages(
  event: Extract<WebhookEvent, { type: 'message' }>,
  messages: messagingApi.Message[]
) {
  const targetId = getConversationId(event.source);

  if (targetId) {
    await lineClient.pushMessage({ to: targetId, messages });
  } else {
    await lineClient.replyMessage({ replyToken: event.replyToken, messages });
  }
}

export async function handleMenuImageEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message' || event.message.type !== 'image') return;

  if (event.message.imageSet && event.message.imageSet.total > 1) {
    if (event.message.imageSet.index === 1) {
      await sendMessages(event, [createMenuImageFailureMessage('multiple')]);
    }
    return;
  }

  const targetId = getConversationId(event.source);

  if (targetId) {
    try {
      await lineClient.showLoadingAnimation({
        chatId: targetId,
        loadingSeconds: 60
      });
    } catch (error) {
      logger.error('Menu image loading animation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  try {
    if (event.message.contentProvider.type !== 'line') {
      throw new UnsupportedMenuImageError();
    }

    const stream = await lineBlobClient.getMessageContent(event.message.id);
    const data = await readMenuImage(stream, env.MENU_IMAGE_MAX_BYTES);
    const mimeType = detectMenuImageMimeType(data);
    const analysis = await recommendDrinksFromMenu({ data, mimeType });

    logger.info('Menu image analyzed', {
      webhookEventId: event.webhookEventId,
      imageBytes: data.length,
      mimeType,
      isMenu: analysis.isMenu,
      recommendationCount: analysis.recommendations.length
    });

    await sendMessages(event, createMenuRecommendationMessages(analysis));
  } catch (error) {
    const reason = error instanceof MenuImageTooLargeError
      ? 'too_large'
      : error instanceof UnsupportedMenuImageError
        ? 'unsupported'
        : 'failed';

    logger.error('Menu image analysis failed', {
      webhookEventId: event.webhookEventId,
      reason,
      error: error instanceof Error ? error.message : String(error)
    });

    await sendMessages(event, [createMenuImageFailureMessage(reason)]);
  }
}
