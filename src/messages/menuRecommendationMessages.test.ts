import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMenuRecommendationMessages,
  createMenuScanGuideMessage,
  isMenuScanCommand
} from './menuRecommendationMessages.js';

test('recognizes explicit menu scanning commands', () => {
  assert.equal(isMenuScanCommand('拍菜單'), true);
  assert.equal(isMenuScanCommand('  推薦飲品  '), true);
  assert.equal(isMenuScanCommand('找附近咖啡'), false);
});

test('offers camera and camera roll actions in the guide', () => {
  const message = createMenuScanGuideMessage();
  assert.deepEqual(
    (message.quickReply?.items ?? []).flatMap((item) =>
      item.action ? [item.action.type] : []
    ),
    ['camera', 'cameraRoll']
  );
});

test('creates one grounded recommendation card per drink', () => {
  const messages = createMenuRecommendationMessages({
    isMenu: true,
    menuSummary: '看起來是一份咖啡菜單。',
    recommendations: [
      {
        name: '美式咖啡',
        price: '$100',
        reason: '簡單的經典選擇。',
        caffeine: '有咖啡因',
        sweetness: '無法確認'
      },
      {
        name: '紅茶',
        price: '$90',
        reason: '不想喝咖啡時可以考慮。',
        caffeine: '有咖啡因',
        sweetness: '無法確認'
      }
    ],
    caution: '糖量與過敏原請向店員確認。'
  });

  const flex = messages[1];
  assert.equal(flex?.type, 'flex');
  if (flex?.type !== 'flex' || flex.contents.type !== 'carousel') return;
  assert.equal(flex.contents.contents.length, 2);
  assert.match(flex.altText, /美式咖啡/u);
});

test('asks for a clearer image when no menu drinks are available', () => {
  const [message] = createMenuRecommendationMessages({
    isMenu: false,
    menuSummary: '',
    recommendations: [],
    caution: ''
  });

  assert.equal(message?.type, 'text');
  if (message?.type !== 'text') return;
  assert.match(message.text, /看不清楚/u);
});
