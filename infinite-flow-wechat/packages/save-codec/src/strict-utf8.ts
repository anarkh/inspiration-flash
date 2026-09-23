export type StrictUtf8DecodeResult = Readonly<{
  text: string;
  hadBom: boolean;
}>;

export class StrictUtf8DecodeError extends Error {
  readonly byteOffset: number;

  constructor(byteOffset: number, message: string) {
    super(`${message} at byte ${byteOffset}`);
    this.name = 'StrictUtf8DecodeError';
    this.byteOffset = byteOffset;
  }
}

function continuation(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined || (value & 0xc0) !== 0x80) {
    throw new StrictUtf8DecodeError(index, 'Expected a UTF-8 continuation byte');
  }
  return value;
}

/**
 * Strict RFC 3629 UTF-8 decoder. It rejects truncated sequences, overlong forms,
 * UTF-16 surrogate code points, and values above U+10FFFF. A single leading
 * UTF-8 BOM is accepted and reported but excluded from the JSON text.
 */
export function decodeStrictUtf8(bytes: Uint8Array): StrictUtf8DecodeResult {
  const hadBom =
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf;
  let index = hadBom ? 3 : 0;
  const chunks: string[] = [];

  while (index < bytes.length) {
    const first = bytes[index];
    if (first === undefined) break;

    if (first <= 0x7f) {
      chunks.push(String.fromCodePoint(first));
      index += 1;
      continue;
    }

    if (first >= 0xc2 && first <= 0xdf) {
      const second = continuation(bytes, index + 1);
      chunks.push(String.fromCodePoint(((first & 0x1f) << 6) | (second & 0x3f)));
      index += 2;
      continue;
    }

    if (first >= 0xe0 && first <= 0xef) {
      const second = continuation(bytes, index + 1);
      const third = continuation(bytes, index + 2);
      if (first === 0xe0 && second < 0xa0) {
        throw new StrictUtf8DecodeError(index, 'Overlong three-byte UTF-8 sequence');
      }
      if (first === 0xed && second >= 0xa0) {
        throw new StrictUtf8DecodeError(index, 'UTF-8 cannot encode UTF-16 surrogates');
      }
      const codePoint =
        ((first & 0x0f) << 12) |
        ((second & 0x3f) << 6) |
        (third & 0x3f);
      chunks.push(String.fromCodePoint(codePoint));
      index += 3;
      continue;
    }

    if (first >= 0xf0 && first <= 0xf4) {
      const second = continuation(bytes, index + 1);
      const third = continuation(bytes, index + 2);
      const fourth = continuation(bytes, index + 3);
      if (first === 0xf0 && second < 0x90) {
        throw new StrictUtf8DecodeError(index, 'Overlong four-byte UTF-8 sequence');
      }
      if (first === 0xf4 && second > 0x8f) {
        throw new StrictUtf8DecodeError(index, 'UTF-8 code point exceeds U+10FFFF');
      }
      const codePoint =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);
      chunks.push(String.fromCodePoint(codePoint));
      index += 4;
      continue;
    }

    throw new StrictUtf8DecodeError(index, `Invalid UTF-8 leading byte 0x${first.toString(16)}`);
  }

  return { text: chunks.join(''), hadBom };
}
