export const cafePreferenceKeys = [
  'quiet', 'work_friendly', 'outlets', 'wifi', 'desserts',
  'pet_friendly', 'late_night', 'budget', 'walkable'
] as const;

export type CafePreference = typeof cafePreferenceKeys[number];

const labels: Record<CafePreference, string> = {
  quiet: '安靜', work_friendly: '適合工作', outlets: '有插座', wifi: '有 Wi-Fi',
  desserts: '有甜點', pet_friendly: '寵物友善', late_night: '深夜營業',
  budget: '平價', walkable: '步行優先'
};

export function isCafePreference(value: unknown): value is CafePreference {
  return typeof value === 'string' && cafePreferenceKeys.includes(value as CafePreference);
}

export function uniqueCafePreferences(values: readonly unknown[]): CafePreference[] {
  return Array.from(new Set(values.filter(isCafePreference)));
}

export function formatCafePreferences(preferences: readonly CafePreference[]): string {
  return preferences.map((preference) => labels[preference]).join('、');
}

export function cafePreferencesForPrompt(preferences: readonly CafePreference[]): string {
  return preferences.map((preference) => `${preference} (${labels[preference]})`).join(', ');
}
