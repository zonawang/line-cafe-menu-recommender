import type { messagingApi } from '@line/bot-sdk';

import { createWishlistMessages } from '../messages/wishlistMessages.js';
import { listWishlistItems } from '../services/wishlistStore.js';

const WISHLIST_COMMANDS = new Set([
  '我的想去清單',
  '想去清單',
  '我的收藏',
  '收藏的咖啡廳',
  '咖啡收藏'
]);

export async function handleWishlistText(
  ownerId: string,
  text: string
): Promise<messagingApi.Message[] | undefined> {
  if (!ownerId || !WISHLIST_COMMANDS.has(text.trim())) return undefined;
  return createWishlistMessages(await listWishlistItems(ownerId));
}
