/**
 * AES-256-GCM token encryption for Jira API tokens.
 * Tokens are encrypted before storage and decrypted only at sync time.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const envKey = process.env.SOULPLAN_ENCRYPTION_KEY;
  if (envKey) {
    // Use a SHA-256 hash of the env key to get exactly 32 bytes
    const { createHash } = require('crypto');
    return createHash('sha256').update(envKey).digest();
  }
  // Fallback: derive a deterministic key from the machine hostname.
  // Not as secure, but avoids crashes when env var is not set.
  const os = require('os');
  const { createHash } = require('crypto');
  return createHash('sha256').update(`soulplan-${os.hostname()}`).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}