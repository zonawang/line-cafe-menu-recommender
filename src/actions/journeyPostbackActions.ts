export const JOURNEY_TAGS = ['quiet', 'outlets', 'work', 'revisit'] as const;

export type JourneyTag = (typeof JOURNEY_TAGS)[number];
export type JourneyPostbackAction =
  | { action: 'visit'; sessionId: string; cafeNumber: number }
  | { action: 'rate'; journeyId: string; rating: number }
  | { action: 'tag'; journeyId: string; tag: JourneyTag }
  | { action: 'done'; journeyId: string };

const VERSION = '1';

export function createJourneyVisitData(sessionId: string, cafeNumber: number): string {
  return new URLSearchParams({ v: VERSION, a: 'visit', s: sessionId, c: String(cafeNumber) }).toString();
}

export function createJourneyRatingData(journeyId: string, rating: number): string {
  return new URLSearchParams({ v: VERSION, a: 'rate', j: journeyId, r: String(rating) }).toString();
}

export function createJourneyTagData(journeyId: string, tag: JourneyTag): string {
  return new URLSearchParams({ v: VERSION, a: 'tag', j: journeyId, t: tag }).toString();
}

export function createJourneyDoneData(journeyId: string): string {
  return new URLSearchParams({ v: VERSION, a: 'done', j: journeyId }).toString();
}

function validId(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{1,128}$/u.test(value));
}

export function parseJourneyPostbackData(data: string): JourneyPostbackAction | undefined {
  const params = new URLSearchParams(data);
  if (params.get('v') !== VERSION) return undefined;

  const action = params.get('a');
  if (action === 'visit') {
    const sessionId = params.get('s');
    const cafeNumber = Number(params.get('c'));
    if (validId(sessionId) && Number.isInteger(cafeNumber) && cafeNumber >= 1 && cafeNumber <= 5) {
      return { action, sessionId, cafeNumber };
    }
  }

  const journeyId = params.get('j');
  if (!validId(journeyId)) return undefined;
  if (action === 'rate') {
    const rating = Number(params.get('r'));
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      return { action, journeyId, rating };
    }
  }
  if (action === 'tag') {
    const tag = params.get('t');
    if (JOURNEY_TAGS.includes(tag as JourneyTag)) {
      return { action, journeyId, tag: tag as JourneyTag };
    }
  }
  if (action === 'done') return { action, journeyId };
  return undefined;
}
