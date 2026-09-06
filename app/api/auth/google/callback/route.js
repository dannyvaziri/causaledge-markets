import { allowedEmail } from '../../../../../lib/access.js';
import { appOrigin, clearCookie, cookie, GOOGLE_STATE_COOKIE, parseCookies, redirect, seal, SESSION_COOKIE } from '../../../../../lib/session.js';

export async function GET(request) {
  const origin = appOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = parseCookies(request)[GOOGLE_STATE_COOKIE];

  if (!code || !state || !savedState || state !== savedState) {
    return redirect(`${origin}/?auth=google-error`, [clearCookie(GOOGLE_STATE_COOKIE)]);
  }

  try {
    const callback = `${origin}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: callback,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });

    if (!tokenRes.ok) throw new Error('Google token exchange failed.');
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error('Google returned no access token.');

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    });
    if (!userRes.ok) throw new Error('Google user profile request failed.');
    const profile = await userRes.json();
    if (!profile.sub || !profile.email || profile.email_verified !== true || !allowedEmail(profile.email)) throw new Error('Google profile is incomplete.');

    const session = seal({
      id: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture || '',
      provider: 'google',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return redirect(`${origin}/?welcome=1`, [
      cookie(SESSION_COOKIE, session),
      clearCookie(GOOGLE_STATE_COOKIE),
    ]);
  } catch {
    return redirect(`${origin}/?auth=google-error`, [clearCookie(GOOGLE_STATE_COOKIE)]);
  }
}
