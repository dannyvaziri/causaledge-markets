'use client';

import { useCallback, useEffect, useState } from 'react';

function timeLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function RobinhoodConnectionCard({ api }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await api('/api/broker/robinhood/status');
      setStatus(result);
      setError('');
    } catch (caught) {
      setError(String(caught?.message || caught));
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const verify = async () => {
    setBusy('verify');
    try {
      await api('/api/broker/robinhood/verify', { method: 'POST' });
      await load();
    } catch (caught) {
      setError(String(caught?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Robinhood Agentic from this CausalEdge user? This does not close the Robinhood account.')) return;
    setBusy('disconnect');
    try {
      await api('/api/broker/robinhood/disconnect', { method: 'POST' });
      await load();
    } catch (caught) {
      setError(String(caught?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const accounts = status?.agenticAccounts || [];
  return <section className="ceCard ceBrokerCard">
    <div className="ceCardTitle">
      <div><p className="ceEyebrow">USER BROKER CONNECTION</p><h2>Robinhood Agentic Trading</h2></div>
      <span className={status?.connected ? 'ceConnected' : 'cePaperPill'}>{status?.connected ? '● CONNECTED' : 'NOT CONNECTED'}</span>
    </div>
    <p className="ceTradeHint">Each signed-in CausalEdge user authorizes their own Robinhood account through Robinhood’s official Trading MCP. Tokens stay encrypted on the server and are never shared between users.</p>
    {error && <div className="ceTradeResult error">{error}</div>}
    {!status ? <div className="ceEmpty"><b>Checking Robinhood connection…</b></div> : status.connected ? <>
      <div className="ceContextList">
        <span><small>Connection</small><b>User-specific OAuth</b></span>
        <span><small>Last verified</small><b>{timeLabel(status.verifiedAt)}</b></span>
        <span><small>MCP tools visible</small><b>{status.toolCount || 0}</b></span>
        <span><small>CausalEdge Robinhood trading</small><b>Disabled</b></span>
      </div>
      {accounts.length ? <div className="ceHoldingsTable compact">{accounts.map((account, index) => <div key={`${account.maskedAccount}-${index}`}><span><b>{account.maskedAccount || 'Robinhood account'}</b><small>{account.accountType || 'Brokerage'}</small></span><span><b>{account.agenticAllowed ? 'Agentic' : 'Read only'}</b><small>{account.status || 'Connected'}</small></span></div>)}</div> : <div className="ceEmpty"><b>Robinhood authorization is connected.</b><span>Use Verify to refresh the MCP tool list and Agentic-account summary.</span></div>}
      <div className="ceBotActions"><button className="ceSecondary" disabled={Boolean(busy)} onClick={verify}>{busy === 'verify' ? 'Verifying…' : 'Verify connection'}</button><button className="ceTextButton" disabled={Boolean(busy)} onClick={disconnect}>{busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}</button></div>
    </> : <>
      <div className="ceConnectionCheck"><span>○</span><div><b>Connect this user’s Robinhood Agentic account</b><small>Robinhood handles login, consent, MFA and Agentic-account onboarding on its own site.</small></div></div>
      {!status.connectionEnabled || !status.encryptionConfigured ? <div className="ceTradeResult error">Server-side Robinhood connection support is not fully configured yet.</div> : <button className="cePrimary" onClick={() => { window.location.href = '/api/broker/robinhood/start'; }}>Connect Robinhood Agentic</button>}
    </>}
    <p className="ceFinePrint">Phase 3 connection is read/verify only inside CausalEdge. No Robinhood order tool is called, and live-money automation remains disabled.</p>
  </section>;
}
