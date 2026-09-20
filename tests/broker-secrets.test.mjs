import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { brokerSecretsConfigured, decryptBrokerValue, encryptBrokerValue, maskAccountReference } from '../lib/broker-secrets.js';

test('broker values are encrypted at rest with the server auth-secret fallback', () => {
  delete process.env.BROKER_TOKEN_ENCRYPTION_KEY;
  process.env.AUTH_SECRET = randomBytes(48).toString('hex');
  assert.equal(brokerSecretsConfigured(), true);
  const token = encryptBrokerValue({ access: 'secret-token', account: '12345678' });
  assert.equal(token.includes('secret-token'), false);
  assert.deepEqual(decryptBrokerValue(token), { access: 'secret-token', account: '12345678' });
});

test('account references are only exposed in masked form', () => {
  assert.equal(maskAccountReference('123456789'), '••••6789');
  assert.equal(maskAccountReference('1234'), '••••');
  assert.equal(maskAccountReference(''), '');
});
