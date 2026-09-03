import type { WebhookEvent } from '@line/bot-sdk';

type EventSource = WebhookEvent['source'];

export function getConversationId(source: EventSource): string | undefined {
  if (source.type === 'user') {
    return source.userId;
  }

  if (source.type === 'group') {
    return source.groupId;
  }

  if (source.type === 'room') {
    return source.roomId;
  }

  return undefined;
}
export function getActorId(source: EventSource): string | undefined {
  if ('userId' in source && source.userId) {
    return source.userId;
  }

  return undefined;
}
