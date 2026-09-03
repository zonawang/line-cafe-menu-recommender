import type { MapsSource } from './geminiMaps.js';

function calendarTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
}

export function createGoogleCalendarLink(input: {
  cafe: MapsSource;
  startTime: string;
  durationMinutes?: number;
}): string {
  const start = new Date(input.startTime);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid calendar start time');
  const end = new Date(start.getTime() + (input.durationMinutes ?? 90) * 60_000);
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: `去 ${input.cafe.title} 喝咖啡`,
    dates: `${calendarTimestamp(start)}/${calendarTimestamp(end)}`,
    details: `由 Zona Cafe Datetime Picker 建立\nGoogle Maps：${input.cafe.uri}`,
    location: input.cafe.title
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
