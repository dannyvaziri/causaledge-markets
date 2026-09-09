import { buildIntelSnapshot } from './sources.js';
import { aiConfigured, requestStructured } from '../ai.js';

export async function buildBriefing(snapshot) {
  const intel = snapshot || await buildIntelSnapshot();
  const events = intel.events.slice(0, 18).map((event) => ({ type: event.type, title: event.title, severity: event.severity, symbols: event.symbols, country: event.country }));
  const movers = intel.markets.slice().sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 8);

  if (!aiConfigured()) return {
    headline: 'Live intelligence feed active',
    summary: `${events.length} priority events and ${movers.length} market movers are currently normalized into CausalEdge Markets.`,
    priority: 'NORMAL',
    items: events.slice(0, 5).map((event) => ({ title: event.title, why: `${event.type} · severity ${event.severity}/5`, relatedSymbols: event.symbols || [], confidence: 0 })),
    ai: false,
  };

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      headline: { type: 'string' }, summary: { type: 'string' }, priority: { type: 'string', enum: ['LOW', 'NORMAL', 'ELEVATED', 'HIGH'] },
      items: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, why: { type: 'string' }, relatedSymbols: { type: 'array', items: { type: 'string' }, maxItems: 6 }, confidence: { type: 'number', minimum: 0, maximum: 100 } }, required: ['title', 'why', 'relatedSymbols', 'confidence'] } },
    },
    required: ['headline', 'summary', 'priority', 'items'],
  };

  const aiResult = await requestStructured({
    input: `You are the daily intelligence briefer for CausalEdge Markets, a consumer PAPER-INVESTING research platform. Correlate the supplied global events and market movers. Surface developments that could plausibly matter to an investor, explain why in plain English, and do not manufacture causality. Keep the output concise, educational and operational. EVENTS: ${JSON.stringify(events)} MOVERS: ${JSON.stringify(movers)}`,
    schema,
    name: 'briefing',
  });

  return { ...aiResult, ai: true };
}
