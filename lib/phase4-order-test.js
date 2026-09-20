export const PHASE4_TEST_SYMBOL = 'BTC/USD';
export const PHASE4_TEST_NOTIONAL = 1;

export function phase4OrderTestPreconditions({
  liveTrading = false,
  account = null,
  positions = [],
  openOrders = [],
} = {}) {
  const reasons = [];
  if (liveTrading) reasons.push('Live trading is enabled.');
  if (!account || account.status !== 'ACTIVE') reasons.push('Alpaca paper account is not ACTIVE.');
  if (account?.trading_blocked) reasons.push('Alpaca paper trading is blocked.');
  if (Number(account?.cash || 0) < PHASE4_TEST_NOTIONAL) reasons.push('Paper cash is below the $1 validation amount.');
  if (Array.isArray(positions) && positions.length > 0) reasons.push('Existing paper positions must be zero before the controlled round-trip.');
  if (Array.isArray(openOrders) && openOrders.length > 0) reasons.push('Existing open paper orders must be zero before the controlled round-trip.');
  return { approved: reasons.length === 0, reasons };
}
