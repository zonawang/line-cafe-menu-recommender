import type { WebhookEvent, messagingApi } from '@line/bot-sdk';

import {
  createCafeResultMessages,
  createWelcomeMessage
} from '../messages/cafeMessages.js';
import { findNearbyCafes } from '../services/geminiMaps.js';
import { lineClient } from '../services/lineClient.js';
import { createSearchSession } from '../services/searchSessionStore.js';
import { getCafePreferences } from '../services/preferenceStore.js';
import { getJourneyRecommendationProfile } from '../services/journeyStore.js';
import { getActorId, getConversationId } from '../utils/lineEvent.js';
import { logger } from '../utils/logger.js';
import { handlePostbackEvent } from './postbackHandler.js';
import { handlePreferenceText } from './preferenceTextHandler.js';
import { handleJourneyText } from './journeyTextHandler.js';
import { handleWishlistText } from './wishlistTextHandler.js';
import { handleMenuImageEvent } from './menuImageHandler.js';
import {
  createMenuScanGuideMessage,
  isMenuScanCommand
} from '../messages/menuRecommendationMessages.js';

async function reply(replyToken: string, messages: messagingApi.Message[]) {
  await lineClient.replyMessage({ replyToken, messages });
}

export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  logger.info('Webhook event received', {
    eventType: event.type,
    webhookEventId: event.webhookEventId
  });

  if (event.type === 'postback') {
    await handlePostbackEvent(event);
    return;
  }

  if (event.type !== 'message') {
    return;
  }

  if (event.message.type === 'text') {
    if (isMenuScanCommand(event.message.text)) {
      await reply(event.replyToken, [createMenuScanGuideMessage()]);
      return;
    }

    const ownerId = getActorId(event.source) ?? '';
    const journeyMessages = await handleJourneyText(ownerId, event.message.text);
    const wishlistMessages = await handleWishlistText(ownerId, event.message.text);
    await reply(event.replyToken, journeyMessages ?? wishlistMessages ?? await handlePreferenceText({
      ownerId,
      conversationId: getConversationId(event.source) ?? '',
      text: event.message.text
    }));
    return;
  }

  if (event.message.type === 'image') {
    await handleMenuImageEvent(event);
    return;
  }

  if (event.message.type !== 'location') {
    return;
  }

  const startedAt = Date.now();
  const targetId = getConversationId(event.source);
  const ownerId = getActorId(event.source);

  if (targetId) {
    try {
      await lineClient.showLoadingAnimation({
        chatId: targetId,
        loadingSeconds: 60
      });
    } catch (error) {
      logger.error('Loading animation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  logger.info('Cafe search started', {
    webhookEventId: event.webhookEventId
  });

  try {
    const [savedPreferences, journeyProfile] = ownerId
      ? await Promise.all([
          getCafePreferences(ownerId),
          getJourneyRecommendationProfile(ownerId)
        ])
      : [[], { preferences: [], avoidCafeNames: [] }];
    const result = await findNearbyCafes(
      event.message.latitude,
      event.message.longitude,
      {
        preferences: savedPreferences,
        journeyPreferences: journeyProfile.preferences,
        excludeNames: journeyProfile.avoidCafeNames
      }
    );

    let sessionId: string | undefined;

    if (targetId && ownerId) {
      try {
        const session = await createSearchSession({
          ownerId,
          conversationId: targetId,
          latitude: event.message.latitude,
          longitude: event.message.longitude,
          cafes: result.sources,
          preferences: savedPreferences,
          previousCafeNames: result.sources.map((source) => source.title)
        });
        sessionId = session.id;
      } catch (error) {
        logger.error('Failed to create cafe search session', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const messages = createCafeResultMessages(result, sessionId);

    if (targetId) {
      await lineClient.pushMessage({ to: targetId, messages });
    } else {
      await reply(event.replyToken, messages);
    }

    logger.info('Cafe search reply sent', {
      webhookEventId: event.webhookEventId,
      sourceCount: result.sources.length,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    logger.error('Cafe search failed', {
      error: error instanceof Error ? error.message : String(error),
      webhookEventId: event.webhookEventId,
      elapsedMs: Date.now() - startedAt
    });

    const messages: messagingApi.Message[] = [
      {
        type: 'text',
        text: '目前無法取得附近咖啡廳，請稍後再傳一次位置。',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'location',
                label: '重新傳送位置'
              }
            }
          ]
        }
      }
    ];

    if (targetId) {
      await lineClient.pushMessage({ to: targetId, messages });
    } else {
      await reply(event.replyToken, messages);
    }
  }
}
