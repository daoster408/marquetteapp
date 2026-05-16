import * as Crypto from 'expo-crypto';

const INVITE_SECRET_BYTES = 12;
const INVITE_EXPIRATION_DAYS = 7;

function toBase32(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let bits = 0;
  let value = 0;
  let output = '';

  bytes.forEach(byte => {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  });

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

export function formatInviteCode(coupleId: string, secret: string): string {
  return `${coupleId}.${secret}`;
}

export function parseInviteCode(rawCode: string): { coupleId: string; secret: string } {
  const normalized = rawCode.trim().replace(/\s+/g, '');
  const [coupleId, secret] = normalized.split('.');

  if (!coupleId || !secret || normalized.split('.').length !== 2) {
    throw new Error('Invite code should look like COUPLEID.CODE.');
  }

  return { coupleId, secret: secret.toUpperCase() };
}

export async function hashInviteSecret(coupleId: string, secret: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${coupleId}:${secret.trim().toUpperCase()}`
  );
}

export async function createInviteCode(coupleId: string): Promise<{
  code: string;
  codeId: string;
  codeHash: string;
  expiresAt: Date;
}> {
  const bytes = await Crypto.getRandomBytesAsync(INVITE_SECRET_BYTES);
  const secret = toBase32(bytes).slice(0, 16);
  const codeHash = await hashInviteSecret(coupleId, secret);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  return {
    code: formatInviteCode(coupleId, secret),
    codeId: codeHash.slice(0, 24),
    codeHash,
    expiresAt,
  };
}
