import type { messagingApi } from '@line/bot-sdk';

import {
  createCafeDatetimePickerAction,
  createCafeDatetimePickerActionForCafe
} from '../actions/cafeDatetimePickerActions.js';
import { createCafePostbackData } from '../actions/cafePostbackActions.js';
import type { CafeSearchResult } from '../services/geminiMaps.js';
import { formatCafePreferences } from '../services/cafePreferences.js';
import type { CafePreference } from '../services/cafePreferences.js';
import type { PendingPreferenceAction } from '../services/preferenceStore.js';
import { createPreferencePostbackData } from '../actions/preferencePostbackActions.js';
import { createJourneyVisitData } from '../actions/journeyPostbackActions.js';
import { createWishlistAddData } from '../actions/wishlistActions.js';

const LOCATION_QUICK_REPLY: messagingApi.QuickReply = {
  items: [
    {
      type: 'action',
      action: {
        type: 'location',
        label: '傳送目前位置'
      }
    },
    {
      type: 'action',
      action: {
        type: 'camera',
        label: '拍菜單'
      }
    },
    {
      type: 'action',
      action: {
        type: 'cameraRoll',
        label: '選菜單照片'
      }
    }
  ]
};

export function createWelcomeMessage(): messagingApi.TextMessage {
  return {
    type: 'text',
    text: [
      '☕ 我可以用 Google Maps 資料幫你找附近咖啡廳。',
      '',
      '點下面按鈕傳送位置，我會推薦 3–5 間適合坐下來喝咖啡或使用筆電的店。',
      '也可以說「拍菜單」取得飲品推薦、說「設定我的偏好：安靜、有插座」、輸入「我的想去清單」查看收藏，或輸入「我的咖啡足跡」查看去過的店。'
    ].join('\n'),
    quickReply: LOCATION_QUICK_REPLY
  };
}

export function createCafeDatetimeResultMessage(
  cafeTitleOrFormattedDatetime?: string,
  formattedDatetimeArgument?: string,
  calendarUrl?: string,
  followUpDatetime?: string
): messagingApi.TextMessage {
  const cafeTitle = formattedDatetimeArgument ? cafeTitleOrFormattedDatetime : undefined;
  const formattedDatetime = formattedDatetimeArgument ?? cafeTitleOrFormattedDatetime;
  return {
    type: 'text',
    text: formattedDatetime
      ? [
          `☕ 已安排「${cafeTitle ?? '這間咖啡廳'}」的時間：`,
          formattedDatetime,
          ...(followUpDatetime ? ['', `我會在 ${followUpDatetime} 詢問這次體驗。`] : [])
        ].join('\n')
      : '無法讀取你選擇的日期與時間，請再選一次。',
    quickReply: {
      items: [
        ...(calendarUrl
          ? [{
              type: 'action' as const,
              action: {
                type: 'uri' as const,
                label: '加入 Google Calendar',
                uri: calendarUrl
              }
            }]
          : [{
          type: 'action',
          action: createCafeDatetimePickerAction()
          }]),
        {
          type: 'action',
          action: {
            type: 'location',
            label: '重新選位置'
          }
        }
      ]
    }
  };
}

export function createPreferencesMessage(preferences: CafePreference[]): messagingApi.TextMessage {
  return {
    type: 'text',
    text: preferences.length
      ? `☕ 我的咖啡偏好：${formatCafePreferences(preferences)}\n\n可以說「移除有插座偏好」或「清除我的偏好」。`
      : '你目前還沒有設定咖啡偏好。可以說「設定我的偏好：安靜、有插座」。'
  };
}

