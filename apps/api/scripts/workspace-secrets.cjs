const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

/*
 * Secrets stored in the control database (a workspace's session signing key and first admin
 * password) are sealed with AES-256-GCM under the control encryption key. The format is
 * "v1.<iv>.<tag>.<ciphertext>" in base64url, so a future key or cipher change can coexist.
 */

const VERSION = 'v1';

function loadKey(encoded) {
  if (typeof encoded !== 'string' || !encoded.trim()) {
    throw new Error('CONTROL_ENCRYPTION_KEY is not configured.');
  }
  const key = Buffer.from(encoded.trim(), 'base64');
  if (key.length !== 32) {
    throw new Error('CONTROL_ENCRYPTION_KEY must be 32 bytes, base64-encoded.');
  }
  return key;
}

function seal(plaintext, encodedKey) {
  const key = loadKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function open(sealed, encodedKey) {
  const key = loadKey(encodedKey);
  const parts = typeof sealed === 'string' ? sealed.split('.') : [];
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('A stored workspace secret is not in a known format.');
  }
  const [, iv, tag, ciphertext] = parts.map((part, index) => (index ? Buffer.from(part, 'base64url') : part));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { seal, open, loadKey };
