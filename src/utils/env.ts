import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function port(): number {
  const value = Number(process.env.PORT ?? 3000);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

export const env = {
  PORT: port(),
  LINE_CHANNEL_SECRET: required('LINE_CHANNEL_SECRET'),
  LINE_CHANNEL_ACCESS_TOKEN: required('LINE_CHANNEL_ACCESS_TOKEN'),
  GOOGLE_CLOUD_PROJECT: required('GOOGLE_CLOUD_PROJECT'),
  GOOGLE_CLOUD_LOCATION:
    process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
  GEMINI_MAPS_MODEL: process.env.GEMINI_MAPS_MODEL?.trim() || 'gemini-2.5-flash',
  GEMINI_TRANSLATION_MODEL:
    process.env.GEMINI_TRANSLATION_MODEL?.trim() || 'gemini-2.5-flash',
  FIRESTORE_SESSION_COLLECTION:
    process.env.FIRESTORE_SESSION_COLLECTION?.trim() || 'cafe-search-sessions',
  FIRESTORE_PREFERENCES_COLLECTION:
    process.env.FIRESTORE_PREFERENCES_COLLECTION?.trim() || 'cafe-user-preferences',
  FIRESTORE_PREFERENCE_ACTIONS_COLLECTION:
    process.env.FIRESTORE_PREFERENCE_ACTIONS_COLLECTION?.trim() || 'cafe-preference-actions',
  FIRESTORE_JOURNEY_USERS_COLLECTION:
    process.env.FIRESTORE_JOURNEY_USERS_COLLECTION?.trim() || 'cafe-user-journeys',
  FIRESTORE_PLANNED_VISITS_COLLECTION:
    process.env.FIRESTORE_PLANNED_VISITS_COLLECTION?.trim() || 'cafe-planned-visits',
  FIRESTORE_WISHLIST_USERS_COLLECTION:
    process.env.FIRESTORE_WISHLIST_USERS_COLLECTION?.trim() || 'cafe-user-wishlists',
  CLOUD_TASKS_LOCATION:
    process.env.CLOUD_TASKS_LOCATION?.trim() || 'asia-east1',
  CLOUD_TASKS_QUEUE:
    process.env.CLOUD_TASKS_QUEUE?.trim() || 'cafe-follow-up-reminders',
  REMINDER_CALLBACK_URL:
    process.env.REMINDER_CALLBACK_URL?.trim() || '',
  REMINDER_TASK_SECRET:
    process.env.REMINDER_TASK_SECRET?.trim() || '',
  FOLLOW_UP_DELAY_MINUTES:
    positiveInteger('FOLLOW_UP_DELAY_MINUTES', 60),
  GEMINI_FUNCTION_MODEL:
    process.env.GEMINI_FUNCTION_MODEL?.trim() || 'gemini-2.5-flash',
  GEMINI_MENU_MODEL:
    process.env.GEMINI_MENU_MODEL?.trim() || 'gemini-2.5-flash',
  MENU_IMAGE_MAX_BYTES:
    positiveInteger('MENU_IMAGE_MAX_BYTES', 8_000_000)
};
