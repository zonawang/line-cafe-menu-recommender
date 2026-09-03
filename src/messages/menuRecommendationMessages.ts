import type { messagingApi } from '@line/bot-sdk';

import type {
  MenuAnalysis,
  MenuDrinkRecommendation
} from '../services/menuRecommender.js';

const MENU_QUICK_REPLY: messagingApi.QuickReply = {
  items: [
    {
      type: 'action',
      action: { type: 'camera', label: '拍攝菜單' }
    },
    {
      type: 'action',
      action: { type: 'cameraRoll', label: '從相簿選擇' }
    }
  ]
};

export function isMenuScanCommand(text: string): boolean {
  return ['拍菜單', '菜單推薦', '推薦飲品', '看菜單'].includes(text.trim());
}

export function createMenuScanGuideMessage(): messagingApi.TextMessage {
  return {
    type: 'text',
    text: [
      '📷 請拍一張飲品菜單，我會從照片中挑出最多 3 杯值得考慮的飲品。',
      '',
      '小提醒：一次傳一張、讓文字清楚入鏡，辨識會比較準。圖片只用於這次分析，不會存進資料庫。'
    ].join('\n'),
    quickReply: MENU_QUICK_REPLY
  };
}

function recommendationBubble(
  recommendation: MenuDrinkRecommendation,
  index: number
): messagingApi.FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#294D3F',
      paddingAll: '16px',
      contents: [{
        type: 'text',
        text: `推薦 ${index + 1}`,
        color: '#F2D493',
        size: 'sm',
        weight: 'bold'
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: recommendation.name,
          wrap: true,
          weight: 'bold',
          size: 'xl',
          color: '#2E493D'
        },
        {
          type: 'text',
          text: recommendation.price,
          wrap: true,
          size: 'md',
          weight: 'bold',
          color: '#A94F38'
        },
        {
          type: 'text',
          text: recommendation.reason,
          wrap: true,
          size: 'sm',
          color: '#555555'
        },
        {
          type: 'separator',
          margin: 'md'
        },
        {
          type: 'text',
          text: `咖啡因：${recommendation.caffeine}`,
          wrap: true,
          size: 'xs',
          color: '#777777'
        },
        {
          type: 'text',
          text: `甜度：${recommendation.sweetness}`,
          wrap: true,
          size: 'xs',
          color: '#777777'
        }
      ]
    }
  };
}

export function createMenuRecommendationMessages(
  analysis: MenuAnalysis
): messagingApi.Message[] {
  if (!analysis.isMenu || analysis.recommendations.length === 0) {
    return [{
      type: 'text',
      text: [
        '我還看不清楚這張照片中的飲品菜單。',
        '請一次拍一頁，避免反光，並讓品名和價格盡量清楚入鏡。'
      ].join('\n'),
      quickReply: MENU_QUICK_REPLY
    }];
  }

  const summary = analysis.menuSummary || '我從這張菜單中整理了幾個選擇。';

  return [
    {
      type: 'text',
      text: `☕ ${summary}\n\n${analysis.caution}`
    },
    {
      type: 'flex',
      altText: `菜單飲品推薦：${analysis.recommendations.map((item) => item.name).join('、')}`.slice(0, 400),
      contents: {
        type: 'carousel',
        contents: analysis.recommendations.map(recommendationBubble)
      },
      quickReply: MENU_QUICK_REPLY
    }
  ];
}

export function createMenuImageFailureMessage(
  reason: 'too_large' | 'unsupported' | 'multiple' | 'failed'
): messagingApi.TextMessage {
  const text = reason === 'too_large'
    ? '這張圖片太大了，請壓縮到 8 MB 以下再試一次。'
    : reason === 'unsupported'
      ? '目前支援 JPG、PNG、WebP、HEIC 或 HEIF 圖片，請換一張再試。'
      : reason === 'multiple'
        ? '請一次傳送一張菜單照片，我才能逐張看清楚並推薦。'
        : '目前無法分析這張菜單，請稍後再傳一次。';

  return {
    type: 'text',
    text,
    quickReply: MENU_QUICK_REPLY
  };
}
