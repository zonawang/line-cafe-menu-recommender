import { Firestore, Timestamp } from '@google-cloud/firestore';

import { env } from '../utils/env.js';
import type { CafePreference } from './cafePreferences.js';

export type CafeSearchPreference = 'default' | 'work_friendly';

export type CafeSearchSource = { title: string; uri: string };

export type CafeSearchSession = {
  id: string;
  ownerId: string;
  conversationId: string;
  latitude: number;
  longitude: number;
  cafes: CafeSearchSource[];
  preferences: CafePreference[];
  preference: CafeSearchPreference;
  previousCafeNames: string[];
  expiresAtMs: number;
};

type StoredCafeSearchSession = Omit<
  CafeSearchSession,
  'id' | 'expiresAtMs'
> & {
  createdAt: Timestamp;
  expiresAt: Timestamp;
  processingUntilMs: number;
};

type CreateSessionInput = Omit<
  CafeSearchSession,
  'id' | 'preference' | 'expiresAtMs'
> & {
  preference?: CafeSearchPreference;
  preferences?: CafePreference[];
  cafes?: CafeSearchSource[];
};

export type SearchSessionErrorCode =
  | 'not_found'
  | 'expired'
  | 'forbidden'
  | 'busy';

export class SearchSessionError extends Error {
  constructor(public readonly code: SearchSessionErrorCode) {
    super(`Search session unavailable: ${code}`);
  }
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const PROCESSING_LOCK_MS = 90 * 1000;

const firestore = new Firestore({ projectId: env.GOOGLE_CLOUD_PROJECT });
const sessions = firestore.collection(env.FIRESTORE_SESSION_COLLECTION);

function toPublicSession(
  id: string,
  data: StoredCafeSearchSession
): CafeSearchSession {
  return {
    id,
    ownerId: data.ownerId,
    conversationId: data.conversationId,
    latitude: data.latitude,
    longitude: data.longitude,
    cafes: data.cafes ?? [],
    preferences: data.preferences ?? [],
    preference: data.preference,
    previousCafeNames: data.previousCafeNames,
    expiresAtMs: data.expiresAt.toMillis()
  };
}

export async function createSearchSession(
  input: CreateSessionInput
): Promise<CafeSearchSession> {
  const now = Date.now();
  const document = sessions.doc();
  const data: StoredCafeSearchSession = {
    ...input,
    cafes: input.cafes ?? [],
    preferences: input.preferences ?? [],
    preference: input.preference ?? 'default',
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + SESSION_TTL_MS),
    processingUntilMs: 0
  };

  await document.set(data);
  return toPublicSession(document.id, data);
}

export async function claimSearchSession(
  sessionId: string,
  ownerId: string,
  conversationId: string
): Promise<CafeSearchSession> {
  const document = sessions.doc(sessionId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);

    if (!snapshot.exists) {
      throw new SearchSessionError('not_found');
    }

    const data = snapshot.data() as StoredCafeSearchSession;
    const now = Date.now();

    if (data.ownerId !== ownerId || data.conversationId !== conversationId) {
      throw new SearchSessionError('forbidden');
    }

    if (data.expiresAt.toMillis() <= now) {
      throw new SearchSessionError('expired');
    }

    if (data.processingUntilMs > now) {
      throw new SearchSessionError('busy');
    }

    transaction.update(document, {
      processingUntilMs: now + PROCESSING_LOCK_MS
    });

    return toPublicSession(snapshot.id, data);
  });
}

export async function getSearchSession(
  sessionId: string,
  ownerId: string,
  conversationId: string
): Promise<CafeSearchSession> {
  const snapshot = await sessions.doc(sessionId).get();
  if (!snapshot.exists) throw new SearchSessionError('not_found');
  const session = toPublicSession(snapshot.id, snapshot.data() as StoredCafeSearchSession);
  if (session.ownerId !== ownerId || session.conversationId !== conversationId) {
    throw new SearchSessionError('forbidden');
  }
  if (session.expiresAtMs <= Date.now()) throw new SearchSessionError('expired');
  return session;
}

export async function completeSearchSession(
  sessionId: string,
  preference: CafeSearchPreference,
  previousCafeNames: string[],
  cafes: CafeSearchSource[] = []
): Promise<void> {
  await sessions.doc(sessionId).update({
    preference,
    previousCafeNames,
    cafes,
    processingUntilMs: 0
  });
}

export async function releaseSearchSession(sessionId: string): Promise<void> {
  await sessions.doc(sessionId).update({ processingUntilMs: 0 });
}
