'use client';

import { useEffect, useState } from 'react';

const START = 100;
const TARGET = 1000;

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function pct(value) {
  const n = Number(value || 0) * 100;
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export default function Home() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [draftToken, setDraftToken] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  async function request(path = '/api/engine', options = {}) {
    const headers = { ...(options.headers || {}), 'x-sf-token': token };
    const res = await fetch(path, { ...options, headers, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }

  async function refresh(silent = false) {
    if (!token && !user) return;
    if (!silent) setBusy(true);
    try {
      const next = await request();
      setData(next);
      setConnected(true);
      setError('');
    } catch (e) {
      setConnected(false);
      setError(String(e.message || e));
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function action(name) {
    if (!token && !user) return;
    setBusy(true);
    try {
      const next = await request('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: name }),
      });
      setData(next);
      setError('');
      setConnected(true);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' }).then((res) => res.json()).then((session) => setUser(session.user || null)).catch(() => setError('Unable to check sign-in. Please reload.')).finally(() => setCheckingSession(false));
    const authError = new URLSearchParams(window.location.search).get('auth');
    if (authError) setError(authError === 'google-config' ? 'Google sign-in is awaiting server configuration.' : 'Google sign-in could not be completed. Use your authorized account and try again.');
    const saved = window.localStorage.getItem('signalforge-access') || '';
    if (saved) {
      setToken(saved);
      setDraftToken(saved);
    }
  }, []);

  useEffect(() => {
    if (!token && !user) return;
    refresh();
    const timer = window.setInterval(() => refresh(true), 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  function unlock(e) {
    e.preventDefault();
    const next = draftToken.trim();
    if (!next) return;
    window.localStorage.setItem('signalforge-access', next);
    setToken(next);
  }

  async function lock() {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (!res.ok) { setError('Sign-out failed. Please try again.'); return; }
    setUser(null);
    window.localStorage.removeItem('signalforge-access');
    setToken('');
    setDraftToken('');
    setData(null);
    setConnected(false);
    setError('');
  }

  if (checkingSession) return <main className="loginShell"><section className="loginCard"><h1>SignalForge</h1><p>Checking sign-in…</p></section></main>;

  if (!token && !user) {
    return <main className="loginShell">
      <section className="loginCard">
        <div className="logoMark">SF</div>
        <p className="eyebrow">PERSONAL TRADING LAB</p>
        <h1>SignalForge $100 Challenge</h1>
        <p>Autonomous market monitoring and paper trading with hard risk controls. Live-money execution is not enabled in this build.</p>
        {error && <p role="alert">{error}</p>}
        <button className="primary" onClick={() => { window.location.href = "/api/auth/google/start"; }}>Continue with Google</button>
        <details><summary>Use a dashboard access token</summary>
        <form onSubmit={unlock}>
          <label>Dashboard access token</label>
          <input type="password" value={draftToken} onChange={(e) => setDraftToken(e.target.value)} placeholder="Enter your private token" autoComplete="current-password" />
          <button type="submit" className="primary">Open command center</button>
        </form>
        </details>
        <small>Private dashboard access is restricted to the account owner.</small>
      </section>
    </main>;
  }

  const account = data?.account || {};
  const positions = data?.positions || [];
  const logs = data?.logs || [];
  const equity = Number(account.equity || START);
  const start = Number(data?.challenge?.start || START);
  const target = Number(data?.challenge?.target || TARGET);
  const progress = Math.max(0, Math.min(100, ((equity - start) / Math.max(target - start, 1)) * 100));
  const returnPct = start ? ((equity - start) / start) * 100 : 0;
  const safe = data?.safety || {};

  return <main className="appShell">
    <header className="topbar">
      <div className="brand">
        <div className="logoMark small">SF</div>
        <div><strong>SignalForge</strong><span>$100 → $1,000 CHALLENGE</span></div>
      </div>
      <div className="topActions">
        <span className={`statusPill ${connected ? 'ok' : 'bad'}`}>{connected ? 'CONNECTED' : 'OFFLINE'}</span>
        <span className="statusPill paper">PAPER</span>
        <button className="quiet" onClick={lock}>Sign out</button>
      </div>
    </header>

    <section className="heroCard">
      <div>
        <p className="eyebrow">CHALLENGE BALANCE</p>
        <h1>{money(equity)}</h1>
        <div className={`return ${returnPct >= 0 ? 'positive' : 'negative'}`}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}% from {money(start)}</div>
      </div>
      <div className="goalBlock">
        <div className="goalLine"><span>{money(start)}</span><b>{progress.toFixed(1)}%</b><span>{money(target)}</span></div>
        <div className="progress"><div style={{ width: `${progress}%` }} /></div>
        <small>{money(Math.max(target - equity, 0))} remaining to target</small>
      </div>
    </section>

    {error && <div className="alert"><b>System message</b><span>{error}</span></div>}

    <section className="metrics">
      <Metric label="Cash" value={money(account.cash)} />
      <Metric label="Today" value={money(account.dayPnl)} tone={Number(account.dayPnl) >= 0 ? 'positive' : 'negative'} />
      <Metric label="Open positions" value={positions.length} />
      <Metric label="Max position" value={money(data?.challenge?.maxOrder)} />
      <Metric label="Daily stop" value={money(data?.challenge?.dailyLossLimit)} />
      <Metric label="Engine" value={data?.engine?.paused ? 'PAUSED' : data?.engine?.enabled ? 'ARMED' : 'OFF'} tone={data?.engine?.paused ? 'warning' : data?.engine?.enabled ? 'positive' : ''} />
    </section>

    <section className="controlBar">
      <div>
        <p className="eyebrow">AUTONOMOUS ENGINE</p>
        <h2>{data?.engine?.paused ? 'Paused' : data?.engine?.enabled ? 'Monitoring the market' : 'Execution disabled'}</h2>
        <p>News → AI catalyst score → market confirmation → deterministic risk gate → Alpaca paper order.</p>
      </div>
      <div className="controls">
        <button className="primary" disabled={busy || !safe.paperExecution || data?.engine?.paused} onClick={() => action('run')}>{busy ? 'Working…' : 'Run cycle now'}</button>
        {data?.engine?.paused
          ? <button disabled={busy} onClick={() => action('resume')}>Resume</button>
          : <button disabled={busy} onClick={() => action('pause')}>Pause</button>}
        <button className="danger" disabled={busy || !positions.length} onClick={() => action('close-all')}>Close paper positions</button>
      </div>
    </section>

    <div className="grid2">
      <section className="panel">
        <PanelHead title="Risk guardrails" sub="Hard-coded controls win over the AI every time" />
        <div className="riskList">
          <Risk label="Live-money endpoint" value="Not present" good />
          <Risk label="Paper execution" value={safe.paperExecution ? 'Enabled' : 'Disabled'} good={safe.paperExecution} />
          <Risk label="Auto execution" value={safe.autoExecution ? 'Enabled' : 'Disabled'} good={safe.autoExecution} />
          <Risk label="Kill switch" value={safe.killSwitch ? 'ACTIVE' : 'Clear'} good={!safe.killSwitch} />
          <Risk label="Max positions" value={String(data?.challenge?.maxPositions ?? 2)} good />
          <Risk label="AI threshold" value={`${data?.challenge?.minConfidence ?? 90}% confidence`} good />
        </div>
      </section>

      <section className="panel">
        <PanelHead title="Open positions" sub="Fractional long positions only" />
        {positions.length ? <div className="tableWrap"><table><thead><tr><th>Symbol</th><th>Value</th><th>P&L</th><th>Return</th></tr></thead><tbody>
          {positions.map((p) => <tr key={p.symbol}><td><b>{p.symbol}</b></td><td>{money(p.marketValue)}</td><td className={Number(p.unrealizedPnl) >= 0 ? 'positive' : 'negative'}>{money(p.unrealizedPnl)}</td><td className={Number(p.unrealizedPlpc) >= 0 ? 'positive' : 'negative'}>{pct(p.unrealizedPlpc)}</td></tr>)}
        </tbody></table></div> : <div className="empty">No open paper positions.</div>}
      </section>
    </div>

    <section className="panel logPanel">
      <PanelHead title="Decision journal" sub="Most recent autonomous engine events" />
      {logs.length ? <div className="logList">{logs.map((log, index) => <div className="logRow" key={`${log.time}-${index}`}><time>{new Date(log.time).toLocaleString()}</time><span className={`logType ${String(log.type || '').toLowerCase()}`}>{log.type}</span><div><b>{log.symbol || 'SYSTEM'}</b><p>{log.message}</p></div></div>)}</div> : <div className="empty">No engine decisions recorded in this process yet.</div>}
    </section>

    <footer>
      <span>SignalForge personal experiment</span>
      <span>Paper trading only · no margin · no shorts · no options · no leveraged ETFs</span>
    </footer>
  </main>;
}

function Metric({ label, value, tone = '' }) {
  return <div className="metric"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function PanelHead({ title, sub }) {
  return <div className="panelHead"><div><h3>{title}</h3><p>{sub}</p></div></div>;
}

function Risk({ label, value, good }) {
  return <div className="riskRow"><span>{label}</span><b className={good ? 'positive' : 'warning'}>{value}</b></div>;
}
