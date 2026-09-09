import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBotSymbol, sanitizeBot, sharedRiskLimits } from '../lib/bots.js';

test('normalizes stock and crypto symbols', () => {
  assert.equal(normalizeBotSymbol('aapl', 'stock'), 'AAPL');
  assert.equal(normalizeBotSymbol('btc-usd', 'crypto'), 'BTC/USD');
  assert.throws(() => normalizeBotSymbol('BTCUSD', 'crypto'));
});

test('sanitizes a paused stock bot with bounded risk settings', () => {
  const bot = sanitizeBot({
    name: '  AI momentum  ',
    assetType: 'stock',
    symbol: 'nvda',
    strategy: 'momentum',
    status: 'paused',
    tradeAmount: 100,
    stopLossPct: 99,
    takeProfitPct: 99,
    maxPositions: 99,
    maxDailyLossUsd: 99,
  }, { id: 'bot-test' });
  assert.equal(bot.id, 'bot-test');
  assert.equal(bot.symbol, 'NVDA');
  assert.equal(bot.tradeAmount, 25);
  assert.equal(bot.stopLossPct, 10);
  assert.equal(bot.takeProfitPct, 20);
  assert.equal(bot.maxPositions, 2);
  assert.equal(bot.maxDailyLossUsd, 3);
});

test('supports crypto bots without enabling live trading semantics', () => {
  const bot = sanitizeBot({ assetType: 'crypto', symbol: 'eth/usd', strategy: 'breakout', status: 'running' }, { id: 'crypto-bot' });
  assert.equal(bot.assetType, 'crypto');
  assert.equal(bot.symbol, 'ETH/USD');
  assert.equal(bot.strategy, 'breakout');
  assert.equal(bot.status, 'running');
});

test('shared risk limits stay conservative for a $100 paper account', () => {
  const limits = sharedRiskLimits(100);
  assert.equal(limits.maxOpenPositions, 2);
  assert.equal(limits.maxAggregateExposurePct, 50);
  assert.equal(limits.maxPositionPct, 25);
  assert.equal(limits.maxDailyLossPct, 3);
  assert.equal(limits.maxDailyLossUsd, 3);
  assert.equal(limits.maxOrderNotional, 25);
});
