import { messagingApi } from '@line/bot-sdk';

import { env } from '../utils/env.js';

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN
});

export const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN
});
