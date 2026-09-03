import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
  detectMenuImageMimeType,
  MenuImageTooLargeError,
  readMenuImage,
  UnsupportedMenuImageError
} from './menuImage.js';

test('reads an image stream without changing its bytes', async () => {
  const result = await readMenuImage(
    Readable.from([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0x01])]),
    10
  );

  assert.deepEqual(result, Buffer.from([0xff, 0xd8, 0xff, 0x01]));
});

test('stops reading when an image exceeds the configured limit', async () => {
  await assert.rejects(
    readMenuImage(Readable.from([Buffer.alloc(4), Buffer.alloc(4)]), 7),
    MenuImageTooLargeError
  );
});

test('detects supported menu image formats from magic bytes', () => {
  assert.equal(
    detectMenuImageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    'image/jpeg'
  );
  assert.equal(
    detectMenuImageMimeType(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
    'image/png'
  );
  assert.equal(
    detectMenuImageMimeType(Buffer.from('RIFF0000WEBP', 'ascii')),
    'image/webp'
  );
  assert.equal(
    detectMenuImageMimeType(Buffer.from('0000ftypheic', 'ascii')),
    'image/heic'
  );
});

test('rejects image data with an unknown signature', () => {
  assert.throws(
    () => detectMenuImageMimeType(Buffer.from('not an image')),
    UnsupportedMenuImageError
  );
});
