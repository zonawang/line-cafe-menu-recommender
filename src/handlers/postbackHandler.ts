import type { messagingApi, WebhookEvent } from '@line/bot-sdk';

import {
  cafeDatetimeToIso,
  formatCafeDatetime,
  isCafeDatetimePostbackData,
  parseCafeDatetimePickerData
} from '../actions/cafeDatetimePickerActions.js';
import { parseCafePostbackData } from '../actions/cafePostbackActions.js';
import { parseFollowUpPostbackData } from '../actions/followUpPostbackActions.js';
import { parsePreferencePostbackData } from '../actions/preferencePostbackActions.js';
import { parseJourneyPostbackData } from '../actions/journeyPostbackActions.js';
import {
  parseWishlistDatetimePickerData,
  parseWishlistPostbackData
} from '../actions/wishlistActions.js';
import {
  createCafeDatetimeResultMessage,
  createCafeResultMessages,
  createPreferenceCompletedMessage
} from '../messages/cafeMessages.js';
import {
  createJourneyCompletedMessage,
  createJourneyRatingMessage,
  createJourneyTagMessage
} from '../messages/journeyMessages.js';
import { createFollowUpSkippedMessage } from '../messages/followUpMessages.js';
import {
  createWishlistRemovedMessage,
  createWishlistSavedMessage
} from '../messages/wishlistMessages.js';
import { findNearbyCafes } from '../services/geminiMaps.js';
import { createGoogleCalendarLink } from '../services/calendarLink.js';
import {
  cancelPendingPreferenceAction,
  executePendingPreferenceAction,
  PreferenceActionError
} from '../services/preferenceStore.js';
import { lineClient } from '../services/lineClient.js';
import {
  beginPlannedVisitFeedback,
  cancelPlannedVisit,
  PlannedVisitError
} from '../services/plannedVisitStore.js';
import {
  formatFollowUpDateTime,
  scheduleCafeFollowUp
} from '../services/reminderScheduler.js';
import {
  addJourneyTag,
  completeJourney,
  createJourneyDraft,
  getJourneyRecommendationProfile,
  JourneyError,
  rateJourney
} from '../services/journeyStore.js';
import {
  claimSearchSession,
  completeSearchSession,
  getSearchSession,
  releaseSearchSession,
  SearchSessionError,
  type CafeSearchPreference
} from '../services/searchSessionStore.js';
import { getActorId, getConversationId } from '../utils/lineEvent.js';
import { logger } from '../utils/logger.js';
import {
  getWishlistItem,
  removeWishlistItem,
  saveWishlistItem,
  WishlistError
} from '../services/wishlistStore.js';

function errorText(error: unknown): string {
  if (error instanceof PreferenceActionError) {
    if (error.code === 'completed') return '這個偏好操作已經執行過了。';
    if (error.code === 'forbidden') return '這個偏好操作不屬於你，無法執行。';
    return '這個偏好確認操作已過期，請重新下指令。';
  }
  if (error instanceof SearchSessionError) {
    switch (error.code) {
      case 'busy':
        return '上一個搜尋還在進行中，請稍等結果出現。';
      case 'forbidden':
        return '這個搜尋按鈕屬於其他使用者，請重新傳送你的位置。';
      case 'expired':
      case 'not_found':
        return '這次搜尋已經過期，請重新傳送位置。';
    }
  }
  if (error instanceof JourneyError) {
    switch (error.code) {
      case 'forbidden':
        return '這個咖啡足跡不屬於你，無法操作。';
      case 'completed':
        return '這筆咖啡足跡已經完成紀錄了。';
      case 'incomplete':
        return '請先替這次體驗評分，再完成紀錄。';
      case 'expired':
      case 'not_found':
        return '這次足跡紀錄已過期，請回到推薦卡片重新操作。';
    }
  }
  if (error instanceof PlannedVisitError) {
    if (error.code === 'forbidden') return '這個提醒不屬於你，無法操作。';
    if (error.code === 'completed') return '這個提醒已經處理過了。';
    return '這個咖啡行程提醒已經無法使用。';
  }
  if (error instanceof WishlistError) {
    if (error.code === 'forbidden') return '這個收藏不屬於你，無法操作。';
    return '這筆收藏已不存在，請重新查看想去清單。';
  }

  return '目前無法更新咖啡廳推薦，請稍後再試一次。';
}

function retryMessage(text: string): messagingApi.TextMessage {
  return {
    type: 'text',
    text,
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
  };
}

