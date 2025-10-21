import { pbkdf2, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

import { PinHasher } from './types';

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export class CryptoPinHasher implements PinHasher {
  async hash(pin: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await pbkdf2Async(pin, salt, ITERATIONS, KEY_LENGTH, DIGEST);
    return `pbkdf2$${ITERATIONS}$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  async compare(pin: string, hash: string): Promise<boolean> {
    const parts = hash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = Number.parseInt(parts[1]!, 10);
    const salt = Buffer.from(parts[2]!, 'hex');
    const expected = Buffer.from(parts[3]!, 'hex');

    if (!Number.isFinite(iterations) || salt.length === 0 || expected.length === 0) {
      return false;
    }

    const derived = await pbkdf2Async(pin, salt, iterations, expected.length, DIGEST);
    return derived.equals(expected);
  }
}