export function createPreferenceConfirmation(action: PendingPreferenceAction): messagingApi.TextMessage {
  const description = action.kind === 'set'
    ? `將偏好設為「${formatCafePreferences(action.preferences)}」`
    : action.kind === 'remove'
      ? `移除偏好「${formatCafePreferences(action.preferences)}」`
      : '清除所有咖啡偏好';
  return {
    type: 'text',
    text: `請確認是否要${description}？`,
    quickReply: {
      items: [
        { type: 'action', action: { type: 'postback', label: '確認執行', data: createPreferencePostbackData('confirm', action.id), displayText: '確認執行' } },
        { type: 'action', action: { type: 'postback', label: '取消', data: createPreferencePostbackData('cancel', action.id), displayText: '取消操作' } }
      ]
    }
  };
}

export function createPreferenceCompletedMessage(action: PendingPreferenceAction): messagingApi.TextMessage {
  if (action.kind === 'set') return { type: 'text', text: `已儲存咖啡偏好：${formatCafePreferences(action.preferences)}。下次傳送位置時會自動套用。` };
  if (action.kind === 'remove') return { type: 'text', text: `已移除咖啡偏好：${formatCafePreferences(action.preferences)}。` };
  return { type: 'text', text: '已清除所有咖啡偏好。' };
}

function createSourceBubble(
  source: CafeSearchResult['sources'][number],
  index: number,
  sessionId?: string
): messagingApi.FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: `推薦 ${index + 1}`,
          size: 'xs',
          color: '#8A6D3B',
          weight: 'bold'
        },
        {
          type: 'text',
          text: source.title,
          wrap: true,
          weight: 'bold',
          size: 'lg'
        },
        {
          type: 'text',
          text: '資料來源：Google Maps',
          wrap: true,
          size: 'xs',
          color: '#777777'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#6F4E37',
          action: {
            type: 'uri',
            label: '在 Google Maps 查看',
            uri: source.uri
          }
        },
        ...(sessionId
          ? [{
              type: 'button' as const,
              action: createCafeDatetimePickerActionForCafe(sessionId, index + 1)
            }, {
              type: 'button' as const,
              action: {
                type: 'postback' as const,
                label: '記錄這次造訪',
                data: createJourneyVisitData(sessionId, index + 1),
                displayText: `記錄去過：${source.title}`.slice(0, 300)
              }
            }, {
              type: 'button' as const,
              action: {
                type: 'postback' as const,
                label: '加入想去清單',
                data: createWishlistAddData(sessionId, index + 1),
                displayText: `收藏：${source.title}`.slice(0, 300)
              }
            }]
          : [])
      ]
    }
  };
}

export function createCafeResultMessages(
  result: CafeSearchResult,
  sessionId?: string
): messagingApi.Message[] {
  const summary: messagingApi.TextMessage = {
    type: 'text',
    text: `☕ 附近咖啡廳推薦\n\n${result.summary}${result.appliedPreferences?.length ? `\n\n已套用你的偏好：${formatCafePreferences(result.appliedPreferences)}` : ''}\n\n以下是本次回答使用的 Google Maps 來源：`
  };

  const sourceCarousel: messagingApi.FlexMessage = {
    type: 'flex',
    altText: 'Google Maps 咖啡廳來源',
    contents: {
      type: 'carousel',
      contents: result.sources.map((source, index) =>
        createSourceBubble(source, index, sessionId)
      )
    },
    quickReply: {
      items: [
        ...(sessionId
          ? [
              {
                type: 'action' as const,
                action: {
                  type: 'postback' as const,
                  label: '換一批',
                  data: createCafePostbackData('reroll', sessionId),
                  displayText: '🔄 換一批咖啡廳'
                }
              },
              {
                type: 'action' as const,
                action: {
                  type: 'postback' as const,
                  label: '更適合工作',
                  data: createCafePostbackData('work_friendly', sessionId),
                  displayText: '💻 找更適合工作的咖啡廳'
                }
              }
            ]
          : []),
        ...(!sessionId ? [{
          type: 'action',
          action: createCafeDatetimePickerAction()
        }] : []),
        {
          type: 'action',
          action: {
            type: 'location',
            label: '重新選位置'
          }
        }
      ]
    }
  };

  return [summary, sourceCarousel];
}
