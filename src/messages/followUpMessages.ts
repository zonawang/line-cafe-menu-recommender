import type { messagingApi } from '@line/bot-sdk';

import { createFollowUpPostbackData } from '../actions/followUpPostbackActions.js';
import type { PlannedVisit } from '../services/plannedVisitStore.js';

export function createFollowUpReminderMessage(
  visit: PlannedVisit
): messagingApi.TextMessage {
  return {
    type: 'text',
    text: `☕ 你安排的「${visit.cafe.title}」行程結束了嗎？\n如果有去，花一分鐘記下這次體驗；如果沒有去，也可以略過。`,
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '開始評分',
            data: createFollowUpPostbackData('rate', visit.id),
            displayText: `記錄 ${visit.cafe.title} 的體驗`.slice(0, 300)
          }
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '這次沒去',
            data: createFollowUpPostbackData('skip', visit.id),
            displayText: '這次沒有去'
          }
        }
      ]
    }
  };
}

export function createFollowUpSkippedMessage(cafeTitle: string): messagingApi.TextMessage {
  return {
    type: 'text',
    text: `收到，這次不會把「${cafeTitle}」加入咖啡足跡。下次再一起找適合的店 ☕`
  };
}
