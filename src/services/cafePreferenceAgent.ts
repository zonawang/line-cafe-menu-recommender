import { FunctionCallingConfigMode, GoogleGenAI, type FunctionDeclaration } from '@google/genai';
import { env } from '../utils/env.js';
import { cafePreferenceKeys, uniqueCafePreferences, type CafePreference } from './cafePreferences.js';

export type PreferenceDecision =
  | { name: 'set'; preferences: CafePreference[] }
  | { name: 'list' }
  | { name: 'remove'; preferences: CafePreference[] }
  | { name: 'clear' }
  | { name: 'none'; reply: string };

const declarations: FunctionDeclaration[] = [
  { name: 'set_cafe_preferences', description: 'Replace the user cafe preferences when they explicitly ask to set them.', parametersJsonSchema: { type: 'object', properties: { preferences: { type: 'array', items: { type: 'string', enum: cafePreferenceKeys }, minItems: 1 } }, required: ['preferences'] } },
  { name: 'list_cafe_preferences', description: 'List the user cafe preferences.', parametersJsonSchema: { type: 'object', properties: {} } },
  { name: 'remove_cafe_preferences', description: 'Remove explicitly named cafe preferences.', parametersJsonSchema: { type: 'object', properties: { preferences: { type: 'array', items: { type: 'string', enum: cafePreferenceKeys }, minItems: 1 } }, required: ['preferences'] } },
  { name: 'clear_cafe_preferences', description: 'Clear all cafe preferences only when explicitly requested.', parametersJsonSchema: { type: 'object', properties: {} } }
];
const ai = new GoogleGenAI({ enterprise: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION, apiVersion: 'v1' });
function preferences(value: unknown): CafePreference[] { return uniqueCafePreferences(Array.isArray(value) ? value : []); }

function parseDecision(calls: Array<{ name?: string; args?: Record<string, unknown> }> | undefined, fallbackText: string): PreferenceDecision {
  const call = calls?.[0];
  const selected = preferences(call?.args?.preferences);
  if (call?.name === 'set_cafe_preferences' && selected.length) return { name: 'set', preferences: selected };
  if (call?.name === 'list_cafe_preferences') return { name: 'list' };
  if (call?.name === 'remove_cafe_preferences' && selected.length) return { name: 'remove', preferences: selected };
  if (call?.name === 'clear_cafe_preferences') return { name: 'clear' };
  return { name: 'none', reply: fallbackText.trim() || '你可以說「設定我的偏好：安靜、有插座」，或說「查看我的偏好」。' };
}

export async function decidePreferenceAction(input: { text: string; preferences: CafePreference[] }): Promise<PreferenceDecision> {
  const response = await ai.models.generateContent({
    model: env.GEMINI_FUNCTION_MODEL,
    contents: [
      'You route explicit Traditional Chinese cafe preference commands.',
      'Only choose a function when the user explicitly asks to set, view, remove, or clear preferences. Never infer preferences from casual conversation.',
      `Current preferences: ${input.preferences.join(', ') || '(none)'}`,
      `User message: ${input.text}`
    ].join('\n'),
    config: { tools: [{ functionDeclarations: declarations }], toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } }, temperature: 0 }
  });
  return parseDecision(response.functionCalls, response.text || '');
}

export const cafePreferenceAgentInternals = { parseDecision };
