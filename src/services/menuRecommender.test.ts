import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINE_CHANNEL_SECRET = 'test-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

const { menuRecommenderInternals } = await import('./menuRecommender.js');

test('parses and limits grounded menu recommendations', () => {
  const analysis = menuRecommenderInternals.parseMenuAnalysis(JSON.stringify({
    isMenu: true,
    menuSummary: '  咖啡與茶飲菜單  ',
    recommendations: [
      {
        name: '美式咖啡',
        price: '$100',
        reason: '菜單中價格清楚的經典選擇。',
        caffeine: '有咖啡因',
        sweetness: '無法確認'
      },
      {
        name: '紅茶',
        price: '',
        reason: '想喝茶類時可以考慮。',
        caffeine: '',
        sweetness: ''
      },
      {
        name: '拿鐵',
        price: '$140',
        reason: '含有牛奶的咖啡選擇。',
        caffeine: '有咖啡因',
        sweetness: '無法確認'
      },
      {
        name: '不應出現的第四杯',
        price: '$999',
        reason: '超過上限。',
        caffeine: '無法確認',
        sweetness: '無法確認'
      }
    ],
    caution: ''
  }));

  assert.equal(analysis.isMenu, true);
  assert.equal(analysis.menuSummary, '咖啡與茶飲菜單');
  assert.equal(analysis.recommendations.length, 3);
  assert.equal(analysis.recommendations[1]?.price, '菜單未清楚標示');
  assert.equal(analysis.recommendations[1]?.caffeine, '無法確認');
  assert.match(analysis.caution, /過敏原/u);
});

test('does not return recommendations when the image is not a menu', () => {
  const analysis = menuRecommenderInternals.parseMenuAnalysis(JSON.stringify({
    isMenu: false,
    menuSummary: '這是一張風景照',
    recommendations: [{
      name: '虛構飲品',
      price: '$1',
      reason: '不應被保留',
      caffeine: '未知',
      sweetness: '未知'
    }],
    caution: '請重新拍攝'
  }));

  assert.deepEqual(analysis.recommendations, []);
});
