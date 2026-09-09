'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import IntelligenceCommandCenter from './IntelligenceCommandCenter';
import MultiBotWorkspace from './MultiBotWorkspace';
import { money, pct, shortTime, typeLabel } from '../lib/format.js';

const PROFILE_KEY = 'causaledge-investor-profile-v1';
const SYMBOL_OPTIONS = [
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'NVIDIA'], ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet'], ['META', 'Meta'], ['TSLA', 'Tesla'], ['AMD', 'AMD'], ['SPY', 'S&P 500 ETF'], ['QQQ', 'Nasdaq 100 ETF'], ['VTI', 'Total Market ETF'], ['SCHD', 'Dividend ETF'],
  ['BTC/USD', 'Bitcoin'], ['ETH/USD', 'Ethereum'], ['SOL/USD', 'Solana'], ['DOGE/USD', 'Dogecoin'], ['AVAX/USD', 'Avalanche'], ['LINK/USD', 'Chainlink']
];
const QUICK_QUESTIONS = [
  'What moved my paper portfolio today?',
  'What do my active bots plan to check next?',
  'What global events matter most to my holdings?',
  'Explain my biggest risk in plain English.',
];

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Onboarding({ brokerConnected, onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ goal: 'Learn with paper investing', target: '1000', horizon: '5-10 years', risk: 'Moderate', monthly: '100' });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const finish = () => onComplete({ ...form, target: Math.max(safeNumber(form.target, 1000), 1), monthly: Math.max(safeNumber(form.monthly, 0), 0), createdAt: new Date().toISOString() });
  return <main className="ceOnboarding"><section className="ceOnboardCard"><div className="ceOnboardBrand"><span>CE</span><div><b>CausalEdge Markets</b><small>Paper automation with account-level guardrails.</small></div></div><div className="ceStepTrack"><i className={step >= 1 ? 'on' : ''}/><i className={step >= 2 ? 'on' : ''}/><i className={step >= 3 ? 'on' : ''}/></div>
    {step === 1 && <div className="ceOnboardBody"><p className="ceEyebrow">STEP 1 OF 3</p><h1>What are you using CausalEdge for?</h1><p>This organizes your dashboard. It never authorizes live trading.</p><div className="ceChoiceGrid">{['Learn with paper investing','Build long-term wealth','Test automated strategies','Understand market risk'].map((goal) => <button key={goal} className={form.goal === goal ? 'selected' : ''} onClick={() => update('goal', goal)}>{goal}</button>)}</div><label className="ceField"><span>Paper goal value</span><div><b>$</b><input inputMode="decimal" value={form.target} onChange={(event) => update('target', event.target.value.replace(/[^0-9.]/g, ''))}/></div></label></div>}
    {step === 2 && <div className="ceOnboardBody"><p className="ceEyebrow">STEP 2 OF 3</p><h1>Set your risk context.</h1><p>Bot-level settings can be stricter, but shared account limits always win.</p><label className="ceField"><span>Time horizon</span><select value={form.horizon} onChange={(event) => update('horizon', event.target.value)}><option>Under 3 years</option><option>3-5 years</option><option>5-10 years</option><option>10+ years</option></select></label><div className="ceRiskChoices">{[['Lower','Prefer smaller swings'],['Moderate','Balance testing and caution'],['High','Accept larger paper volatility']].map(([risk, copy]) => <button key={risk} className={form.risk === risk ? 'selected' : ''} onClick={() => update('risk', risk)}><b>{risk}</b><small>{copy}</small></button>)}</div></div>}
    {step === 3 && <div className="ceOnboardBody"><p className="ceEyebrow">STEP 3 OF 3</p><h1>Confirm your paper workspace.</h1><p>Multiple bots share one account, so combined exposure and daily-loss limits apply across all of them.</p><label className="ceField"><span>Monthly amount to plan around</span><div><b>$</b><input inputMode="decimal" value={form.monthly} onChange={(event) => update('monthly', event.target.value.replace(/[^0-9.]/g, ''))}/></div></label><div className="ceConnectionCheck"><span className={brokerConnected ? 'ok' : ''}>{brokerConnected ? '✓' : '○'}</span><div><b>{brokerConnected ? 'Alpaca paper account connected' : 'Paper broker not connected yet'}</b><small>{brokerConnected ? 'Your account can power bot monitoring and paper-only testing.' : 'Connect a paper account before bot testing.'}</small></div></div></div>}
    <div className="ceOnboardActions"><button className="ceSecondary" onClick={() => step === 1 ? finish() : setStep((value) => value - 1)}>{step === 1 ? 'Use defaults' : 'Back'}</button><button className="cePrimary" onClick={() => step === 3 ? finish() : setStep((value) => value + 1)}>{step === 3 ? 'Open workspace' : 'Continue'}</button></div><small className="ceFinePrint">Paper trading only. Live-money trading remains disabled.</small></section></main>;
}

