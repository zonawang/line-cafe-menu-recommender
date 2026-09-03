import type { messagingApi } from '@line/bot-sdk';

export type WishlistPostback =
  | { action: 'add'; sessionId: string; cafeNumber: number }
  | { action: 'remove'; wishlistItemId: string };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const VERSION = '1';

function assertId(value: string, label: string): void {
  if (!ID_PATTERN.test(value)) throw new Error(`Invalid ${label}`);
}

export function createWishlistAddData(
  sessionId: string,
  cafeNumber: number
): string {
  assertId(sessionId, 'search session ID');
  if (!Number.isInteger(cafeNumber) || cafeNumber < 1 || cafeNumber > 5) {
    throw new Error('Invalid cafe number');
  }
  return new URLSearchParams({
    v: VERSION,
    wa: 'add',
    s: sessionId,
    c: String(cafeNumber)
  }).toString();
}

export function createWishlistRemoveData(wishlistItemId: string): string {
  assertId(wishlistItemId, 'wishlist item ID');
  return new URLSearchParams({
    v: VERSION,
    wa: 'remove',
    w: wishlistItemId
  }).toString();
}

export function parseWishlistPostbackData(
  data: string
): WishlistPostback | undefined {
  const params = new URLSearchParams(data);
  if (params.get('v') !== VERSION) return undefined;

  if (params.get('wa') === 'add') {
    const sessionId = params.get('s');
    const cafeNumber = Number(params.get('c'));
    if (
      !sessionId ||
      !ID_PATTERN.test(sessionId) ||
      !Number.isInteger(cafeNumber) ||
      cafeNumber < 1 ||
      cafeNumber > 5
    ) return undefined;
    return { action: 'add', sessionId, cafeNumber };
  }

  if (params.get('wa') === 'remove') {
    const wishlistItemId = params.get('w');
    if (!wishlistItemId || !ID_PATTERN.test(wishlistItemId)) return undefined;
    return { action: 'remove', wishlistItemId };
  }

  return undefined;
}

export function createWishlistDatetimePickerAction(
  wishlistItemId: string
): messagingApi.DatetimePickerAction {
  assertId(wishlistItemId, 'wishlist item ID');
  const now = Date.now();
  const taipeiDatetime = (valueMs: number) =>
    new Date(valueMs + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return {
    type: 'datetimepicker',
    label: '安排喝咖啡時間',
    data: new URLSearchParams({
      v: VERSION,
      wa: 'schedule',
      w: wishlistItemId
    }).toString(),
    mode: 'datetime',
    min: taipeiDatetime(now),
    max: taipeiDatetime(now + 29 * 24 * 60 * 60 * 1000)
  };
}

export function parseWishlistDatetimePickerData(
  data: string
): { wishlistItemId: string } | undefined {
  const params = new URLSearchParams(data);
  const wishlistItemId = params.get('w');
  if (
    params.get('v') !== VERSION ||
    params.get('wa') !== 'schedule' ||
    !wishlistItemId ||
    !ID_PATTERN.test(wishlistItemId)
  ) return undefined;
  return { wishlistItemId };
}

export const wishlistActionInternals = { ID_PATTERN };
