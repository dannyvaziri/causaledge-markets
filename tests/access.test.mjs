import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { authorizedUser, isDashboardAuthorized, matchesSecret } from '../lib/access.js';
import { seal, SESSION_COOKIE } from '../lib/session.js';

test('owner sessions protect account access and reject cross-origin writes', () => {
  process.env.AUTH_SECRET = randomBytes(32).toString('hex');
  process.env.APP_URL = 'https://signalforge.example';
  process.env.ALLOWED_GOOGLE_EMAILS = 'owner@example.com';
  const session = (email, exp = Date.now() + 60000) => seal({ email, provider: 'google', exp });
  const request = (token, method = 'GET', origin) => new Request('https://signalforge.example/api/engine', {
    method, headers: { cookie: `${SESSION_COOKIE}=${token}`, ...(origin ? { origin } : {}) },
  });
  const owner = session('owner@example.com');
  assert.equal(isDashboardAuthorized(request(owner)), true);
  assert.equal(isDashboardAuthorized(request(session('stranger@example.com'))), false);
  assert.equal(isDashboardAuthorized(request(session('owner@example.com', Date.now() - 1))), false);
  assert.equal(authorizedUser(request(owner + 'tampered')), null);
  assert.equal(isDashboardAuthorized(request(owner, 'POST', 'https://attacker.example')), false);
  assert.equal(isDashboardAuthorized(request(owner, 'POST')), false);
  assert.equal(isDashboardAuthorized(request(owner, 'POST', process.env.APP_URL)), true);
  process.env.ALLOWED_GOOGLE_EMAILS = '';
  assert.equal(isDashboardAuthorized(request(owner)), false);
  assert.equal(matchesSecret('', ''), false);
  assert.equal(matchesSecret('different', 'secret'), false);
});

test('anonymous requests cannot access broker or classifier routes', async () => {
  for (const [path, method] of [['engine', 'GET'], ['paper-order', 'POST'], ['live-order', 'POST'], ['live-close-all', 'POST'], ['analyze', 'POST'], ['news', 'GET']]) {
    const route = await import(`../app/api/${path}/route.js`);
    const response = await route[method](new Request(`https://signalforge.example/api/${path}`, { method }));
    assert.equal(response.status, 401, path);
  }
});
