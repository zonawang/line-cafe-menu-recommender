import { Firestore, Timestamp } from '@google-cloud/firestore';

import { env } from '../utils/env.js';
import { uniqueCafePreferences, type CafePreference } from './cafePreferences.js';

export type PreferenceActionKind = 'set' | 'remove' | 'clear';
export type PendingPreferenceAction = {
  id: string;
  ownerId: string;
  conversationId: string;
  kind: PreferenceActionKind;
  preferences: CafePreference[];
  expiresAtMs: number;
};

type StoredProfile = { preferences: CafePreference[]; updatedAt: Timestamp };
type StoredAction = Omit<PendingPreferenceAction, 'id' | 'expiresAtMs'> & {
  createdAt: Timestamp;
  expiresAt: Timestamp;
  status: 'pending' | 'completed';
};

const firestore = new Firestore({ projectId: env.GOOGLE_CLOUD_PROJECT });
const profiles = firestore.collection(env.FIRESTORE_PREFERENCES_COLLECTION);
const actions = firestore.collection(env.FIRESTORE_PREFERENCE_ACTIONS_COLLECTION);
const ACTION_TTL_MS = 10 * 60 * 1000;

export async function getCafePreferences(ownerId: string): Promise<CafePreference[]> {
  const snapshot = await profiles.doc(ownerId).get();
  if (!snapshot.exists) return [];
  const data = snapshot.data() as Partial<StoredProfile>;
  return uniqueCafePreferences(Array.isArray(data.preferences) ? data.preferences : []);
}

export async function createPendingPreferenceAction(input: Omit<PendingPreferenceAction, 'id' | 'expiresAtMs'>): Promise<PendingPreferenceAction> {
  const now = Date.now();
  const document = actions.doc();
  const stored: StoredAction = {
    ...input,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + ACTION_TTL_MS),
    status: 'pending'
  };
  await document.set(stored);
  return { ...input, id: document.id, expiresAtMs: stored.expiresAt.toMillis() };
}

export class PreferenceActionError extends Error {
  constructor(public readonly code: 'not_found' | 'expired' | 'forbidden' | 'completed') {
    super(`Preference action unavailable: ${code}`);
  }
}

export async function executePendingPreferenceAction(id: string, ownerId: string, conversationId: string): Promise<PendingPreferenceAction> {
  const action = actions.doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(action);
    if (!snapshot.exists) throw new PreferenceActionError('not_found');
    const data = snapshot.data() as StoredAction;
    if (data.ownerId !== ownerId || data.conversationId !== conversationId) throw new PreferenceActionError('forbidden');
    if (data.expiresAt.toMillis() <= Date.now()) throw new PreferenceActionError('expired');
    if (data.status !== 'pending') throw new PreferenceActionError('completed');
    const profile = profiles.doc(ownerId);
    const profileSnapshot = await transaction.get(profile);
    const existing = profileSnapshot.exists
      ? uniqueCafePreferences((profileSnapshot.data() as Partial<StoredProfile>).preferences ?? [])
      : [];
    const selected = uniqueCafePreferences(data.preferences);
    if (data.kind === 'clear') {
      transaction.delete(profile);
    } else {
      const next = data.kind === 'set'
        ? selected
        : existing.filter((preference) => !selected.includes(preference));
      if (next.length === 0) transaction.delete(profile);
      else transaction.set(profile, { preferences: next, updatedAt: Timestamp.now() } satisfies StoredProfile);
    }
    transaction.update(action, { status: 'completed' });
    return { id: snapshot.id, ownerId: data.ownerId, conversationId: data.conversationId, kind: data.kind, preferences: selected, expiresAtMs: data.expiresAt.toMillis() };
  });
}

export async function cancelPendingPreferenceAction(id: string, ownerId: string, conversationId: string): Promise<void> {
  const action = actions.doc(id);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(action);
    if (!snapshot.exists) return;
    const data = snapshot.data() as StoredAction;
    if (data.ownerId !== ownerId || data.conversationId !== conversationId) throw new PreferenceActionError('forbidden');
    transaction.delete(action);
  });
}
