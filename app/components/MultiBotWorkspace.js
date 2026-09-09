'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { money, pct, shortTime } from '../lib/format.js';

const EMPTY = {
  name: 'My paper bot', assetType: 'stock', symbol: 'SPY', strategy: 'momentum', status: 'paused',
  tradeAmount: 5, stopLossPct: 3, takeProfitPct: 6, maxPositions: 1, maxDailyLossUsd: 2,
};

const STRATEGIES = [
  ['momentum', 'Momentum', 'Looks for sustained short-term strength before considering a paper entry.'],
  ['trend', 'Trend', 'Requires price above its recent average with a rising short trend.'],
  ['mean-reversion', 'Mean reversion', 'Waits for an unusually weak move that begins to stabilize.'],
  ['breakout', 'Breakout', 'Waits for price to clear its recent trading range.'],
];

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Sparkline({ series = [], positive = true, large = false }) {
  const closes = series.map((point) => num(point.close)).filter((value) => value > 0);
  if (closes.length < 2) return <div className={`ceBotChartEmpty ${large ? 'large' : ''}`}>Waiting for market bars…</div>;
  const min = Math.min(...closes), max = Math.max(...closes), range = Math.max(max - min, 0.000001);
  const width = large ? 720 : 280, height = large ? 190 : 82;
  const points = closes.map((value, index) => `${(index / (closes.length - 1)) * width},${height - 8 - ((value - min) / range) * (height - 16)}`).join(' ');
  return <svg className={`ceBotSpark ${large ? 'large' : ''}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Recent price movement"><polyline points={points} fill="none" stroke={positive ? '#12814a' : '#d84e5c'} strokeWidth={large ? 3 : 2.4} strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function statusLabel(status) {
  return status === 'running' ? 'RUNNING' : status === 'stopped' ? 'STOPPED' : 'PAUSED';
}

function BotCard({ bot, onAction, onEdit, onDetail, busy }) {
  const movement = num(bot.market?.changePct);
  const pnl = num(bot.position?.unrealizedPnl);
  return <article className="ceBotTile">
    <div className="ceBotTileTop"><div><span className={`ceBotAsset ${bot.assetType}`}>{bot.assetType === 'crypto' ? 'CRYPTO' : 'STOCK'}</span><h3>{bot.name}</h3><p>{bot.symbol} · {STRATEGIES.find(([id]) => id === bot.strategy)?.[1] || bot.strategy}</p></div><span className={`ceBotState ${bot.status}`}>{statusLabel(bot.status)}</span></div>
    <div className="ceBotPrice"><div><small>Current price</small><strong>{bot.market?.price ? money(bot.market.price) : '—'}</strong></div><span className={movement >= 0 ? 'ceGain' : 'ceLoss'}>{bot.market?.changePct == null ? '—' : pct(movement)}</span></div>
    <Sparkline series={bot.market?.series || []} positive={movement >= 0}/>
    <div className="ceBotStats"><span><small>Open position</small><b>{bot.position ? '1' : '0'}</b></span><span><small>Unrealized P/L</small><b className={pnl >= 0 ? 'ceGain' : 'ceLoss'}>{bot.position ? money(pnl) : '—'}</b></span><span><small>Trade size</small><b>{money(bot.tradeAmount)}</b></span></div>
    <div className="ceBotExplain"><div><small>Last action</small><p>{bot.lastAction?.message || 'No bot decision recorded yet.'}</p></div><div><small>Next check</small><p>{bot.nextAction}</p></div></div>
    <div className="ceBotTileActions"><button className="ceTextButton" onClick={() => onDetail(bot)}>Details</button><button className="ceTextButton" onClick={() => onEdit(bot)}>Edit</button>{bot.status === 'running' ? <button className="ceSecondary compact" disabled={busy} onClick={() => onAction('pause', bot.id)}>Pause</button> : bot.status !== 'stopped' ? <button className="cePrimary compact" disabled={busy} onClick={() => onAction('resume', bot.id)}>Resume</button> : null}</div>
  </article>;
}

function BotEditor({ bot, suggestions, onQuery, onSave, onClose, busy }) {
  const [form, setForm] = useState(bot || EMPTY);
  useEffect(() => setForm(bot || EMPTY), [bot]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="ceModalBackdrop" onClick={onClose}><section className="ceBotEditor" onClick={(event) => event.stopPropagation()}>
    <button className="ceModalClose" onClick={onClose}>×</button><p className="ceEyebrow">{form.id ? 'EDIT PAPER BOT' : 'CREATE PAPER BOT'}</p><h2>{form.id ? form.name : 'Build a new bot'}</h2><p className="ceTradeHint">Each bot has one market, one strategy and its own limits. Shared account limits still override every bot.</p>
    <div className="ceBotEditorGrid"><label><span>Name</span><input value={form.name} maxLength={48} onChange={(event) => update('name', event.target.value)}/></label><label><span>Market type</span><select value={form.assetType} onChange={(event) => { update('assetType', event.target.value); update('symbol', event.target.value === 'crypto' ? 'BTC/USD' : 'SPY'); onQuery('', event.target.value); }}><option value="stock">Stock / ETF</option><option value="crypto">Crypto pair</option></select></label>
    <label className="ceSymbolField"><span>Symbol / pair</span><input value={form.symbol} maxLength={17} onChange={(event) => { const value = event.target.value.toUpperCase(); update('symbol', value); onQuery(value, form.assetType); }}/>{suggestions.length > 0 && <div className="ceSymbolSuggestions">{suggestions.map((item) => <button type="button" key={item.symbol} onClick={() => { update('symbol', item.symbol); onQuery('', form.assetType); }}><b>{item.symbol}</b><span>{item.name}</span></button>)}</div>}</label><label><span>Strategy</span><select value={form.strategy} onChange={(event) => update('strategy', event.target.value)}>{STRATEGIES.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
    <label><span>Trade amount</span><div className="ceInlineMoney"><b>$</b><input type="number" min="1" max="25" step="1" value={form.tradeAmount} onChange={(event) => update('tradeAmount', event.target.value)}/></div></label><label><span>Stop loss</span><div className="ceInlineMoney"><input type="number" min="0.5" max="10" step="0.5" value={form.stopLossPct} onChange={(event) => update('stopLossPct', event.target.value)}/><b>%</b></div></label><label><span>Take profit</span><div className="ceInlineMoney"><input type="number" min="1" max="20" step="0.5" value={form.takeProfitPct} onChange={(event) => update('takeProfitPct', event.target.value)}/><b>%</b></div></label><label><span>Maximum positions</span><select value={form.maxPositions} onChange={(event) => update('maxPositions', event.target.value)}><option value="1">1</option><option value="2">2</option></select></label><label><span>Bot daily-loss stop</span><div className="ceInlineMoney"><b>$</b><input type="number" min="0.5" max="3" step="0.5" value={form.maxDailyLossUsd} onChange={(event) => update('maxDailyLossUsd', event.target.value)}/></div></label></div>
    <div className="ceStrategyExplain">{STRATEGIES.filter(([id]) => id === form.strategy).map(([id, name, copy]) => <div key={id}><b>{name}</b><span>{copy}</span></div>)}</div>
    <div className="ceBotEditorActions"><button className="ceSecondary" onClick={onClose}>Cancel</button><button className="cePrimary" disabled={busy} onClick={() => onSave(form)}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Create paused bot'}</button></div>
  </section></div>;
}

function BotDetail({ bot, onClose, onAction, busy }) {
  const movement = num(bot.market?.changePct);
  const activity = bot.activity || [];
  return <div className="ceModalBackdrop" onClick={onClose}><section className="ceBotDetail" onClick={(event) => event.stopPropagation()}><button className="ceModalClose" onClick={onClose}>×</button>
    <div className="ceBotDetailHead"><div><span className={`ceBotAsset ${bot.assetType}`}>{bot.assetType.toUpperCase()}</span><p className="ceEyebrow">BOT DETAIL</p><h2>{bot.name}</h2><p>{bot.symbol} · {STRATEGIES.find(([id]) => id === bot.strategy)?.[1]}</p></div><span className={`ceBotState ${bot.status}`}>{statusLabel(bot.status)}</span></div>
    <div className="ceBotDetailPrice"><strong>{bot.market?.price ? money(bot.market.price) : '—'}</strong><span className={movement >= 0 ? 'ceGain' : 'ceLoss'}>{bot.market?.changePct == null ? '—' : pct(movement)}</span></div><Sparkline series={bot.market?.series || []} positive={movement >= 0} large/>
    <div className="ceBotRiskRow"><span><small>Trade size</small><b>{money(bot.tradeAmount)}</b></span><span><small>Stop</small><b>-{bot.stopLossPct}%</b></span><span><small>Take profit</small><b>+{bot.takeProfitPct}%</b></span><span><small>Daily stop</small><b>{money(bot.maxDailyLossUsd)}</b></span></div>
    <div className="ceBotNow"><div><p className="ceEyebrow">WHAT IT IS DOING NOW</p><b>{bot.lastAction?.message || 'Waiting for the first recorded bot decision.'}</b></div><div><p className="ceEyebrow">WHAT IT CHECKS NEXT</p><b>{bot.nextAction}</b></div></div>
    <div className="ceBotDetailActions">{bot.status === 'running' ? <button className="ceSecondary" disabled={busy} onClick={() => onAction('pause', bot.id)}>Pause immediately</button> : bot.status !== 'stopped' ? <button className="cePrimary" disabled={busy} onClick={() => onAction('resume', bot.id)}>Resume bot</button> : null}<button className="ceSecondary" disabled={busy || bot.status === 'stopped'} onClick={() => onAction('stop', bot.id)}>Stop bot</button></div>
    <div className="ceBotHistory"><div className="ceCardTitle"><div><p className="ceEyebrow">BOT AUDIT</p><h3>Decisions, orders, fills, exits and rejections</h3></div></div>{activity.length ? activity.map((row) => <div className="ceBotHistoryRow" key={row.id}><span className={`ceBotEvent ${String(row.status || '').toLowerCase()}`}>{String(row.event_type || '').replace('BOT_', '')}</span><div><b>{row.message}</b><small>{row.order_id ? `Order ${row.order_id.slice(0, 12)}… · ` : ''}{row.status}</small></div><time>{shortTime(row.created_at)}</time></div>) : <div className="ceEmpty"><b>No audit entries yet.</b><span>Bot decisions will appear here after scheduled evaluation begins.</span></div>}</div>
  </section></div>;
}

export default function MultiBotWorkspace({ api, compact = false, onOpenWorkspace }) {
  const [data, setData] = useState({ bots: [], sharedRisk: null, safety: null, account: null });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const load = useCallback(async () => {
    try { const result = await api('/api/bots'); setData(result); setError(''); }
    catch (caught) { setError(String(caught?.message || caught)); }
  }, [api]);

  useEffect(() => { load(); const timer = setInterval(load, compact ? 30000 : 20000); return () => clearInterval(timer); }, [load, compact]);

  const querySymbols = useCallback(async (query, assetType) => {
    if (!query || query.length < 1) { setSuggestions([]); return; }
    try { const result = await api(`/api/bots/symbols?q=${encodeURIComponent(query)}&assetType=${encodeURIComponent(assetType)}`); setSuggestions(result.suggestions || []); }
    catch { setSuggestions([]); }
  }, [api]);

  const action = useCallback(async (name, id, bot) => {
    setBusy(`${name}:${id || 'new'}`);
    try {
      await api('/api/bots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, id, bot }) });
      setError(''); setEditor(null); setSuggestions([]); await load();
      if (detail?.id === id) { const refreshed = await api(`/api/bots?id=${encodeURIComponent(id)}`); setDetail(refreshed.bots?.[0] || null); }
    } catch (caught) { setError(String(caught?.message || caught)); }
    finally { setBusy(''); }
  }, [api, load, detail]);

  const openDetail = async (bot) => {
    setBusy(`detail:${bot.id}`);
    try { const result = await api(`/api/bots?id=${encodeURIComponent(bot.id)}`); setDetail(result.bots?.[0] || bot); }
    catch (caught) { setError(String(caught?.message || caught)); }
    finally { setBusy(''); }
  };

  const bots = data.bots || [];
  const running = bots.filter((bot) => bot.status === 'running');
  const pnl = bots.reduce((sum, bot) => sum + num(bot.position?.unrealizedPnl), 0);
  const shared = data.sharedRisk || {};

  if (compact) return <section className="ceBotHomeSummary"><div className="ceCardTitle"><div><p className="ceEyebrow">AUTOMATION WORKSPACE</p><h2>{running.length ? `${running.length} bot${running.length === 1 ? '' : 's'} watching the market` : 'Your paper bots are paused'}</h2></div><button className="ceTextButton" onClick={onOpenWorkspace}>Manage bots →</button></div><div className="ceBotSummaryStats"><span><small>Total bots</small><b>{bots.length}</b></span><span><small>Running</small><b>{running.length}</b></span><span><small>Bot P/L</small><b className={pnl >= 0 ? 'ceGain' : 'ceLoss'}>{money(pnl)}</b></span><span><small>Shared exposure</small><b>{shared.currentExposurePct == null ? '—' : `${num(shared.currentExposurePct).toFixed(1)}%`}</b></span></div>{data.safety?.killSwitch && <div className="ceBotSafetyBanner"><b>Kill switch is ON</b><span>All bots can monitor, but new entries are blocked.</span></div>}<div className="ceBotMiniList">{bots.slice(0, 4).map((bot) => <button key={bot.id} onClick={onOpenWorkspace}><span className={`ceBotDot ${bot.status}`}/><div><b>{bot.name}</b><small>{bot.symbol} · {bot.nextAction}</small></div><span>{bot.market?.price ? money(bot.market.price) : '—'}</span></button>)}{!bots.length && <div className="ceEmpty"><b>No bots yet.</b><span>Create independent stock or crypto paper bots from Invest.</span></div>}</div></section>;

  return <section className="ceBotsWorkspace">
    <div className="ceBotsHero"><div><p className="ceEyebrow">MULTI-BOT PAPER LAB</p><h1>Run independent strategies without losing account-level control.</h1><p>Each bot has its own market, strategy and exits. CausalEdge applies shared limits across the entire $100 paper account before any bot can enter.</p></div><button className="cePrimary" onClick={() => { setEditor({ ...EMPTY }); setSuggestions([]); }}>+ Create bot</button></div>
    {error && <div className="ceTradeResult error">{error}</div>}
    <div className="ceSharedRisk"><span><small>Shared open positions</small><b>{shared.currentOpenPositions || 0} / {shared.maxOpenPositions || 2}</b></span><span><small>Combined exposure</small><b>{shared.currentExposurePct == null ? '—' : `${num(shared.currentExposurePct).toFixed(1)}% / ${shared.maxAggregateExposurePct || 50}%`}</b></span><span><small>Account daily stop</small><b>{money(shared.maxDailyLossUsd || 3)}</b></span><span><small>Global kill switch</small><b className={data.safety?.killSwitch ? 'ceLoss' : 'ceGain'}>{data.safety?.killSwitch ? 'ON' : 'OFF'}</b></span></div>
    {data.safety?.killSwitch && <div className="ceBotSafetyBanner"><b>Immediate entry lock active.</b><span>The global kill switch blocks every bot from submitting a new entry. Pausing a bot also removes it from scheduled evaluation independently.</span></div>}
    <div className="ceBotGrid">{bots.map((bot) => <BotCard key={bot.id} bot={bot} busy={Boolean(busy)} onAction={action} onEdit={(value) => { setEditor(value); setSuggestions([]); }} onDetail={openDetail}/>)}{!bots.length && <button className="ceBotCreateEmpty" onClick={() => setEditor({ ...EMPTY })}><span>+</span><b>Create your first paper bot</b><small>Choose a stock or crypto pair, strategy and risk limits.</small></button>}</div>
    {bots.length > 0 && <div className="ceBotsManageTable"><div className="ceCardTitle"><div><p className="ceEyebrow">BOT MANAGEMENT</p><h2>Control every bot independently</h2></div></div>{bots.map((bot) => <div className="ceBotManageRow" key={bot.id}><div><span className={`ceBotDot ${bot.status}`}/><b>{bot.name}</b><small>{bot.symbol}</small></div><span>{statusLabel(bot.status)}</span><div><button onClick={() => setEditor(bot)}>Edit</button><button onClick={() => action('duplicate', bot.id)}>Duplicate</button>{bot.status === 'running' ? <button onClick={() => action('pause', bot.id)}>Pause</button> : bot.status !== 'stopped' ? <button onClick={() => action('resume', bot.id)}>Resume</button> : null}<button onClick={() => action('stop', bot.id)} disabled={bot.status === 'stopped'}>Stop</button><button className="danger" onClick={() => { if (window.confirm(`Delete ${bot.name}? Its audit history will remain in server storage.`)) action('delete', bot.id); }}>Delete</button></div></div>)}</div>}
    {editor && <BotEditor bot={editor} suggestions={suggestions} onQuery={querySymbols} onClose={() => { setEditor(null); setSuggestions([]); }} busy={Boolean(busy)} onSave={(form) => action(form.id ? 'update' : 'create', form.id, form)}/>} {detail && <BotDetail bot={detail} onClose={() => setDetail(null)} onAction={action} busy={Boolean(busy)}/>} 
  </section>;
}