export async function handlePostbackEvent(
  event: Extract<WebhookEvent, { type: 'postback' }>
): Promise<void> {
  const wishlistDatetime = parseWishlistDatetimePickerData(event.postback.data);
  if (wishlistDatetime) {
    const postbackParams = event.postback.params;
    const selectedDatetime =
      postbackParams && 'datetime' in postbackParams
        ? postbackParams.datetime
        : undefined;
    const formattedDatetime = selectedDatetime
      ? formatCafeDatetime(selectedDatetime)
      : undefined;
    const ownerId = getActorId(event.source);
    const conversationId = getConversationId(event.source);
    try {
      if (!selectedDatetime || !formattedDatetime || !ownerId || !conversationId) {
        throw new WishlistError('not_found');
      }
      const item = await getWishlistItem(wishlistDatetime.wishlistItemId, ownerId);
      const startTime = cafeDatetimeToIso(selectedDatetime);
      if (!startTime || Date.parse(startTime) <= Date.now()) {
        throw new WishlistError('not_found');
      }
      const plannedVisit = await scheduleCafeFollowUp({
        ownerId,
        conversationId,
        cafe: item.cafe,
        scheduledAtMs: Date.parse(startTime)
      });
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [createCafeDatetimeResultMessage(
          item.cafe.title,
          formattedDatetime,
          createGoogleCalendarLink({ cafe: item.cafe, startTime }),
          formatFollowUpDateTime(plannedVisit.remindAtMs)
        )]
      });
    } catch (error) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: error instanceof WishlistError
            ? errorText(error)
            : '目前無法從想去清單安排時間，請稍後再試。'
        }]
      });
    }
    return;
  }

  if (isCafeDatetimePostbackData(event.postback.data)) {
    const postbackParams = event.postback.params;
    const selectedDatetime =
      postbackParams && 'datetime' in postbackParams
        ? postbackParams.datetime
        : undefined;
    const formattedDatetime = selectedDatetime
      ? formatCafeDatetime(selectedDatetime)
      : undefined;

    const selection = parseCafeDatetimePickerData(event.postback.data);
    const ownerId = getActorId(event.source);
    const conversationId = getConversationId(event.source);
    if (selection && selectedDatetime && formattedDatetime && ownerId && conversationId) {
      try {
        const session = await getSearchSession(selection.sessionId, ownerId, conversationId);
        const cafe = session.cafes[selection.cafeNumber - 1];
        const startTime = cafeDatetimeToIso(selectedDatetime);
        if (!cafe || !startTime || Date.parse(startTime) <= Date.now()) {
          throw new SearchSessionError('expired');
        }
        const scheduledAtMs = Date.parse(startTime);
        const plannedVisit = await scheduleCafeFollowUp({
          ownerId,
          conversationId,
          cafe,
          scheduledAtMs
        });
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [createCafeDatetimeResultMessage(
            cafe.title,
            formattedDatetime,
            createGoogleCalendarLink({ cafe, startTime }),
            formatFollowUpDateTime(plannedVisit.remindAtMs)
          )]
        });
        logger.info('Cafe datetime selected', {
          webhookEventId: event.webhookEventId,
          valid: true,
          cafeNumber: selection.cafeNumber
        });
        return;
      } catch (error) {
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [retryMessage(
            error instanceof SearchSessionError
              ? errorText(error)
              : '目前無法建立造訪提醒，請稍後再選一次時間。'
          )]
        });
        return;
      }
    }

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [createCafeDatetimeResultMessage(formattedDatetime)]
    });

    logger.info('Cafe datetime selected', {
      webhookEventId: event.webhookEventId,
      valid: Boolean(formattedDatetime)
    });
    return;
  }

  const wishlistPostback = parseWishlistPostbackData(event.postback.data);
  if (wishlistPostback) {
    const ownerId = getActorId(event.source);
    const conversationId = getConversationId(event.source);
    if (!ownerId || !conversationId) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '目前無法確認操作來源，請稍後再試。' }]
      });
      return;
    }
    try {
      if (wishlistPostback.action === 'add') {
        const session = await getSearchSession(
          wishlistPostback.sessionId,
          ownerId,
          conversationId
        );
        const cafe = session.cafes[wishlistPostback.cafeNumber - 1];
        if (!cafe) throw new SearchSessionError('not_found');
        const saved = await saveWishlistItem({ ownerId, cafe });
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [createWishlistSavedMessage(cafe.title, saved.created)]
        });
        return;
      }

      const removed = await removeWishlistItem(
        wishlistPostback.wishlistItemId,
        ownerId
      );
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [createWishlistRemovedMessage(removed.cafe.title)]
      });
    } catch (error) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: errorText(error) }]
      });
    }
    return;
  }

  const followUpPostback = parseFollowUpPostbackData(event.postback.data);
  if (followUpPostback) {
    const ownerId = getActorId(event.source);
    const conversationId = getConversationId(event.source);
    if (!ownerId || !conversationId) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '目前無法確認操作來源，請稍後再試。' }]
      });
      return;
    }

    try {
      if (followUpPostback.action === 'skip') {
        const visit = await cancelPlannedVisit(
          followUpPostback.plannedVisitId,
          ownerId,
          conversationId
        );
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [createFollowUpSkippedMessage(visit.cafe.title)]
        });
        return;
      }

      const visit = await beginPlannedVisitFeedback(
        followUpPostback.plannedVisitId,
        ownerId,
        conversationId
      );
      const journey = await createJourneyDraft({
        id: visit.id,
        ownerId,
        conversationId,
        cafe: visit.cafe,
        visitedAtMs: visit.scheduledAtMs
      });
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [createJourneyRatingMessage(journey)]
      });
    } catch (error) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: errorText(error) }]
      });
    }
    return;
  }

  const preferencePostback = parsePreferencePostbackData(event.postback.data);
  if (preferencePostback) {
    const ownerId = getActorId(event.source);
    const conversationId = getConversationId(event.source);
    if (!ownerId || !conversationId) {
      await lineClient.replyMessage({ replyToken: event.replyToken, messages: [retryMessage('目前無法確認操作來源，請稍後再試。')] });
      return;
    }
    try {
      if (preferencePostback.action === 'cancel') {
        await cancelPendingPreferenceAction(preferencePostback.id, ownerId, conversationId);
        await lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '已取消這次偏好操作。' }] });
      } else {
        const action = await executePendingPreferenceAction(preferencePostback.id, ownerId, conversationId);
        await lineClient.replyMessage({ replyToken: event.replyToken, messages: [createPreferenceCompletedMessage(action)] });
      }
    } catch (error) {
      await lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: errorText(error) }] });
    }
    return;
  }

  const journeyPostback = parseJourneyPostbackData(event.postback.data);
  if (journeyPostback) {
    const ownerId = getActorId(event.source);
    const conversationId = getConversationId(event.source);
    if (!ownerId || !conversationId) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '目前無法確認操作來源，請稍後再試。' }]
      });
      return;
    }

    try {
      if (journeyPostback.action === 'visit') {
        const session = await getSearchSession(
          journeyPostback.sessionId,
          ownerId,
          conversationId
        );
        const cafe = session.cafes[journeyPostback.cafeNumber - 1];
        if (!cafe) throw new SearchSessionError('not_found');
        const journey = await createJourneyDraft({ ownerId, conversationId, cafe });
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [createJourneyRatingMessage(journey)]
        });
        return;
      }

      if (journeyPostback.action === 'rate') {
        const journey = await rateJourney(
          journeyPostback.journeyId,
          ownerId,
          conversationId,
          journeyPostback.rating
        );
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [createJourneyTagMessage(journey)]
        });
        return;
      }

      if (journeyPostback.action === 'tag') {
        const journey = await addJourneyTag(
          journeyPostback.journeyId,
          ownerId,
          conversationId,
          journeyPostback.tag
        );
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [createJourneyTagMessage(journey)]
        });
        return;
      }

      const journey = await completeJourney(
        journeyPostback.journeyId,
        ownerId,
        conversationId
      );
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [createJourneyCompletedMessage(journey)]
      });
    } catch (error) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: errorText(error) }]
      });
    }
    return;
  }

  const parsed = parseCafePostbackData(event.postback.data);

  if (!parsed) {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [retryMessage('無法辨識這個操作，請重新傳送位置。')]
    });
    return;
  }

  const ownerId = getActorId(event.source);
  const conversationId = getConversationId(event.source);

  if (!ownerId || !conversationId) {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [retryMessage('目前無法確認操作來源，請重新傳送位置。')]
    });
    return;
  }

  let sessionClaimed = false;

  try {
    const session = await claimSearchSession(
      parsed.sessionId,
      ownerId,
      conversationId
    );
    sessionClaimed = true;

    try {
      await lineClient.showLoadingAnimation({
        chatId: conversationId,
        loadingSeconds: 60
      });
    } catch (error) {
      logger.error('Postback loading animation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const preference: CafeSearchPreference =
      parsed.action === 'work_friendly'
        ? 'work_friendly'
        : session.preference;
    const journeyProfile = await getJourneyRecommendationProfile(ownerId);
    const result = await findNearbyCafes(session.latitude, session.longitude, {
      preference,
      excludeNames: Array.from(new Set([
        ...session.previousCafeNames,
        ...journeyProfile.avoidCafeNames
      ])),
      preferences: session.preferences,
      journeyPreferences: journeyProfile.preferences
    });

    await completeSearchSession(
      session.id,
      preference,
      result.sources.map((source) => source.title),
      result.sources
    );
    sessionClaimed = false;

    await lineClient.pushMessage({
      to: conversationId,
      messages: createCafeResultMessages(result, session.id)
    });

    logger.info('Cafe postback search reply sent', {
      action: parsed.action,
      sessionId: session.id,
      sourceCount: result.sources.length
    });
  } catch (error) {
    if (sessionClaimed) {
      try {
        await releaseSearchSession(parsed.sessionId);
      } catch (releaseError) {
        logger.error('Failed to release cafe search session lock', {
          error:
            releaseError instanceof Error
              ? releaseError.message
              : String(releaseError)
        });
      }
    }

    logger.error('Cafe postback search failed', {
      action: parsed.action,
      sessionId: parsed.sessionId,
      error: error instanceof Error ? error.message : String(error)
    });

    await lineClient.pushMessage({
      to: conversationId,
      messages: [retryMessage(errorText(error))]
    });
  }
}
