import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import type { CafeSearchPreference } from './searchSessionStore.js';
import { cafePreferencesForPrompt, type CafePreference } from './cafePreferences.js';

export type MapsSource = {
  title: string;
  uri: string;
};

export type CafeSearchResult = {
  summary: string;
  sources: MapsSource[];
  appliedPreferences?: CafePreference[];
};

export type CafeSearchOptions = {
  preference?: CafeSearchPreference;
  excludeNames?: string[];
  preferences?: CafePreference[];
  journeyPreferences?: CafePreference[];
};

const ai = new GoogleGenAI({
  enterprise: true,
  project: env.GOOGLE_CLOUD_PROJECT,
  location: env.GOOGLE_CLOUD_LOCATION,
  apiVersion: 'v1'
});

function collectSources(response: GenerateContentResponse): MapsSource[] {
  const sourceCandidates =
    response.candidates?.flatMap((candidate) =>
      (candidate.groundingMetadata?.groundingChunks ?? []).flatMap((chunk) => {
        const maps = chunk.maps;

        if (!maps?.uri || !/^https:\/\//u.test(maps.uri)) {
          return [];
        }

        return [
          {
            title: maps.title?.trim() || 'Google Maps 地點',
            uri: maps.uri,
            placeId: maps.placeId
          }
        ];
      })
    ) ?? [];

  const uniqueSources = new Map<string, MapsSource & { isReview: boolean }>();

  sourceCandidates.forEach((source) => {
    const isReview = /^Review of /iu.test(source.title);
    const title = source.title
      .replace(/^Review of /iu, '')
      .replace(/ - Google Maps$/iu, '')
      .trim();
    const key =
      source.placeId || title.toLocaleLowerCase('en-US') || source.uri;
    const existing = uniqueSources.get(key);

    if (!existing || (existing.isReview && !isReview)) {
      uniqueSources.set(key, {
        title: title || 'Google Maps 地點',
        uri: source.uri,
        isReview
      });
    }
  });

  return Array.from(uniqueSources.values(), ({ title, uri }) => ({ title, uri })).slice(
    0,
    5
  );
}

function cleanSummary(text: string): string {
  return text.replace(/\n{3,}/gu, '\n\n').trim().slice(0, 3500);
}

async function translateToTraditionalChinese(text: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_TRANSLATION_MODEL,
      contents: [
        'Translate the following grounded cafe recommendations into natural Traditional Chinese used in Taiwan.',
        'Preserve all place names, numbers, caveats, and factual meaning.',
        'Do not add new facts. Do not add URLs. Return only the translated recommendation text.',
        '',
        text
      ].join('\n')
    });

    return cleanSummary(response.text || text);
  } catch (error) {
    logger.error('Gemini translation failed; using English fallback', {
      error: error instanceof Error ? error.message : String(error)
    });
    return cleanSummary(text);
  }
}

export async function findNearbyCafes(
  latitude: number,
  longitude: number,
  options: CafeSearchOptions = {}
): Promise<CafeSearchResult> {
  const preferenceInstruction =
    options.preference === 'work_friendly'
      ? 'Strongly prioritize cafes with explicit Google Maps evidence that they are practical for focused laptop work, while avoiding unsupported claims.'
      : 'Prioritize places that are practical for sitting down with a laptop.';
  const savedPreferenceInstruction = options.preferences?.length
    ? `The user explicitly prefers: ${cafePreferencesForPrompt(options.preferences)}. Prioritize these preferences, but only claim a match when Google Maps supports it.`
    : '';
  const journeyPreferenceInstruction = options.journeyPreferences?.length
    ? `The user's highly rated past visits were tagged with: ${cafePreferencesForPrompt(options.journeyPreferences)}. Use these only as soft ranking signals; explicit user preferences have priority.`
    : '';
  const exclusionInstruction = options.excludeNames?.length
    ? `Recommend different places from this previous batch when alternatives exist: ${options.excludeNames.join(', ')}.`
    : '';

  const response = await ai.models.generateContent({
    model: env.GEMINI_MAPS_MODEL,
    contents: [
      'Find 3 to 5 good cafes near the supplied user location.',
      preferenceInstruction,
      savedPreferenceInstruction,
      journeyPreferenceInstruction,
      exclusionInstruction,
      'For each recommendation, state the exact place name, why it is a good choice, and any useful factual details available from Google Maps.',
      'Do not invent outlet, Wi-Fi, time-limit, or noise information when it is unavailable.',
      'Keep the full answer concise and respond in English.'
    ].join(' '),
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: { latitude, longitude },
          languageCode: 'en_US'
        }
      }
    }
  });

  const rawText = cleanSummary(response.text || '');
  const sources = collectSources(response);

  if (!rawText) {
    throw new Error('Gemini Maps returned no recommendation text');
  }

  if (sources.length === 0) {
    throw new Error('Gemini Maps returned no Google Maps sources');
  }

  return {
    summary: await translateToTraditionalChinese(rawText),
    sources,
    appliedPreferences: options.preferences ?? []
  };
}

export const geminiMapsInternals = {
  collectSources
};
