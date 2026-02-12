import crypto from 'node:crypto';

const SHORT_ID_LENGTH = 7;

export function generateShortId(): string {
  return crypto.randomBytes(4).toString('base64url').slice(0, SHORT_ID_LENGTH);
}
