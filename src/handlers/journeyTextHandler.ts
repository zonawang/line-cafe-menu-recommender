import type { messagingApi } from '@line/bot-sdk';

import { createJourneyHistoryMessages } from '../messages/journeyMessages.js';
import { listCafeJourneys } from '../services/journeyStore.js';

const HISTORY_COMMANDS = new Set([
  '我的咖啡足跡',
  '咖啡足跡',
  '我的足跡',
  '去過的咖啡廳'
]);

export async function handleJourneyText(
  ownerId: string,
  text: string
): Promise<messagingApi.Message[] | undefined> {
  if (!ownerId || !HISTORY_COMMANDS.has(text.trim())) return undefined;
  return createJourneyHistoryMessages(await listCafeJourneys(ownerId));
}
