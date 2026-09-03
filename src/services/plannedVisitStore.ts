import { Firestore, Timestamp } from '@google-cloud/firestore';

import { env } from '../utils/env.js';
import type { CafeSearchSource } from './searchSessionStore.js';

export type PlannedVisitStatus =
  | 'scheduled'
  | 'sending'
  | 'reminded'
  | 'feedback_started'
  | 'canceled';

export type PlannedVisit = {
  id: string;
  ownerId: string;
  conversationId: string;
  cafe: CafeSearchSource;
  scheduledAtMs: number;
  remindAtMs: number;
  status: PlannedVisitStatus;
  taskName?: string;
};

type StoredPlannedVisit = Omit<
  PlannedVisit,
  'id' | 'scheduledAtMs' | 'remindAtMs'
> & {
  scheduledAt: Timestamp;
  remindAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  leaseUntil?: Timestamp;
};

export class PlannedVisitError extends Error {
  constructor(
    public readonly code:
      | 'not_found'
      | 'forbidden'
      | 'busy'
      | 'completed'
      | 'not_ready'
  ) {
    super(`Planned visit unavailable: ${code}`);
  }
}

const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const firestore = new Firestore({ projectId: env.GOOGLE_CLOUD_PROJECT });
const plannedVisits = firestore.collection(env.FIRESTORE_PLANNED_VISITS_COLLECTION);

function toPlannedVisit(id: string, data: StoredPlannedVisit): PlannedVisit {
  return {
    id,
    ownerId: data.ownerId,
    conversationId: data.conversationId,
    cafe: data.cafe,
    scheduledAtMs: data.scheduledAt.toMillis(),
    remindAtMs: data.remindAt.toMillis(),
    status: data.status,
    taskName: data.taskName
  };
}

function assertOwner(
  data: StoredPlannedVisit,
  ownerId: string,
  conversationId: string
): void {
  if (data.ownerId !== ownerId || data.conversationId !== conversationId) {
    throw new PlannedVisitError('forbidden');
  }
}

export async function createPlannedVisit(input: {
  ownerId: string;
  conversationId: string;
  cafe: CafeSearchSource;
  scheduledAtMs: number;
  remindAtMs: number;
}): Promise<PlannedVisit> {
  const document = plannedVisits.doc();
  const now = Timestamp.now();
  const stored: StoredPlannedVisit = {
    ownerId: input.ownerId,
    conversationId: input.conversationId,
    cafe: input.cafe,
    scheduledAt: Timestamp.fromMillis(input.scheduledAtMs),
    remindAt: Timestamp.fromMillis(input.remindAtMs),
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
    expiresAt: Timestamp.fromMillis(input.remindAtMs + 90 * 24 * 60 * 60 * 1000)
  };
  await document.create(stored);
  return toPlannedVisit(document.id, stored);
}

export async function attachReminderTask(id: string, taskName: string): Promise<void> {
  await plannedVisits.doc(id).update({ taskName, updatedAt: Timestamp.now() });
}

export async function deleteUnscheduledPlannedVisit(id: string): Promise<void> {
  const document = plannedVisits.doc(id);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) return;
    const data = snapshot.data() as StoredPlannedVisit;
    if (data.status === 'scheduled' && !data.taskName) transaction.delete(document);
  });
}

export async function claimReminderDelivery(id: string): Promise<PlannedVisit | undefined> {
  const document = plannedVisits.doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) throw new PlannedVisitError('not_found');
    const data = snapshot.data() as StoredPlannedVisit;
    if (['reminded', 'feedback_started', 'canceled'].includes(data.status)) return undefined;

    const now = Date.now();
    if (data.remindAt.toMillis() > now + 60_000) {
      throw new PlannedVisitError('not_ready');
    }
    if (data.status === 'sending' && (data.leaseUntil?.toMillis() ?? 0) > now) {
      throw new PlannedVisitError('busy');
    }

    const updated: StoredPlannedVisit = {
      ...data,
      status: 'sending',
      updatedAt: Timestamp.fromMillis(now),
      leaseUntil: Timestamp.fromMillis(now + DELIVERY_LEASE_MS)
    };
    transaction.update(document, {
      status: updated.status,
      updatedAt: updated.updatedAt,
      leaseUntil: updated.leaseUntil
    });
    return toPlannedVisit(snapshot.id, updated);
  });
}

export async function completeReminderDelivery(id: string): Promise<void> {
  await plannedVisits.doc(id).update({
    status: 'reminded',
    updatedAt: Timestamp.now(),
    leaseUntil: null
  });
}

export async function releaseReminderDelivery(id: string): Promise<void> {
  const document = plannedVisits.doc(id);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) return;
    const data = snapshot.data() as StoredPlannedVisit;
    if (data.status === 'sending') {
      transaction.update(document, {
        status: 'scheduled',
        updatedAt: Timestamp.now(),
        leaseUntil: null
      });
    }
  });
}

export async function beginPlannedVisitFeedback(
  id: string,
  ownerId: string,
  conversationId: string
): Promise<PlannedVisit> {
  const document = plannedVisits.doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) throw new PlannedVisitError('not_found');
    const data = snapshot.data() as StoredPlannedVisit;
    assertOwner(data, ownerId, conversationId);
    if (data.status === 'feedback_started') return toPlannedVisit(snapshot.id, data);
    if (data.status !== 'reminded') throw new PlannedVisitError('completed');
    const updated = { ...data, status: 'feedback_started' as const, updatedAt: Timestamp.now() };
    transaction.update(document, { status: updated.status, updatedAt: updated.updatedAt });
    return toPlannedVisit(snapshot.id, updated);
  });
}

export async function releasePlannedVisitFeedback(id: string): Promise<void> {
  const document = plannedVisits.doc(id);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) return;
    const data = snapshot.data() as StoredPlannedVisit;
    if (data.status === 'feedback_started') {
      transaction.update(document, { status: 'reminded', updatedAt: Timestamp.now() });
    }
  });
}

export async function cancelPlannedVisit(
  id: string,
  ownerId: string,
  conversationId: string
): Promise<PlannedVisit> {
  const document = plannedVisits.doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) throw new PlannedVisitError('not_found');
    const data = snapshot.data() as StoredPlannedVisit;
    assertOwner(data, ownerId, conversationId);
    if (data.status !== 'reminded') throw new PlannedVisitError('completed');
    const updated = { ...data, status: 'canceled' as const, updatedAt: Timestamp.now() };
    transaction.update(document, { status: updated.status, updatedAt: updated.updatedAt });
    return toPlannedVisit(snapshot.id, updated);
  });
}
