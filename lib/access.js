import { timingSafeEqual } from 'node:crypto';
import { appOrigin, readSealedCookie, SESSION_COOKIE } from './session.js';

export function allowedEmail(email) {
  const allowed = String(process.env.ALLOWED_GOOGLE_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(email || '').toLowerCase());
}

export function authorizedUser(request) {
  const user = readSealedCookie(request, SESSION_COOKIE);
  return user?.provider === 'google' && allowedEmail(user.email) ? user : null;
}

export function matchesSecret(actual, expected) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isDashboardAuthorized(request) {
  if (matchesSecret(request.headers.get('x-sf-token'), process.env.DASHBOARD_TOKEN)) return true;
  if (!authorizedUser(request)) return false;
  return ['GET', 'HEAD'].includes(request.method) || request.headers.get('origin') === appOrigin(request);
}
