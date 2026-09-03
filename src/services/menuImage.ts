import type { Readable } from 'node:stream';

export class MenuImageTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Menu image exceeds ${maxBytes} bytes`);
    this.name = 'MenuImageTooLargeError';
  }
}

export class UnsupportedMenuImageError extends Error {
  constructor() {
    super('Unsupported menu image format');
    this.name = 'UnsupportedMenuImageError';
  }
}

export async function readMenuImage(
  stream: Readable,
  maxBytes: number
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      stream.destroy();
      throw new MenuImageTooLargeError(maxBytes);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

export function detectMenuImageMimeType(data: Buffer): string {
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return 'image/png';
  }

  if (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp') {
    const brand = data.toString('ascii', 8, 12);

    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) {
      return 'image/heic';
    }

    if (['mif1', 'msf1'].includes(brand)) {
      return 'image/heif';
    }
  }

  throw new UnsupportedMenuImageError();
}