function Header({ tab, setTab, user, onLock }) {
  const nav = [['home','Home'],['invest','Invest'],['ai','AI'],['activity','Activity']];
  return <header className="ceHeader"><button className="ceBrand" onClick={() => setTab('home')}><span>CE</span><div><b>CausalEdge</b><small>Markets</small></div></button><nav className="ceDesktopNav">{nav.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav><div className="ceHeaderRight"><span className="cePaperPill">PAPER</span><button className="ceAccountButton" title={user?.email || 'Account'} onClick={onLock}>{user?.picture ? <img src={user.picture} alt=""/> : <span>{String(user?.name || user?.email || 'U').slice(0,1).toUpperCase()}</span>}<b>Sign out</b></button></div></header>;
}

function MobileNav({ tab, setTab }) {
  const nav = [['home','⌂','Home'],['invest','◈','Invest'],['ai','✦','AI'],['activity','↗','Activity']];
  return <nav className="ceMobileNav">{nav.map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
}

export default function ConsumerApp({ token, user, onLock }) {
  const [tab, setTab] = useState('home');
  const [intelligence, setIntelligence] = useState(false);
  const [engine, setEngine] = useState(null);
  const [intel, setIntel] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Ask me about your paper account, market risk, or what your bots are designed to check. I cannot enable live trading.' }]);
  const [manualSymbol, setManualSymbol] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualSide, setManualSide] = useState('BUY');
  const [manualAsset, setManualAsset] = useState('stock');
  const [manualOrder, setManualOrder] = useState(null);

  const headers = useCallback((extra = {}) => ({ ...extra, ...(token ? { 'x-ce-token': token } : {}) }), [token]);
  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: headers(options.headers || {}), cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.detail || `Request failed (${response.status})`);
    return body;
  }, [headers]);

  const refresh = useCallback(async () => {
    try {
      const [engineData, intelData] = await Promise.all([api('/api/engine'), api('/api/intel')]);
      setEngine(engineData); setIntel(intelData); setError('');
    } catch (caught) { setError(String(caught?.message || caught)); }
  }, [api]);

  useEffect(() => {
    try { const saved = localStorage.getItem(PROFILE_KEY); setProfile(saved ? JSON.parse(saved) : null); } catch { setProfile(null); }
    setProfileReady(true); refresh(); const timer = setInterval(refresh, 60000); return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [tab]);

  const saveProfile = (next) => { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); setProfile(next); };
  const loadBriefing = async () => {
    setBusy('briefing');
    try { const result = await api('/api/briefing', { method: 'POST' }); setBriefing(result); setError(''); }
    catch (caught) { setError(String(caught?.message || caught)); }
    finally { setBusy(''); }
  };
  const askCopilot = async (prompt) => {
    const text = String(prompt || question).trim(); if (!text) return;
    setQuestion(''); setMessages((items) => [...items, { role: 'user', text }]); setBusy('copilot');
    try {
      const result = await api('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, profile, portfolio: engine }) });
      setMessages((items) => [...items, { role: 'assistant', text: result.answer, keyPoints: result.keyPoints, risks: result.risks, provider: result.provider }]);
    } catch (caught) { setMessages((items) => [...items, { role: 'assistant', text: `I could not complete that analysis: ${caught?.message || caught}` }]); }
    finally { setBusy(''); }
  };

  const submitManualOrder = async (event) => {
    event.preventDefault();
    const symbol = manualAsset === 'crypto' ? manualSymbol.trim().toUpperCase().replace('-', '/') : manualSymbol.trim().toUpperCase();
    const amount = Number(manualAmount);
    const valid = manualAsset === 'crypto' ? /^[A-Z]{2,8}\/[A-Z]{2,8}$/.test(symbol) : /^[A-Z.]{1,10}$/.test(symbol);
    if (!valid || !Number.isFinite(amount) || amount <= 0) { setManualOrder({ ok: false, message: 'Check the symbol/pair and amount.' }); return; }
    setBusy('manual-order'); setManualOrder(null);
    try {
      const result = await api('/api/paper-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manualSide === 'BUY' ? { symbol, assetType: manualAsset, side: manualSide, notional: amount, source: 'manual' } : { symbol, assetType: manualAsset, side: manualSide, qty: amount, source: 'manual' }) });
      setManualOrder({ ok: true, message: `${manualSide} paper order submitted for ${symbol}. Status: ${result.order?.status || 'accepted'}.` }); setManualAmount(''); await refresh();
    } catch (caught) { setManualOrder({ ok: false, message: caught?.message || 'The paper order was rejected.' }); }
    finally { setBusy(''); }
  };

  const account = engine?.account || {};
  const positions = engine?.positions || [];
  const events = intel?.events || [];
  const equity = safeNumber(account.equity);
  const target = Math.max(safeNumber(profile?.target, engine?.challenge?.target || 1000), 1);
  const progress = Math.max(0, Math.min(100, equity / target * 100));
  const firstName = String(user?.name || user?.email || 'there').split(/[ @]/)[0];
  const suggestions = useMemo(() => {
    const query = manualSymbol.trim().toLowerCase();
    return SYMBOL_OPTIONS.filter(([symbol, name]) => (manualAsset === 'crypto') === symbol.includes('/') && (!query || symbol.toLowerCase().includes(query) || name.toLowerCase().includes(query))).slice(0, 6);
  }, [manualAsset, manualSymbol]);

  if (!profileReady) return <main className="ceLoading">Preparing your paper workspace…</main>;
  if (!profile) return <Onboarding brokerConnected={Boolean(engine?.safety?.brokerConfigured)} onComplete={saveProfile}/>;
  if (intelligence) return <div className="ceIntelMode"><button className="ceIntelBack" onClick={() => setIntelligence(false)}>← Back to investing</button><IntelligenceCommandCenter token={token} user={user} onLock={onLock}/></div>;

  return <main className="ceApp"><Header tab={tab} setTab={setTab} user={user} onLock={onLock}/>{error && <div className="ceError"><b>Connection notice</b><span>{error}</span><button onClick={() => setError('')}>×</button></div>}<div className="cePage">
    {tab === 'home' && <><section className="ceWelcome"><div><p className="ceEyebrow">YOUR PAPER ACCOUNT</p><h1>Hi {firstName}. See every bot without the complexity.</h1><p>{profile.goal} · {profile.risk} risk context · live-money trading disabled</p></div><button className="cePrimary" onClick={loadBriefing} disabled={busy === 'briefing'}>{busy === 'briefing' ? 'Building brief…' : 'Get today’s edge'}</button></section>
      <section className="ceHeroGrid"><div className="cePortfolioHero"><div className="ceHeroTop"><span>Paper portfolio</span><span className="ceConnected">{engine?.safety?.brokerConfigured ? '● Alpaca connected' : '○ Broker unavailable'}</span></div><strong>{money(equity)}</strong><div className={safeNumber(account.dayPnl) >= 0 ? 'ceGain' : 'ceLoss'}>{safeNumber(account.dayPnl) >= 0 ? '+' : ''}{money(account.dayPnl || 0)} today</div><div className="ceGoalLine"><span>Goal</span><b>{Math.round(progress)}%</b></div><div className="ceGoalTrack"><i style={{ width: `${progress}%` }}/></div><div className="ceHeroStats"><span><small>Target</small><b>{money(target)}</b></span><span><small>Buying power</small><b>{money(account.buyingPower || account.cash || 0)}</b></span><span><small>Positions</small><b>{positions.length}</b></span></div></div>
      <div className="ceEdgeCard"><div className="ceCardTitle"><div><p className="ceEyebrow">TODAY’S EDGE</p><h2>{briefing?.headline || 'Market context for your paper account'}</h2></div>{briefing?.provider && <span className="ceAiBadge">{String(briefing.provider).toUpperCase()} AI</span>}</div><p>{briefing?.summary || 'Generate a briefing to connect market moves and global events to your account.'}</p>{briefing?.items?.length ? <div className="ceEdgeItems">{briefing.items.slice(0,3).map((item, index) => <div key={`${item.title}-${index}`}><span>{index + 1}</span><div><b>{item.title}</b><small>{item.why}</small></div></div>)}</div> : <button className="ceTextButton" onClick={loadBriefing}>Create briefing →</button>}</div></section>
      <MultiBotWorkspace api={api} compact onOpenWorkspace={() => setTab('invest')}/>
      <section className="ceTwoCol"><div className="ceCard"><div className="ceCardTitle"><div><p className="ceEyebrow">CURRENT HOLDINGS</p><h2>Broker exposure</h2></div><button className="ceTextButton" onClick={() => setTab('activity')}>See details</button></div>{positions.length ? <div className="ceHoldingsTable compact">{positions.slice(0,6).map((position) => <div key={position.symbol}><span><b>{position.symbol}</b><small>{safeNumber(position.qty)} units</small></span><span><b>{money(position.marketValue)}</b><small className={safeNumber(position.unrealizedPnl) >= 0 ? 'ceGain' : 'ceLoss'}>{money(position.unrealizedPnl)}</small></span></div>)}</div> : <div className="ceEmpty"><b>No open positions.</b><span>Bots can still monitor while execution is locked.</span></div>}</div><div className="ceCard"><div className="ceCardTitle"><div><p className="ceEyebrow">CAUSAL INTELLIGENCE</p><h2>Events worth knowing</h2></div><button className="ceTextButton" onClick={() => setIntelligence(true)}>Advanced view</button></div>{events.length ? <div className="ceEventList">{events.slice(0,4).map((event) => <div key={event.id}><span className={`ceSeverity s${event.severity}`}/><div><b>{event.title}</b><small>{typeLabel(event.type)} · {shortTime(event.timestamp)}</small></div></div>)}</div> : <div className="ceEmpty"><b>No priority events right now.</b></div>}</div></section>
    </>}

    {tab === 'invest' && <><section className="ceSectionHead"><div><p className="ceEyebrow">INVEST</p><h1>Manual paper orders and independent bots.</h1><p>The bot workspace is paper-only. Shared account risk overrides every bot-level setting.</p></div><button className="ceSecondary" onClick={() => { localStorage.removeItem(PROFILE_KEY); setProfile(null); }}>Update goals</button></section>
      <section className="ceCard ceTradeCard"><div className="ceCardTitle"><div><p className="ceEyebrow">GUARDED MANUAL TRADE</p><h2>Stock or crypto paper order</h2></div><span className="cePaperPill">PAPER ONLY</span></div><form className="ceTradeForm" onSubmit={submitManualOrder}><label><span>Asset</span><select value={manualAsset} onChange={(event) => { setManualAsset(event.target.value); setManualSymbol(''); }}><option value="stock">Stock</option><option value="crypto">Crypto</option></select></label><label className="ceSymbolField"><span>Symbol / pair</span><input value={manualSymbol} onChange={(event) => setManualSymbol(event.target.value.toUpperCase())} placeholder={manualAsset === 'crypto' ? 'BTC/USD' : 'AAPL'} maxLength={17}/>{suggestions.length > 0 && manualSymbol && <div className="ceSymbolSuggestions">{suggestions.map(([symbol, name]) => <button type="button" key={symbol} onClick={() => setManualSymbol(symbol)}><b>{symbol}</b><span>{name}</span></button>)}</div>}</label><label><span>Action</span><select value={manualSide} onChange={(event) => setManualSide(event.target.value)}><option value="BUY">Buy</option><option value="SELL">Sell</option></select></label><label><span>{manualSide === 'BUY' ? 'Dollars' : 'Quantity'}</span><input type="number" min="0.0001" step="0.0001" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)}/></label><button className="cePrimary" disabled={busy === 'manual-order'}>{busy === 'manual-order' ? 'Submitting…' : `${manualSide === 'BUY' ? 'Buy' : 'Sell'} in paper`}</button></form>{manualOrder && <div className={manualOrder.ok ? 'ceTradeResult ok' : 'ceTradeResult error'}>{manualOrder.message}</div>}</section>
      <MultiBotWorkspace api={api}/>
      <section className="ceCard ceHoldingsCard"><div className="ceCardTitle"><div><p className="ceEyebrow">YOUR PAPER HOLDINGS</p><h2>What the broker currently holds</h2></div><span className="cePaperPill">ALPACA PAPER</span></div>{positions.length ? <div className="ceHoldingsTable">{positions.map((position) => <div key={position.symbol}><span><b>{position.symbol}</b><small>{safeNumber(position.qty)} units</small></span><span><b>{money(position.marketValue)}</b><small className={safeNumber(position.unrealizedPnl) >= 0 ? 'ceGain' : 'ceLoss'}>{money(position.unrealizedPnl)} unrealized</small></span></div>)}</div> : <div className="ceEmpty"><b>No paper positions.</b><span>Bot monitoring does not require an open position.</span></div>}</section>
    </>}

    {tab === 'ai' && <section className="ceAiLayout"><div className="ceChatPanel"><div className="ceChatHead"><div><p className="ceEyebrow">CAUSALEDGE AI</p><h1>Ask what your account and bots mean.</h1></div><span className="ceAiBadge">GROQ-READY</span></div><div className="ceMessages">{messages.map((message, index) => <div className={`ceMessage ${message.role}`} key={index}><div>{message.text}</div>{message.keyPoints?.length ? <ul>{message.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul> : null}{message.risks?.length ? <div className="ceRiskNote"><b>Risks</b>{message.risks.map((risk) => <span key={risk}>{risk}</span>)}</div> : null}{message.provider && <small>Generated with {message.provider}</small>}</div>)}</div><form className="ceChatComposer" onSubmit={(event) => { event.preventDefault(); askCopilot(); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your account, bots, a company, crypto, or a world event…"/><button className="cePrimary" disabled={!question.trim() || busy === 'copilot'}>{busy === 'copilot' ? 'Thinking…' : 'Ask'}</button></form><p className="ceFinePrint">Educational analysis only. AI cannot enable live trading or bypass risk controls.</p></div><aside className="ceAiSide"><div className="ceCard"><p className="ceEyebrow">TRY ASKING</p>{QUICK_QUESTIONS.map((prompt) => <button className="cePrompt" key={prompt} onClick={() => askCopilot(prompt)}>{prompt}<span>›</span></button>)}</div><div className="ceCard"><p className="ceEyebrow">ACCOUNT CONTEXT</p><div className="ceContextList"><span><small>Paper value</small><b>{money(equity)}</b></span><span><small>Positions</small><b>{positions.length}</b></span><span><small>Risk context</small><b>{profile.risk}</b></span><span><small>Intel events</small><b>{events.length}</b></span></div></div></aside></section>}

    {tab === 'activity' && <><section className="ceSectionHead"><div><p className="ceEyebrow">ACTIVITY & SAFETY</p><h1>See why the system acted—or didn’t.</h1><p>Bot audit history is stored server-side and stays separate by bot.</p></div><div className="ceSafetyCluster"><span className={engine?.safety?.paperExecution ? 'warn' : 'ok'}>{engine?.safety?.paperExecution ? 'Paper execution enabled' : 'Paper execution off'}</span><span className={engine?.safety?.autoExecution ? 'warn' : 'ok'}>{engine?.safety?.autoExecution ? 'Automation enabled' : 'Automation off'}</span><span className={engine?.safety?.killSwitch ? 'ok' : 'warn'}>{engine?.safety?.killSwitch ? 'Kill switch on' : 'Kill switch off'}</span><span className="ok">Live trading off</span></div></section><MultiBotWorkspace api={api} compact onOpenWorkspace={() => setTab('invest')}/><section className="ceTwoCol"><div className="ceCard"><p className="ceEyebrow">ACCOUNT</p><div className="ceContextList"><span><small>Broker</small><b>{engine?.safety?.brokerConfigured ? 'Alpaca paper connected' : 'Not connected'}</b></span><span><small>Status</small><b>{account.status || '—'}</b></span><span><small>Cash</small><b>{money(account.cash || 0)}</b></span><span><small>Buying power</small><b>{money(account.buyingPower || 0)}</b></span></div></div><div className="ceCard"><p className="ceEyebrow">ENGINE LOG</p>{engine?.logs?.length ? <div className="ceActivityList">{engine.logs.slice(0,20).map((log, index) => <div key={`${log.time}-${index}`}><span className={`ceActivityType ${String(log.type || '').toLowerCase()}`}>{log.type}</span><div><b>{log.symbol || 'SYSTEM'}</b><p>{log.message}</p></div><time>{shortTime(log.time)}</time></div>)}</div> : <div className="ceEmpty"><b>No legacy engine log entries yet.</b></div>}</div></section></>}
  </div><MobileNav tab={tab} setTab={setTab}/></main>;
}
