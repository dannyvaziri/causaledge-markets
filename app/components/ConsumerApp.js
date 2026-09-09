'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import IntelligenceCommandCenter from './IntelligenceCommandCenter';
import { money, pct, shortTime, typeLabel } from '../lib/format.js';

const PROFILE_KEY = 'causaledge-investor-profile-v1';

const STRATEGIES = [
  {
    id: 'steady-growth', name: 'Steady Growth', tag: 'Core', risk: 'Moderate', horizon: '5+ years',
    description: 'A diversified core built around broad U.S. equities, quality companies and a stabilizing bond sleeve.',
    allocations: [['VTI', 55], ['QQQM', 15], ['SCHD', 15], ['BND', 15]],
    themes: ['Long-term wealth', 'Diversification'],
    why: 'A simple foundation for investors who want growth without concentrating the entire portfolio in one theme.'
  },
  {
    id: 'ai-semiconductors', name: 'AI & Semiconductors', tag: 'Theme', risk: 'High', horizon: '5+ years',
    description: 'Companies positioned across chips, cloud infrastructure and the AI compute stack.',
    allocations: [['NVDA', 25], ['AMD', 20], ['MSFT', 20], ['GOOGL', 15], ['AMZN', 10], ['AVGO', 10]],
    themes: ['AI', 'Technology'],
    why: 'Targets the infrastructure and platform layer behind AI adoption while spreading exposure across several businesses.'
  },
  {
    id: 'global-resilience', name: 'Global Resilience', tag: 'CausalEdge', risk: 'Moderate', horizon: '3+ years',
    description: 'A research basket focused on defense, energy, logistics and companies tied to resilient supply chains.',
    allocations: [['LMT', 20], ['RTX', 20], ['XOM', 15], ['CVX', 15], ['CAT', 15], ['UPS', 15]],
    themes: ['Geopolitics', 'Supply chains', 'Energy'],
    why: 'Uses the same geopolitical and supply-chain intelligence CausalEdge monitors to organize a research theme.'
  },
  {
    id: 'income-quality', name: 'Income & Quality', tag: 'Core', risk: 'Lower', horizon: '3+ years',
    description: 'A lower-volatility research mix emphasizing dividends, profitable businesses and broad diversification.',
    allocations: [['SCHD', 45], ['VIG', 25], ['VTI', 20], ['BND', 10]],
    themes: ['Income', 'Quality'],
    why: 'Designed for investors who value steadier compounding and income over chasing the highest-growth names.'
  },
  {
    id: 'mega-cap', name: 'Mega-Cap Leaders', tag: 'Theme', risk: 'High', horizon: '5+ years',
    description: 'A concentrated research basket of the largest technology and platform companies in the watchlist.',
    allocations: [['MSFT', 20], ['AAPL', 20], ['NVDA', 20], ['AMZN', 15], ['GOOGL', 15], ['META', 10]],
    themes: ['Technology', 'Growth'],
    why: 'Simple exposure to businesses with major cash flows, platform advantages and strong index influence.'
  },
  {
    id: 'market-core', name: 'One-Fund Market Core', tag: 'Simple', risk: 'Moderate', horizon: '5+ years',
    description: 'The simplest starting point: broad-market exposure as a single research allocation.',
    allocations: [['VTI', 100]],
    themes: ['Simple', 'Diversification'],
    why: 'Useful as a benchmark for every more complex strategy: does the added complexity actually improve the plan?'
  }
];

