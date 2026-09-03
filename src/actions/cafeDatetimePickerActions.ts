import type { messagingApi } from '@line/bot-sdk';

const CAFE_DATETIME_POSTBACK_DATA = 'v=1&a=schedule_cafe';
const DATETIME_PICKER_VERSION = '2';
const DATETIME_PICKER_ACTION = 'pick_time';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const LINE_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

function taipeiDatetime(valueMs: number): string {
  return new Date(valueMs + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function pickerWindow(): Pick<messagingApi.DatetimePickerAction, 'min' | 'max'> {
  const now = Date.now();
  return {
    min: taipeiDatetime(now),
    max: taipeiDatetime(now + 29 * 24 * 60 * 60 * 1000)
  };
}

export function createCafeDatetimePickerAction(): messagingApi.DatetimePickerAction {
  return {
    type: 'datetimepicker',
    label: '安排喝咖啡時間',
    data: CAFE_DATETIME_POSTBACK_DATA,
    mode: 'datetime',
    ...pickerWindow()
  };
}

export function createCafeDatetimePickerActionForCafe(
  sessionId: string,
  cafeNumber: number
): messagingApi.DatetimePickerAction {
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new Error('Invalid search session ID');
  if (!Number.isInteger(cafeNumber) || cafeNumber < 1) throw new Error('Invalid cafe number');
  const data = new URLSearchParams({
    v: DATETIME_PICKER_VERSION,
    a: DATETIME_PICKER_ACTION,
    s: sessionId,
    c: String(cafeNumber)
  }).toString();
  return {
    type: 'datetimepicker',
    label: '安排喝咖啡時間',
    data,
    mode: 'datetime',
    ...pickerWindow()
  };
}

export type CafeDatetimePickerSelection = {
  sessionId: string;
  cafeNumber: number;
};

export function parseCafeDatetimePickerData(
  data: string
): CafeDatetimePickerSelection | undefined {
  const params = new URLSearchParams(data);
  const cafeNumber = Number(params.get('c'));
  const sessionId = params.get('s');
  if (
    params.get('v') !== DATETIME_PICKER_VERSION ||
    params.get('a') !== DATETIME_PICKER_ACTION ||
    !sessionId ||
    !SESSION_ID_PATTERN.test(sessionId) ||
    !Number.isInteger(cafeNumber) ||
    cafeNumber < 1
  ) return undefined;
  return { sessionId, cafeNumber };
}

export function isCafeDatetimePostbackData(data: string): boolean {
  return data === CAFE_DATETIME_POSTBACK_DATA || Boolean(parseCafeDatetimePickerData(data));
}

export function formatCafeDatetime(value: string): string | undefined {
  const match = LINE_DATETIME_PATTERN.exec(value);
  if (!match) return undefined;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    month < 1 ||
    month > 12 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return undefined;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${year} 年 ${month} 月 ${day} 日 ${hourText}:${minuteText}`;
}

/** LINE returns a local Taipei datetime without an offset. */
export function cafeDatetimeToIso(value: string): string | undefined {
  if (!formatCafeDatetime(value)) return undefined;
  const date = new Date(`${value}:00+08:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
