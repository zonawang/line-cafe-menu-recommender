import type { messagingApi } from '@line/bot-sdk';

import {
  createPreferenceConfirmation,
  createPreferencesMessage,
  createWelcomeMessage
} from '../messages/cafeMessages.js';
import { decidePreferenceAction } from '../services/cafePreferenceAgent.js';
import { getCafePreferences, createPendingPreferenceAction } from '../services/preferenceStore.js';

export async function handlePreferenceText(input: {
  ownerId: string;
  conversationId: string;
  text: string;
}): Promise<messagingApi.Message[]> {
  const current = await getCafePreferences(input.ownerId);
  const decision = await decidePreferenceAction({ text: input.text, preferences: current });
  if (decision.name === 'none') return [createWelcomeMessage()];
  if (decision.name === 'list') return [createPreferencesMessage(current)];
  if (decision.name === 'remove' && decision.preferences.every((preference) => !current.includes(preference))) {
    return [{ type: 'text', text: '這些偏好目前沒有設定。可以先說「查看我的偏好」。' }];
  }
  const pending = await createPendingPreferenceAction({
    ownerId: input.ownerId,
    conversationId: input.conversationId,
    kind: decision.name,
    preferences: decision.name === 'clear' ? [] : decision.preferences
  });
  return [createPreferenceConfirmation(pending)];
}