const QUICK_QUESTIONS = [
  'What moved my portfolio today?',
  'What world events matter most to my holdings?',
  'Explain my biggest position in plain English.',
  'What risks should I watch this week?',
  'How diversified is my paper portfolio?'
];

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function Onboarding({ brokerConnected, onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    goal: 'Build long-term wealth', target: '1000', horizon: '5-10 years', risk: 'Moderate', monthly: '100', interests: ['AI', 'Geopolitics']
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleInterest = (value) => setForm((current) => ({
    ...current,
    interests: current.interests.includes(value) ? current.interests.filter((item) => item !== value) : [...current.interests, value]
  }));
  const finish = () => onComplete({
    ...form,
    target: Math.max(safeNumber(form.target, 1000), 1),
    monthly: Math.max(safeNumber(form.monthly, 0), 0),
    createdAt: new Date().toISOString()
  });

  return <main className="ceOnboarding">
    <section className="ceOnboardCard">
      <div className="ceOnboardBrand"><span>CE</span><div><b>CausalEdge Markets</b><small>Invest with context, not noise.</small></div></div>
      <div className="ceStepTrack"><i className={step >= 1 ? 'on' : ''}/><i className={step >= 2 ? 'on' : ''}/><i className={step >= 3 ? 'on' : ''}/></div>
      {step === 1 && <div className="ceOnboardBody">
        <p className="ceEyebrow">STEP 1 OF 3</p><h1>What are you investing for?</h1><p>We use this to organize your dashboard and explain progress. It does not authorize trades.</p>
        <div className="ceChoiceGrid">{['Build long-term wealth','Retirement','A major purchase','Learn by paper investing'].map((goal) => <button key={goal} className={form.goal === goal ? 'selected' : ''} onClick={() => set('goal', goal)}>{goal}</button>)}</div>
        <label className="ceField"><span>Goal value</span><div><b>$</b><input inputMode="decimal" value={form.target} onChange={(event) => set('target', event.target.value.replace(/[^0-9.]/g, ''))}/></div></label>
      </div>}
      {step === 2 && <div className="ceOnboardBody">
        <p className="ceEyebrow">STEP 2 OF 3</p><h1>How do you want to approach risk?</h1><p>CausalEdge will use this to rank research strategies and explain tradeoffs, not to execute anything automatically.</p>
        <label className="ceField"><span>Time horizon</span><select value={form.horizon} onChange={(event) => set('horizon', event.target.value)}><option>Under 3 years</option><option>3-5 years</option><option>5-10 years</option><option>10+ years</option></select></label>
        <div className="ceRiskChoices">{[['Lower','Smaller swings, more stability'],['Moderate','Balance growth and stability'],['High','Accept larger swings for growth']].map(([risk, copy]) => <button key={risk} className={form.risk === risk ? 'selected' : ''} onClick={() => set('risk', risk)}><b>{risk}</b><small>{copy}</small></button>)}</div>
      </div>}
      {step === 3 && <div className="ceOnboardBody">
        <p className="ceEyebrow">STEP 3 OF 3</p><h1>Make it yours.</h1><p>Choose themes you want CausalEdge to prioritize when explaining markets and surfacing research.</p>
        <label className="ceField"><span>Monthly amount to plan around</span><div><b>$</b><input inputMode="decimal" value={form.monthly} onChange={(event) => set('monthly', event.target.value.replace(/[^0-9.]/g, ''))}/></div></label>
        <div className="ceChipChoices">{['AI','Technology','Geopolitics','Energy','Income','Supply chains','Defense','Simple'].map((interest) => <button key={interest} className={form.interests.includes(interest) ? 'selected' : ''} onClick={() => toggleInterest(interest)}>{interest}</button>)}</div>
        <div className="ceConnectionCheck"><span className={brokerConnected ? 'ok' : ''}>{brokerConnected ? '✓' : '○'}</span><div><b>{brokerConnected ? 'Alpaca paper account connected' : 'Paper broker not connected yet'}</b><small>{brokerConnected ? 'Account data can be used for portfolio explanations.' : 'You can connect a paper account later from the app.'}</small></div></div>
      </div>}
      <div className="ceOnboardActions"><button className="ceSecondary" onClick={() => step === 1 ? finish() : setStep((value) => value - 1)}>{step === 1 ? 'Use these defaults' : 'Back'}</button><button className="cePrimary" onClick={() => step === 3 ? finish() : setStep((value) => value + 1)}>{step === 3 ? 'Open my dashboard' : 'Continue'}</button></div>
      <small className="ceFinePrint">Paper investing and educational research only. CausalEdge does not enable live-money trading from this onboarding flow.</small>
    </section>
  </main>;
}

function Header({ tab, setTab, user, onLock }) {
  const nav = [['home','Home'],['invest','Invest'],['ai','AI'],['activity','Activity'],['intelligence','Intelligence']];
  return <header className="ceHeader">
    <button className="ceBrand" onClick={() => setTab('home')}><span>CE</span><div><b>CausalEdge</b><small>Markets</small></div></button>
    <nav className="ceDesktopNav">{nav.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
    <div className="ceHeaderRight"><span className="cePaperPill">PAPER</span><button className="ceAccountButton" title={user?.email || 'Account'} onClick={onLock}>{user?.picture ? <img src={user.picture} alt=""/> : <span>{String(user?.name || user?.email || 'U').slice(0,1).toUpperCase()}</span>}<b>Sign out</b></button></div>
  </header>;
}

function MobileNav({ tab, setTab }) {
  const nav = [['home','⌂','Home'],['invest','◈','Invest'],['ai','✦','AI'],['activity','↗','Activity'],['intelligence','◎','Intel']];
  return <nav className="ceMobileNav">{nav.map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
}

function StrategyCard({ strategy, recommended, onOpen }) {
  return <button className="ceStrategyCard" onClick={() => onOpen(strategy)}>
    <div className="ceStrategyTop"><span className="ceStrategyTag">{strategy.tag}</span>{recommended && <span className="ceRecommended">Recommended</span>}</div>
    <h3>{strategy.name}</h3><p>{strategy.description}</p>
    <div className="ceStrategyMeta"><span><small>Risk</small><b>{strategy.risk}</b></span><span><small>Horizon</small><b>{strategy.horizon}</b></span></div>
    <div className="ceMiniAlloc">{strategy.allocations.slice(0,4).map(([symbol, allocation]) => <span key={symbol}>{symbol} {allocation}%</span>)}</div>
  </button>;
}

export default function ConsumerApp({ token, user, onLock }) {
  const [tab, setTab] = useState('home');
  const [engine, setEngine] = useState(null);
  const [intel, setIntel] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [manualSymbol, setManualSymbol] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualSide, setManualSide] = useState('BUY');
  const [manualOrder, setManualOrder] = useState(null);
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Ask me what changed, what matters to your holdings, or what a market event could mean. I will explain the evidence and tradeoffs without placing trades.' }]);

  const headers = useCallback((extra = {}) => ({ ...extra, ...(token ? { 'x-ce-token': token } : {}) }), [token]);
  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: headers(options.headers || {}), cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
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
    setProfileReady(true);
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  const saveProfile = (next) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); setProfile(next);
  };

  const loadBriefing = async () => {
    setBusy('briefing');
    try { setBriefing(await api('/api/briefing', { method: 'POST' })); setError(''); }
    catch (caught) { setError(String(caught?.message || caught)); }
    finally { setBusy(''); }
  };

  const askCopilot = async (preset) => {
    const text = String(preset || question).trim();
    if (!text || busy === 'copilot') return;
    setQuestion(''); setMessages((items) => [...items, { role: 'user', text }]); setBusy('copilot');
    try {
      const result = await api('/api/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          profile,
          portfolio: { account: engine?.account || {}, positions: engine?.positions || [], challenge: engine?.challenge || {} }
        })
      });
      setMessages((items) => [...items, { role: 'assistant', text: result.answer, keyPoints: result.keyPoints, risks: result.risks, provider: result.provider }]);
      setError('');
    } catch (caught) {
      setMessages((items) => [...items, { role: 'assistant', text: `I could not complete that analysis: ${String(caught?.message || caught)}` }]);
    } finally { setBusy(''); }
  };

  const submitManualOrder = async (event) => {
    event.preventDefault();
    const symbol = manualSymbol.trim().toUpperCase();
    const amount = Number(manualAmount);
    if (!/^[A-Z.]{1,10}$/.test(symbol) || !Number.isFinite(amount) || amount <= 0) {
      setManualOrder({ ok: false, message: manualSide === 'BUY' ? 'Enter a stock symbol and a dollar amount.' : 'Enter a stock symbol and a share quantity.' });
      return;
    }
    setBusy('manual-order'); setManualOrder(null);
    try {
      const result = await api('/api/paper-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualSide === 'BUY'
          ? { symbol, side: manualSide, notional: amount, source: 'manual' }
          : { symbol, side: manualSide, qty: amount, source: 'manual' })
      });
      setManualOrder({ ok: true, message: `${manualSide === 'BUY' ? 'Buy' : 'Sell'} submitted for ${symbol}. Order status: ${result.order?.status || 'accepted'}.` });
      setManualAmount('');
      await refresh();
    } catch (caught) {
      const reason = caught?.message || 'The paper order was rejected.';
      setManualOrder({ ok: false, message: reason });
    } finally { setBusy(''); }
  };

  const account = engine?.account || {};
  const positions = engine?.positions || [];
  const markets = intel?.markets || [];
  const events = intel?.events || [];
  const equity = safeNumber(account.equity);
  const target = Math.max(safeNumber(profile?.target, engine?.challenge?.target || 1000), 1);
  const progress = Math.max(0, Math.min(100, equity / target * 100));
  const firstName = String(user?.name || user?.email || 'there').split(/[ @]/)[0];
  const riskWanted = profile?.risk || 'Moderate';
  const recommended = useMemo(() => {
    const interest = profile?.interests?.[0];
    return STRATEGIES.find((strategy) => strategy.risk === riskWanted && (!interest || strategy.themes.includes(interest))) || STRATEGIES.find((strategy) => strategy.risk === riskWanted) || STRATEGIES[0];
  }, [profile, riskWanted]);
  const drivers = useMemo(() => {
    if (positions.length) return positions.slice().sort((a, b) => Math.abs(safeNumber(b.unrealizedPnl)) - Math.abs(safeNumber(a.unrealizedPnl))).slice(0, 4).map((position) => ({ symbol: position.symbol, value: safeNumber(position.unrealizedPnl), note: `${pct(safeNumber(position.unrealizedPlpc) * 100)} unrealized` }));
    return markets.slice().sort((a, b) => Math.abs(safeNumber(b.changePct)) - Math.abs(safeNumber(a.changePct))).slice(0, 4).map((market) => ({ symbol: market.symbol, value: safeNumber(market.changePct), note: `${pct(market.changePct)} today`, percent: true }));
  }, [positions, markets]);

  if (!profileReady) return <main className="ceLoading">Preparing your portfolio…</main>;
  if (!profile) return <Onboarding brokerConnected={Boolean(engine?.safety?.brokerConfigured)} onComplete={saveProfile}/>;
  if (tab === 'intelligence') return <div className="ceIntelMode"><button className="ceIntelBack" onClick={() => setTab('home')}>← Back to investing</button><IntelligenceCommandCenter token={token} user={user} onLock={onLock}/></div>;

  return <main className="ceApp">
    <Header tab={tab} setTab={setTab} user={user} onLock={onLock}/>
    {error && <div className="ceError"><b>Connection notice</b><span>{error}</span><button onClick={() => setError('')}>×</button></div>}

    <div className="cePage">
      {tab === 'home' && <>
        <section className="ceWelcome"><div><p className="ceEyebrow">YOUR MONEY, WITH CONTEXT</p><h1>Hi {firstName}. Here’s what matters.</h1><p>{profile.goal} · {profile.horizon} · {profile.risk} risk profile</p></div><button className="cePrimary" onClick={loadBriefing} disabled={busy === 'briefing'}>{busy === 'briefing' ? 'Building today’s edge…' : briefing ? 'Refresh today’s edge' : 'Generate today’s edge'}</button></section>
        <section className="ceHeroGrid">
          <div className="cePortfolioHero"><div className="ceHeroTop"><span>Paper portfolio</span><span className="ceConnected">{engine?.safety?.brokerConfigured ? '● Alpaca connected' : '○ Demo data'}</span></div><strong>{money(equity)}</strong><div className={safeNumber(account.dayPnl) >= 0 ? 'ceGain' : 'ceLoss'}>{safeNumber(account.dayPnl) >= 0 ? '+' : ''}{money(account.dayPnl || 0)} today</div><div className="ceGoalLine"><span>{profile.goal}</span><b>{Math.round(progress)}%</b></div><div className="ceGoalTrack"><i style={{ width: `${progress}%` }}/></div><div className="ceHeroStats"><span><small>Goal</small><b>{money(target)}</b></span><span><small>Buying power</small><b>{money(account.buyingPower || account.cash || 0)}</b></span><span><small>Holdings</small><b>{positions.length}</b></span></div></div>
          <div className="ceEdgeCard"><div className="ceCardTitle"><div><p className="ceEyebrow">TODAY’S EDGE</p><h2>{briefing?.headline || 'Your personalized market brief'}</h2></div>{briefing?.provider && <span className="ceAiBadge">{String(briefing.provider).toUpperCase()} AI</span>}</div><p>{briefing?.summary || 'CausalEdge connects market moves, world events and your holdings so you can understand the why—not just the price.'}</p>{briefing?.items?.length ? <div className="ceEdgeItems">{briefing.items.slice(0,3).map((item, index) => <div key={`${item.title}-${index}`}><span>{index + 1}</span><div><b>{item.title}</b><small>{item.why}</small></div></div>)}</div> : <button className="ceTextButton" onClick={loadBriefing}>Create my daily briefing →</button>}</div>
        </section>

        <section className="ceTwoCol">
          <div className="ceCard"><div className="ceCardTitle"><div><p className="ceEyebrow">PORTFOLIO DRIVERS</p><h2>What’s moving you</h2></div><button className="ceTextButton" onClick={() => setTab('activity')}>See activity</button></div>{drivers.length ? <div className="ceDriverList">{drivers.map((driver) => <div key={driver.symbol}><span className="ceTicker">{driver.symbol}</span><div><b>{driver.note}</b><small>{driver.percent ? 'Watchlist move' : 'Paper position'}</small></div></div>)}</div> : <div className="ceEmpty"><b>No positions yet.</b><span>Your connected paper account is ready for research without live-money risk.</span></div>}</div>
          <div className="ceCard"><div className="ceCardTitle"><div><p className="ceEyebrow">CAUSAL INTELLIGENCE</p><h2>Events worth knowing</h2></div><button className="ceTextButton" onClick={() => setTab('intelligence')}>Open intelligence</button></div>{events.length ? <div className="ceEventList">{events.slice(0,4).map((event) => <div key={event.id}><span className={`ceSeverity s${event.severity}`}/><div><b>{event.title}</b><small>{typeLabel(event.type)} · {shortTime(event.timestamp)}{event.symbols?.length ? ` · ${event.symbols.slice(0,3).join(', ')}` : ''}</small></div></div>)}</div> : <div className="ceEmpty"><b>No priority events right now.</b><span>Upstream feeds can recover independently without breaking your portfolio view.</span></div>}</div>
        </section>

        <section className="ceRecommendedCard"><div><span className="ceStrategyTag">RESEARCH IDEA</span><h2>{recommended.name}</h2><p>{recommended.description}</p><div className="ceMiniAlloc">{recommended.allocations.slice(0,4).map(([symbol, allocation]) => <span key={symbol}>{symbol} {allocation}%</span>)}</div></div><div><p className="ceEyebrow">WHY IT FITS YOUR PROFILE</p><p>{recommended.why}</p><button className="ceSecondary" onClick={() => { setSelectedStrategy(recommended); setTab('invest'); }}>Explore strategy</button></div></section>
      </>}

      {tab === 'invest' && <>
        <section className="ceSectionHead"><div><p className="ceEyebrow">STRATEGIES</p><h1>Investing ideas you can understand.</h1><p>Explore transparent research baskets. Nothing here places an order.</p></div><button className="ceSecondary" onClick={() => { localStorage.removeItem(PROFILE_KEY); setProfile(null); }}>Update my goals</button></section>
        <section className="ceCard ceTradeCard"><div className="ceCardTitle"><div><p className="ceEyebrow">PAPER TRADE</p><h2>Place an order</h2></div><span className="cePaperPill">PAPER ONLY</span></div><p className="ceTradeHint">Buy with a dollar amount or sell shares you already own. Every order passes the account limits and kill switch first.</p><form className="ceTradeForm" onSubmit={submitManualOrder}><label><span>Symbol</span><input value={manualSymbol} onChange={(event) => setManualSymbol(event.target.value.toUpperCase())} placeholder="AAPL" maxLength={10} autoCapitalize="characters"/></label><label><span>Action</span><select value={manualSide} onChange={(event) => setManualSide(event.target.value)}><option value="BUY">Buy</option><option value="SELL">Sell</option></select></label><label><span>{manualSide === 'BUY' ? 'Dollars' : 'Shares'}</span><input type="number" min="0.01" step="0.01" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} placeholder={manualSide === 'BUY' ? '25.00' : '1'}/></label><button className="cePrimary" disabled={busy === 'manual-order'}>{busy === 'manual-order' ? 'Submitting…' : `${manualSide === 'BUY' ? 'Buy' : 'Sell'} in paper`}</button></form>{manualOrder && <div className={manualOrder.ok ? 'ceTradeResult ok' : 'ceTradeResult error'}>{manualOrder.message}</div>}</section>
        <div className="ceStrategyGrid">{STRATEGIES.map((strategy) => <StrategyCard key={strategy.id} strategy={strategy} recommended={recommended.id === strategy.id} onOpen={setSelectedStrategy}/>)}</div>
        <section className="ceCard ceHoldingsCard"><div className="ceCardTitle"><div><p className="ceEyebrow">YOUR PAPER HOLDINGS</p><h2>What you own</h2></div><span className="cePaperPill">READ ONLY</span></div>{positions.length ? <div className="ceHoldingsTable">{positions.map((position) => <div key={position.symbol}><span><b>{position.symbol}</b><small>{safeNumber(position.qty)} shares</small></span><span><b>{money(position.marketValue)}</b><small className={safeNumber(position.unrealizedPnl) >= 0 ? 'ceGain' : 'ceLoss'}>{money(position.unrealizedPnl)} unrealized</small></span></div>)}</div> : <div className="ceEmpty"><b>No paper positions.</b><span>Use strategies as research templates before deciding what you want to test in paper mode.</span></div>}</section>
        <section className="cePlanCard"><div><p className="ceEyebrow">RECURRING PLAN</p><h2>{money(profile.monthly)} / month</h2><p>Your goal profile is planning around this monthly amount. Recurring execution is intentionally not enabled from this consumer experience.</p></div><span className="ceLocked">🔒 Execution locked</span></section>
      </>}

      {tab === 'ai' && <section className="ceAiLayout">
        <div className="ceChatPanel"><div className="ceChatHead"><div><p className="ceEyebrow">CAUSALEDGE AI</p><h1>Ask what the market means for you.</h1></div><span className="ceAiBadge">GROQ-READY</span></div><div className="ceMessages">{messages.map((message, index) => <div className={`ceMessage ${message.role}`} key={index}><div>{message.text}</div>{message.keyPoints?.length ? <ul>{message.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul> : null}{message.risks?.length ? <div className="ceRiskNote"><b>Risks to keep in view</b>{message.risks.map((risk) => <span key={risk}>{risk}</span>)}</div> : null}{message.provider && <small>Generated with {message.provider}</small>}</div>)}</div><form className="ceChatComposer" onSubmit={(event) => { event.preventDefault(); askCopilot(); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your portfolio, a company, or a world event…"/><button className="cePrimary" disabled={!question.trim() || busy === 'copilot'}>{busy === 'copilot' ? 'Thinking…' : 'Ask'}</button></form><p className="ceFinePrint">Educational analysis only. The AI cannot place trades or change your execution settings.</p></div>
        <aside className="ceAiSide"><div className="ceCard"><p className="ceEyebrow">TRY ASKING</p>{QUICK_QUESTIONS.map((prompt) => <button className="cePrompt" key={prompt} onClick={() => askCopilot(prompt)}>{prompt}<span>›</span></button>)}</div><div className="ceCard"><p className="ceEyebrow">AI CONTEXT</p><div className="ceContextList"><span><small>Goal</small><b>{profile.goal}</b></span><span><small>Risk</small><b>{profile.risk}</b></span><span><small>Paper value</small><b>{money(equity)}</b></span><span><small>Holdings</small><b>{positions.length}</b></span><span><small>Intel events</small><b>{events.length}</b></span></div></div></aside>
      </section>}

      {tab === 'activity' && <>
        <section className="ceSectionHead"><div><p className="ceEyebrow">ACTIVITY</p><h1>Everything that changed, in one place.</h1><p>Your paper account and CausalEdge system events remain visible and explainable.</p></div><div className="ceSafetyCluster"><span className={engine?.safety?.paperExecution ? 'warn' : 'ok'}>{engine?.safety?.paperExecution ? 'Paper execution enabled' : 'Paper execution off'}</span><span className={engine?.safety?.autoExecution ? 'warn' : 'ok'}>{engine?.safety?.autoExecution ? 'Automation enabled' : 'Automation off'}</span><span className={engine?.safety?.killSwitch ? 'ok' : 'warn'}>{engine?.safety?.killSwitch ? 'Kill switch on' : 'Kill switch off'}</span><span className="ok">Live trading off</span></div></section>
        <section className="ceTwoCol"><div className="ceCard"><div className="ceCardTitle"><div><p className="ceEyebrow">ACCOUNT</p><h2>Connection status</h2></div></div><div className="ceContextList"><span><small>Broker</small><b>{engine?.safety?.brokerConfigured ? 'Alpaca paper connected' : 'Not connected'}</b></span><span><small>Status</small><b>{account.status || '—'}</b></span><span><small>Cash</small><b>{money(account.cash || 0)}</b></span><span><small>Buying power</small><b>{money(account.buyingPower || 0)}</b></span></div></div><div className="ceCard"><div className="ceCardTitle"><div><p className="ceEyebrow">POSITIONS</p><h2>Current paper exposure</h2></div></div>{positions.length ? <div className="ceHoldingsTable compact">{positions.map((position) => <div key={position.symbol}><span><b>{position.symbol}</b><small>{safeNumber(position.qty)} shares</small></span><span><b>{money(position.marketValue)}</b><small className={safeNumber(position.unrealizedPnl) >= 0 ? 'ceGain' : 'ceLoss'}>{money(position.unrealizedPnl)}</small></span></div>)}</div> : <div className="ceEmpty"><b>No open positions.</b><span>Your activity history will stay separate from market intelligence.</span></div>}</div></section>
        <section className="ceCard"><div className="ceCardTitle"><div><p className="ceEyebrow">SYSTEM LOG</p><h2>Why CausalEdge acted—or didn’t</h2></div><span className="cePaperPill">PAPER ENGINE</span></div>{engine?.logs?.length ? <div className="ceActivityList">{engine.logs.slice(0,30).map((log, index) => <div key={`${log.time}-${index}`}><span className={`ceActivityType ${String(log.type || '').toLowerCase()}`}>{log.type}</span><div><b>{log.symbol || 'SYSTEM'}</b><p>{log.message}</p></div><time>{shortTime(log.time)}</time></div>)}</div> : <div className="ceEmpty"><b>No engine cycle has run yet.</b><span>{engine?.safety?.autoExecution ? 'Automation is enabled and waiting for its next scheduled paper cycle.' : 'The paper engine is waiting for automatic execution to be enabled.'}</span></div>}</section>
      </>}
    </div>

    {selectedStrategy && <div className="ceModalBackdrop" onClick={() => setSelectedStrategy(null)}><section className="ceStrategyModal" onClick={(event) => event.stopPropagation()}><button className="ceModalClose" onClick={() => setSelectedStrategy(null)}>×</button><span className="ceStrategyTag">{selectedStrategy.tag}</span><h2>{selectedStrategy.name}</h2><p>{selectedStrategy.description}</p><div className="ceStrategyMeta"><span><small>Risk</small><b>{selectedStrategy.risk}</b></span><span><small>Horizon</small><b>{selectedStrategy.horizon}</b></span></div><h3>Illustrative allocation</h3><div className="ceAllocationList">{selectedStrategy.allocations.map(([symbol, allocation]) => <div key={symbol}><span><b>{symbol}</b></span><div><i style={{ width: `${allocation}%` }}/></div><b>{allocation}%</b></div>)}</div><h3>Why it exists</h3><p>{selectedStrategy.why}</p><div className="ceModalNote">Research template only. Previewing a strategy does not create, queue or submit any brokerage order.</div></section></div>}

    <MobileNav tab={tab} setTab={setTab}/>
  </main>;
}
