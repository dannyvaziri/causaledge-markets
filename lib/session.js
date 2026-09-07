import crypto from 'node:crypto';

export const SESSION_COOKIE = 'ce_session';
export const BROKER_COOKIE = 'ce_broker';
export const AUTO_COOKIE = 'ce_auto';
export const GOOGLE_STATE_COOKIE = 'ce_google_state';
export const ALPACA_STATE_COOKIE = 'ce_alpaca_state';

function secret() {
  return String(process.env.AUTH_SECRET || '');
}

function key() {
  if (!secret()) throw new Error('AUTH_SECRET is not configured.');
  return crypto.createHash('sha256').update(secret()).digest();
}

export function randomState() {
  return crypto.randomBytes(24).toString('base64url');
}

export function appOrigin(request) {
  return String(process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
}

export function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  return Object.fromEntries(raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const i = part.indexOf('=');
    const name = i >= 0 ? part.slice(0, i) : part;
    const value = i >= 0 ? part.slice(i + 1) : '';
    try { return [name, decodeURIComponent(value)]; } catch { return [name, value]; }
  }));
}

export function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function unseal(token) {
  try {
    const [version, iv64, tag64, encrypted64] = String(token || '').split('.');
    if (version !== 'v1' || !iv64 || !tag64 || !encrypted64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag64, 'base64url'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted64, 'base64url')), decipher.final()]);
    const value = JSON.parse(decrypted.toString('utf8'));
    if (value?.exp && Date.now() > Number(value.exp)) return null;
    return value;
  } catch {
    return null;
  }
}

export function readSealedCookie(request, name) {
  const value = parseCookies(request)[name];
  return value ? unseal(value) : null;
}

export function cookie(name, value, maxAge = 60 * 60 * 24 * 7) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function redirect(location, setCookies = []) {
  const headers = new Headers({ Location: location });
  for (const c of setCookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}
