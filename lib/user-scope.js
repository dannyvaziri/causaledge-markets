import crypto from 'node:crypto';

export function normalizedEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function userScopeKey(userOrEmail) {
  const email = normalizedEmail(typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email);
  if (!email) throw new Error('A signed-in user email is required.');
  return crypto.createHash('sha256').update(`google:${email}`).digest('hex');
}

export function primaryPaperOwnerEmail() {
  const explicit = normalizedEmail(process.env.PAPER_ACCOUNT_OWNER_EMAIL || '');
  if (explicit) return explicit;
  return normalizedEmail(String(process.env.ALLOWED_GOOGLE_EMAILS || '').split(',')[0] || '');
}

export function primaryPaperOwnerKey() {
  const email = primaryPaperOwnerEmail();
  return email ? userScopeKey(email) : '';
}

export function rowBelongsToUser(metadata = {}, ownerKey) {
  const scoped = String(metadata?.ownerKey || '');
  if (scoped) return scoped === ownerKey;
  return Boolean(ownerKey && ownerKey === primaryPaperOwnerKey());
}
