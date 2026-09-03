import type { messagingApi } from '@line/bot-sdk';

import {
  createWishlistDatetimePickerAction,
  createWishlistRemoveData
} from '../actions/wishlistActions.js';
import type { WishlistItem } from '../services/wishlistStore.js';

export function createWishlistSavedMessage(
  cafeTitle: string,
  created: boolean
): messagingApi.TextMessage {
  return {
    type: 'text',
    text: created
      ? `⭐ 已把「${cafeTitle}」加入你的想去清單。`
      : `「${cafeTitle}」已經在你的想去清單裡。`,
    quickReply: {
      items: [{
        type: 'action',
        action: {
          type: 'message',
          label: '查看想去清單',
          text: '我的想去清單'
        }
      }]
    }
  };
}

function createWishlistBubble(item: WishlistItem): messagingApi.FlexBubble {
  const savedAt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    dateStyle: 'medium'
  }).format(item.createdAtMs);
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: '⭐ 想去', size: 'xs', color: '#B7791F', weight: 'bold' },
        { type: 'text', text: item.cafe.title, wrap: true, weight: 'bold', size: 'lg' },
        { type: 'text', text: `收藏於 ${savedAt}`, size: 'xs', color: '#999999' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#6F4E37',
          action: { type: 'uri', label: '在 Google Maps 查看', uri: item.cafe.uri }
        },
        { type: 'button', action: createWishlistDatetimePickerAction(item.id) },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '移出想去清單',
            data: createWishlistRemoveData(item.id),
            displayText: `移除收藏：${item.cafe.title}`.slice(0, 300)
          }
        }
      ]
    }
  };
}

export function createWishlistMessages(
  items: WishlistItem[]
): messagingApi.Message[] {
  if (items.length === 0) {
    return [{
      type: 'text',
      text: '你的想去清單目前是空的。先傳送位置找店，再點推薦卡片上的「加入想去清單」。',
      quickReply: {
        items: [{ type: 'action', action: { type: 'location', label: '傳送目前位置' } }]
      }
    }];
  }
  return [{
    type: 'flex',
    altText: `我的想去清單（${items.length} 間）`,
    contents: {
      type: 'carousel',
      contents: items.map(createWishlistBubble)
    }
  }];
}

export function createWishlistRemovedMessage(cafeTitle: string): messagingApi.TextMessage {
  return {
    type: 'text',
    text: `已將「${cafeTitle}」移出想去清單。`,
    quickReply: {
      items: [{
        type: 'action',
        action: { type: 'message', label: '查看剩餘清單', text: '我的想去清單' }
      }]
    }
  };
}
