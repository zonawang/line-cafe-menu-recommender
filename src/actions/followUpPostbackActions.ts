export type FollowUpPostbackAction =
  | { action: 'rate'; plannedVisitId: string }
  | { action: 'skip'; plannedVisitId: string };

const VERSION = '1';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

export function createFollowUpPostbackData(
  action: FollowUpPostbackAction['action'],
  plannedVisitId: string
): string {
  if (!ID_PATTERN.test(plannedVisitId)) {
    throw new Error('Invalid planned visit ID');
  }

  return new URLSearchParams({
    v: VERSION,
    a: `followup_${action}`,
    p: plannedVisitId
  }).toString();
}

export function parseFollowUpPostbackData(
  data: string
): FollowUpPostbackAction | undefined {
  const params = new URLSearchParams(data);
  const plannedVisitId = params.get('p');
  if (params.get('v') !== VERSION || !plannedVisitId || !ID_PATTERN.test(plannedVisitId)) {
    return undefined;
  }

  const action = params.get('a');
  if (action === 'followup_rate') return { action: 'rate', plannedVisitId };
  if (action === 'followup_skip') return { action: 'skip', plannedVisitId };
  return undefined;
}
