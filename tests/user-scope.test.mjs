import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryPaperOwnerKey, rowBelongsToUser, userScopeKey } from '../lib/user-scope.js';

test('user scope keys are stable and distinct by signed-in email', () => {
  assert.equal(userScopeKey('USER@example.com'), userScopeKey({ email: 'user@example.com' }));
  assert.notEqual(userScopeKey('one@example.com'), userScopeKey('two@example.com'));
});

test('legacy unscoped bot records only belong to the primary paper owner', () => {
  process.env.ALLOWED_GOOGLE_EMAILS = 'owner@example.com,second@example.com';
  delete process.env.PAPER_ACCOUNT_OWNER_EMAIL;
  const owner = primaryPaperOwnerKey();
  const second = userScopeKey('second@example.com');
  assert.equal(rowBelongsToUser({}, owner), true);
  assert.equal(rowBelongsToUser({}, second), false);
  assert.equal(rowBelongsToUser({ ownerKey: second }, second), true);
  assert.equal(rowBelongsToUser({ ownerKey: second }, owner), false);
});
