import crypto from 'node:crypto';

function rawKey() {
  const value = String(process.env.BROKER_TOKEN_ENCRYPTION_KEY || '');
  if (value.length < 32) throw new Error('BROKER_TOKEN_ENCRYPTION_KEY must be configured with at least 32 characters.');
  return crypto.createHash('sha256').update(value).digest();
}

export function brokerSecretsConfigured() {
  return String(process.env.BROKER_TOKEN_ENCRYPTION_KEY || '').length >= 32;
}

export function encryptBrokerValue(value) {
  if (value == null || value === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', rawKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptBrokerValue(token) {
  if (!token) return null;
  const [version, iv64, tag64, encrypted64] = String(token).split('.');
  if (version !== 'v1' || !iv64 || !tag64 || !encrypted64) throw new Error('Invalid encrypted broker value.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', rawKey(), Buffer.from(iv64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag64, 'base64url'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted64, 'base64url')), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function maskAccountReference(value = '') {
  const text = String(value || '').replace(/\s+/g, '');
  if (!text) return '';
  if (text.length <= 4) return '••••';
  return `••••${text.slice(-4)}`;
}
