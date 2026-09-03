import { FieldValue, Firestore, Timestamp } from '@google-cloud/firestore';

import type { JourneyTag } from '../actions/journeyPostbackActions.js';
import { env } from '../utils/env.js';
import type { CafeSearchSource } from './searchSessionStore.js';
import type { CafePreference } from './cafePreferences.js';

export type CafeJourney = {
  id: string;
  ownerId: string;
  conversationId: string;
  cafeTitle: string;
  cafeUri: string;
  rating?: number;
  tags: JourneyTag[];
  status: 'draft' | 'completed';
  createdAtMs: number;
  visitedAtMs?: number;
  completedAtMs?: number;
};

type StoredCafeJourney = Omit<CafeJourney, 'id' | 'createdAtMs' | 'visitedAtMs' | 'completedAtMs'> & {
  createdAt: Timestamp;
  visitedAt?: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp;
  completedAt?: Timestamp;
};

export class JourneyError extends Error {
  constructor(public readonly code: 'not_found' | 'expired' | 'forbidden' | 'incomplete' | 'completed') {
    super(`Cafe journey unavailable: ${code}`);
  }
}

const DRAFT_TTL_MS = 30 * 60 * 1000;
const firestore = new Firestore({ projectId: env.GOOGLE_CLOUD_PROJECT });
const users = firestore.collection(env.FIRESTORE_JOURNEY_USERS_COLLECTION);

function visits(ownerId: string) {
  return users.doc(ownerId).collection('visits');
}

function toJourney(id: string, data: StoredCafeJourney): CafeJourney {
  return {
    id,
    ownerId: data.ownerId,
    conversationId: data.conversationId,
    cafeTitle: data.cafeTitle,
    cafeUri: data.cafeUri,
    rating: data.rating,
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: data.status,
    createdAtMs: data.createdAt.toMillis(),
    visitedAtMs: data.visitedAt?.toMillis(),
    completedAtMs: data.completedAt?.toMillis()
  };
}

function assertAvailable(data: StoredCafeJourney, ownerId: string, conversationId: string): void {
  if (data.ownerId !== ownerId || data.conversationId !== conversationId) {
    throw new JourneyError('forbidden');
  }
  if (data.status === 'completed') throw new JourneyError('completed');
  if (!data.expiresAt || data.expiresAt.toMillis() <= Date.now()) {
    throw new JourneyError('expired');
  }
}

export async function createJourneyDraft(input: {
  id?: string;
  ownerId: string;
  conversationId: string;
  cafe: CafeSearchSource;
  visitedAtMs?: number;
}): Promise<CafeJourney> {
  const now = Timestamp.now();
  const document = input.id ? visits(input.ownerId).doc(input.id) : visits(input.ownerId).doc();
  const stored: StoredCafeJourney = {
    ownerId: input.ownerId,
    conversationId: input.conversationId,
    cafeTitle: input.cafe.title,
    cafeUri: input.cafe.uri,
    tags: [],
    status: 'draft',
    createdAt: now,
    ...(input.visitedAtMs ? { visitedAt: Timestamp.fromMillis(input.visitedAtMs) } : {}),
    updatedAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + DRAFT_TTL_MS)
  };
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (snapshot.exists) {
      const existing = snapshot.data() as StoredCafeJourney;
      if (existing.ownerId !== input.ownerId || existing.conversationId !== input.conversationId) {
        throw new JourneyError('forbidden');
      }
      return toJourney(snapshot.id, existing);
    }
    transaction.create(document, stored);
    return toJourney(document.id, stored);
  });
}

export async function rateJourney(
  id: string,
  ownerId: string,
  conversationId: string,
  rating: number
): Promise<CafeJourney> {
  const document = visits(ownerId).doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) throw new JourneyError('not_found');
    const data = snapshot.data() as StoredCafeJourney;
    assertAvailable(data, ownerId, conversationId);
    const updated = { ...data, rating, updatedAt: Timestamp.now() };
    transaction.update(document, { rating, updatedAt: updated.updatedAt });
    return toJourney(snapshot.id, updated);
  });
}

export async function addJourneyTag(
  id: string,
  ownerId: string,
  conversationId: string,
  tag: JourneyTag
): Promise<CafeJourney> {
  const document = visits(ownerId).doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) throw new JourneyError('not_found');
    const data = snapshot.data() as StoredCafeJourney;
    assertAvailable(data, ownerId, conversationId);
    if (!data.rating) throw new JourneyError('incomplete');
    const tags = Array.from(new Set([...(data.tags ?? []), tag]));
    const updated = { ...data, tags, updatedAt: Timestamp.now() };
    transaction.update(document, { tags, updatedAt: updated.updatedAt });
    return toJourney(snapshot.id, updated);
  });
}

export async function completeJourney(
  id: string,
  ownerId: string,
  conversationId: string
): Promise<CafeJourney> {
  const document = visits(ownerId).doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) throw new JourneyError('not_found');
    const data = snapshot.data() as StoredCafeJourney;
    assertAvailable(data, ownerId, conversationId);
    if (!data.rating) throw new JourneyError('incomplete');
    const completedAt = Timestamp.now();
    const updated: StoredCafeJourney = {
      ...data,
      status: 'completed',
      updatedAt: completedAt,
      completedAt,
      expiresAt: undefined
    };
    transaction.update(document, {
      status: 'completed',
      updatedAt: completedAt,
      completedAt,
      expiresAt: FieldValue.delete()
    });
    return toJourney(snapshot.id, updated);
  });
}

export async function listCafeJourneys(ownerId: string, limit = 10): Promise<CafeJourney[]> {
  const snapshot = await visits(ownerId)
    .orderBy('completedAt', 'desc')
    .limit(Math.min(Math.max(limit, 1), 20))
    .get();
  return snapshot.docs.map((document) =>
    toJourney(document.id, document.data() as StoredCafeJourney)
  );
}

export type JourneyRecommendationProfile = {
  preferences: CafePreference[];
  avoidCafeNames: string[];
};

export function deriveJourneyRecommendationProfile(
  journeys: CafeJourney[]
): JourneyRecommendationProfile {
  const latestByCafe = new Map<string, CafeJourney>();
  for (const journey of journeys) {
    const key = journey.cafeTitle.trim().toLocaleLowerCase('zh-TW');
    if (key && !latestByCafe.has(key)) latestByCafe.set(key, journey);
  }

  const preferences = new Set<CafePreference>();
  const avoidCafeNames: string[] = [];
  for (const journey of latestByCafe.values()) {
    if ((journey.rating ?? 0) <= 2) avoidCafeNames.push(journey.cafeTitle);
    if ((journey.rating ?? 0) < 4) continue;
    if (journey.tags.includes('quiet')) preferences.add('quiet');
    if (journey.tags.includes('outlets')) preferences.add('outlets');
    if (journey.tags.includes('work')) preferences.add('work_friendly');
  }
  return { preferences: Array.from(preferences), avoidCafeNames };
}

export async function getJourneyRecommendationProfile(
  ownerId: string
): Promise<JourneyRecommendationProfile> {
  return deriveJourneyRecommendationProfile(await listCafeJourneys(ownerId, 20));
}
