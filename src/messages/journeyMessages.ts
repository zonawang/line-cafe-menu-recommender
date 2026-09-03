import type { messagingApi } from '@line/bot-sdk';

import {
  createJourneyDoneData,
  createJourneyRatingData,
  createJourneyTagData,
  type JourneyTag
} from '../actions/journeyPostbackActions.js';
import type { CafeJourney } from '../services/journeyStore.js';

const TAG_LABELS: Record<JourneyTag, string> = {
  quiet: '安靜',
  outlets: '有插座',
  work: '適合工作',
  revisit: '想再訪'
};

function stars(rating?: number): string {
  return rating ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : '尚未評分';
}

function tagText(tags: JourneyTag[]): string {
  return tags.length ? tags.map((tag) => TAG_LABELS[tag]).join('、') : '尚未加入';
}

export function createJourneyRatingMessage(journey: CafeJourney): messagingApi.TextMessage {
  return {
    type: 'text',
    text: `☕ 你覺得「${journey.cafeTitle}」如何？\n先給這次體驗 1～5 分：`,
    quickReply: {
      items: [1, 2, 3, 4, 5].map((rating) => ({
        type: 'action' as const,
        action: {
          type: 'postback' as const,
          label: `${rating} 分`,
          data: createJourneyRatingData(journey.id, rating),
          displayText: `給 ${journey.cafeTitle} ${rating} 分`.slice(0, 300)
        }
      }))
    }
  };
}

export function createJourneyTagMessage(journey: CafeJourney): messagingApi.TextMessage {
  const tagItems = (Object.keys(TAG_LABELS) as JourneyTag[]).map((tag) => ({
    type: 'action' as const,
    action: {
      type: 'postback' as const,
      label: TAG_LABELS[tag],
      data: createJourneyTagData(journey.id, tag),
      displayText: `${journey.cafeTitle}：${TAG_LABELS[tag]}`.slice(0, 300)
    }
  }));
  return {
    type: 'text',
    text: [
      `已評為 ${stars(journey.rating)}`,
      `體驗標籤：${tagText(journey.tags)}`,
      '',
      '可以加入多個標籤；選好後按「完成紀錄」。'
    ].join('\n'),
    quickReply: {
      items: [
        ...tagItems,
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '完成紀錄',
            data: createJourneyDoneData(journey.id),
            displayText: '完成這次咖啡足跡'
          }
        }
      ]
    }
  };
}

export function createJourneyCompletedMessage(journey: CafeJourney): messagingApi.TextMessage {
  return {
    type: 'text',
    text: [
      '✅ 已收進你的咖啡足跡',
      journey.cafeTitle,
      stars(journey.rating),
      `體驗標籤：${tagText(journey.tags)}`,
      '',
      '輸入「我的咖啡足跡」可以隨時查看。'
    ].join('\n')
  };
}

function createJourneyBubble(journey: CafeJourney): messagingApi.FlexBubble {
  const visitDate = journey.visitedAtMs ?? journey.completedAtMs;
  const completedAt = visitDate
    ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium' }).format(visitDate)
    : '';
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: journey.cafeTitle, weight: 'bold', size: 'lg', wrap: true },
        { type: 'text', text: stars(journey.rating), color: '#B7791F', size: 'lg' },
        { type: 'text', text: `體驗：${tagText(journey.tags)}`, wrap: true, size: 'sm', color: '#666666' },
        { type: 'text', text: completedAt, size: 'xs', color: '#999999' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [{
        type: 'button',
        style: 'primary',
        color: '#6F4E37',
        action: { type: 'uri', label: '在 Google Maps 查看', uri: journey.cafeUri }
      }]
    }
  };
}

export function createJourneyHistoryMessages(journeys: CafeJourney[]): messagingApi.Message[] {
  if (journeys.length === 0) {
    return [{
      type: 'text',
      text: '你還沒有咖啡足跡。先傳送位置找店，再點推薦卡片上的「記錄這次造訪」。',
      quickReply: { items: [{ type: 'action', action: { type: 'location', label: '傳送目前位置' } }] }
    }];
  }
  return [{
    type: 'flex',
    altText: `我的咖啡足跡（${journeys.length} 筆）`,
    contents: { type: 'carousel', contents: journeys.map(createJourneyBubble) }
  }];
}

export const journeyMessageInternals = { stars, tagText };
