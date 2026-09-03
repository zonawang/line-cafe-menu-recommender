export type CafePostbackAction = 'reroll' | 'work_friendly';

export type ParsedCafePostback = {
  action: CafePostbackAction;
  sessionId: string;
};

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const SUPPORTED_ACTIONS = new Set<CafePostbackAction>([
  'reroll',
  'work_friendly'
]);

export function createCafePostbackData(
  action: CafePostbackAction,
  sessionId: string
): string {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error('Invalid cafe search session ID');
  }

  return new URLSearchParams({
    v: '1',
    a: action,
    s: sessionId
  }).toString();
}
export function parseCafePostbackData(
  data: string
): ParsedCafePostback | undefined {
  const params = new URLSearchParams(data);
  const action = params.get('a');
  const sessionId = params.get('s');

  if (
    params.get('v') !== '1' ||
    !action ||
    !SUPPORTED_ACTIONS.has(action as CafePostbackAction) ||
    !sessionId ||
    !SESSION_ID_PATTERN.test(sessionId)
  ) {
    return undefined;
  }

  return {
    action: action as CafePostbackAction,
    sessionId
  };
}
