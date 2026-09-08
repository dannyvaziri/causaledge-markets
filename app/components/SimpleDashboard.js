'use client';

import { useState } from 'react';
import { money, pct, shortTime, typeLabel } from '../lib/format.js';

export default function SimpleDashboard({ engine, intel, busy, onAction, onBrief, onDossier, onLock }) {
  const [showAlerts, setShowAlerts] = useState(false);
  const account = engine?.account || {};
  const markets = intel?.markets || [];
  const alerts = (intel?.events || []).slice(0, 8);
  const positions = engine?.positions || [];
  const paperSafe = Boolean(engine?.safety?.paperExecution) && !engine?.safety?.liveTrading;
  return <main className="simpleApp">
    <header className="simpleHeader">
      <div className="simpleBrand"><span className="simpleLogo">CE</span><div><strong>CausalEdge</strong><small>Paper investing, made clear</small></div></div>
      <div className="simpleHeaderActions"><span className="paperBadge">PAPER MODE</span><button className="linkButton" onClick={onLock}>Sign out</button></div>
    </header>
    <div className="simpleContent">
      <section className="welcome"><div><p className="simpleKicker">YOUR PORTFOLIO</p><h1>Good to see you.</h1><p>Here is the simple view of your paper account.</p></div><button className="primarySimple" onClick={onBrief} disabled={busy==='briefing'}>{busy==='briefing'?'Preparing…':'Get today’s brief'}</button></section>
      <section className="balanceCard"><div><span>Total value</span><strong>{money(account.equity || 0)}</strong><small className={Number(account.dayPnl)>=0?'up':'down'}>{Number(account.dayPnl)>=0?'+':''}{money(account.dayPnl || 0)} today</small></div><div className="balanceMeta"><span>Buying power<strong>{money(account.buyingPower || account.cash || 0)}</strong></span><span>Positions<strong>{positions.length}</strong></span><span>Trading<strong>Paper only</strong></span></div></section>
      <div className="simpleGrid">
        <section className="simpleCard"><div className="cardHeader"><div><h2>Watchlist</h2><p>Tap a company to learn more.</p></div><button className="textAction" onClick={()=>onDossier('SPY')}>Search stocks</button></div><div className="watchList">{markets.slice(0,6).map(m=><button className="watchRow" key={m.symbol} onClick={()=>onDossier(m.symbol)}><span><b>{m.symbol}</b><small>{m.name || 'Market asset'}</small></span><span className="watchPrice"><b>{money(m.price)}</b><small className={Number(m.changePct)>=0?'up':'down'}>{Number(m.changePct)>=0?'+':''}{pct(m.changePct)}</small></span></button>)}</div></section>
        <section className="simpleCard"><div className="cardHeader"><div><h2>What’s happening</h2><p>Important market and world updates.</p></div><button className="textAction" onClick={()=>setShowAlerts(v=>!v)}>{showAlerts?'Show less':'See all'}</button></div><div className="alertList">{alerts.slice(0,showAlerts?8:3).map(e=><button className="alertRow" key={e.id} onClick={()=>e.symbols?.[0]&&onDossier(e.symbols[0])}><span className={`alertDot ${e.severity>=4?'high':''}`}/><span><b>{e.title}</b><small>{typeLabel(e.type)} · {shortTime(e.timestamp)}</small></span><span className="chevron">›</span></button>)}</div></section>
      </div>
      <section className="simpleCard safetyCard"><div><p className="simpleKicker">SAFETY CHECK</p><h2>{paperSafe?'You are in a safe paper account':'Review account safety'}</h2><p>Nothing here can place a live trade. Live trading is locked until you choose to change it.</p></div><div className="safetyActions"><span className="safeStatus"><i/> {engine?.engine?.enabled?'Monitoring':'Paused'}</span><button className="secondarySimple" disabled={!paperSafe || Boolean(busy)} onClick={()=>onAction('run')}>{busy==='run'?'Running…':'Run paper check'}</button></div></section>
      <p className="simpleFooter">Prices and news are for education and paper testing. This is not financial advice.</p>
    </div>
  </main>;
}
