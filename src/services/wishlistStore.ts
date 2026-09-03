import { createHash } from 'node:crypto';

import { Firestore, Timestamp } from '@google-cloud/firestore';

import { env } from '../utils/env.js';
import type { CafeSearchSource } from './searchSessionStore.js';

export type WishlistItem = {
  id: string;
  ownerId: string;
  cafe: CafeSearchSource;
  createdAtMs: number;
};

type StoredWishlistItem = Omit<WishlistItem, 'id' | 'createdAtMs'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export class WishlistError extends Error {
  constructor(public readonly code: 'not_found' | 'forbidden') {
    super(`Wishlist item unavailable: ${code}`);
  }
}

const firestore = new Firestore({ projectId: env.GOOGLE_CLOUD_PROJECT });
const users = firestore.collection(env.FIRESTORE_WISHLIST_USERS_COLLECTION);

function entries(ownerId: string) {
  return users.doc(ownerId).collection('entries');
}

function itemId(cafe: CafeSearchSource): string {
  return createHash('sha256')
    .update(cafe.uri.trim().toLocaleLowerCase('en-US'))
    .digest('base64url')
    .slice(0, 32);
}

function toWishlistItem(id: string, data: StoredWishlistItem): WishlistItem {
  return {
    id,
    ownerId: data.ownerId,
    cafe: data.cafe,
    createdAtMs: data.createdAt.toMillis()
  };
}

export async function saveWishlistItem(input: {
  ownerId: string;
  cafe: CafeSearchSource;
}): Promise<{ item: WishlistItem; created: boolean }> {
  const document = entries(input.ownerId).doc(itemId(input.cafe));
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    const now = Timestamp.now();
    if (snapshot.exists) {
      const existing = snapshot.data() as StoredWishlistItem;
      if (existing.ownerId !== input.ownerId) throw new WishlistError('forbidden');
      transaction.update(document, { cafe: input.cafe, updatedAt: now });
      return {
        item: toWishlistItem(snapshot.id, { ...existing, cafe: input.cafe, updatedAt: now }),
        created: false
      };
    }
    const stored: StoredWishlistItem = {
      ownerId: input.ownerId,
      cafe: input.cafe,
      createdAt: now,
      updatedAt: now
    };
    transaction.create(document, stored);
    return { item: toWishlistItem(document.id, stored), created: true };
  });
}

export async function listWishlistItems(
  ownerId: string,
  limit = 10
): Promise<WishlistItem[]> {
  const snapshot = await entries(ownerId)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(Math.max(limit, 1), 10))
    .get();
  return snapshot.docs.map((document) =>
    toWishlistItem(document.id, document.data() as StoredWishlistItem)
  );
}

export async function getWishlistItem(
  wishlistItemId: string,
  ownerId: string
): Promise<WishlistItem> {
  const snapshot = await entries(ownerId).doc(wishlistItemId).get();
  if (!snapshot.exists) throw new WishlistError('not_found');
  const data = snapshot.data() as StoredWishlistItem;
  if (data.ownerId !== ownerId) throw new WishlistError('forbidden');
  return toWishlistItem(snapshot.id, data);
}

export async function removeWishlistItem(
  wishlistItemId: string,
  ownerId: string
): Promise<WishlistItem> {
  const document = entries(ownerId).doc(wishlistItemId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) throw new WishlistError('not_found');
    const data = snapshot.data() as StoredWishlistItem;
    if (data.ownerId !== ownerId) throw new WishlistError('forbidden');
    transaction.delete(document);
    return toWishlistItem(snapshot.id, data);
  });
}

export const wishlistStoreInternals = { itemId };
