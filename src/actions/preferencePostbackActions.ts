export type PreferencePostback = { action: 'confirm' | 'cancel'; id: string };
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

export function createPreferencePostbackData(action: PreferencePostback['action'], id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error('Invalid preference action ID');
  return new URLSearchParams({ v: '1', a: `preference_${action}`, id }).toString();
}

export function parsePreferencePostbackData(data: string): PreferencePostback | undefined {
  const params = new URLSearchParams(data);
  const action = params.get('a');
  const id = params.get('id');
  if ((action !== 'preference_confirm' && action !== 'preference_cancel') || !id || !ID_PATTERN.test(id)) return undefined;
  return { action: action === 'preference_confirm' ? 'confirm' : 'cancel', id };
}
