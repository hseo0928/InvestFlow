import { GeminiAPI } from './gemini-ai';
import { StockCacheService } from './stock-cache';
import { OHLCDataPoint } from './api-config';
import { API_CONFIG } from './api-config';

export type SrLevel = { price: number; type: 'support' | 'resistance'; confidence?: number; rationale?: string };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class AiSrService {
  static async suggest(symbol: string, timeframe: '1d'|'1w'|'1mo'): Promise<SrLevel[]> {
    const cacheKey = `aisr:${symbol}:${timeframe}`;
    const cached = readCache(cacheKey);
    if (cached) return cached;

    try {
      const raw = StockCacheService.getCachedData(symbol);
      const data = (raw?.data || []).slice(-250);
      const ohlc: OHLCDataPoint[] = data.map(p => ({
        date: p.date || new Date(p.timestamp).toISOString().split('T')[0],
        timestamp: p.timestamp,
        open: p.open ?? p.price,
        high: p.high ?? p.price,
        low: p.low ?? p.price,
        close: p.close ?? p.price,
        volume: p.volume ?? 0,
      }));

      const prompt = buildSrPrompt(symbol, timeframe, ohlc);
      const client = (GeminiAPI as any).getClient?.() || null;
      const model = client ? client : null;

      let levels: SrLevel[] | null = null;
      let used: 'gemini' | 'openrouter' | 'heuristic' | null = null;
      if (model) {
        const res = await (model as any).models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        const text: string | undefined = res?.text;
        levels = parseSrResponse(text);
        if (levels && levels.length) used = 'gemini';
      }
      // Gemini 실패 시 OpenRouter 폴백
      if ((!levels || levels.length === 0) && API_CONFIG.OPENROUTER_API_KEY) {
        const text = await openRouterComplete(prompt);
        levels = parseSrResponse(text || undefined);
        if (levels && levels.length) used = 'openrouter';
      }

      if (!levels || levels.length === 0) {
        levels = heuristicSRSuggest(ohlc);
        used = 'heuristic';
      }

      // 가격 범위 클리핑
      const minP = Math.min(...ohlc.map(o => o.low));
      const maxP = Math.max(...ohlc.map(o => o.high));
      levels = levels.filter(l => l.price >= minP && l.price <= maxP).slice(0, 8);

      // 간단 로깅(DeepSeek 폴백 여부 확인용)
      try {
        if (used === 'openrouter') {
          console.info('[AI S/R] Used OpenRouter (DeepSeek) fallback');
        } else if (used === 'gemini') {
          console.info('[AI S/R] Used Gemini');
        } else if (used === 'heuristic') {
          console.info('[AI S/R] Used heuristic fallback');
        }
      } catch {}

      writeCache(cacheKey, levels);
      return levels;
    } catch (e) {
      // 폴백
      const raw = StockCacheService.getCachedData(symbol);
      const data = (raw?.data || []).slice(-250);
      const ohlc: OHLCDataPoint[] = data.map(p => ({
        date: p.date || new Date(p.timestamp).toISOString().split('T')[0],
        timestamp: p.timestamp,
        open: p.open ?? p.price,
        high: p.high ?? p.price,
        low: p.low ?? p.price,
        close: p.close ?? p.price,
        volume: p.volume ?? 0,
      }));
      return heuristicSRSuggest(ohlc);
    }
  }
}

function buildSrPrompt(symbol: string, timeframe: string, ohlc: OHLCDataPoint[]): string {
  const sample = ohlc.slice(-200).map(o => ({ d: o.date, o: o.open, h: o.high, l: o.low, c: o.close, v: o.volume }));
  return `
Analyze support/resistance levels for ${symbol} on timeframe ${timeframe}.
Given last ${sample.length} OHLC bars (json):\n${JSON.stringify(sample)}\n
Return JSON ONLY in this format:
{
  "supports": [{"price": 123.45, "confidence": 0.7, "rationale": "..."}],
  "resistances": [{"price": 150.12, "confidence": 0.6, "rationale": "..."}]
}
Prices must be within the observed range. Keep 3-6 levels total. Use concise rationale.
`;
}

function parseSrResponse(text?: string): SrLevel[] | null {
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]);
    const supports: SrLevel[] = (obj.supports || []).map((x: any) => ({ price: Number(x.price), type: 'support', confidence: Number(x.confidence) || undefined, rationale: x.rationale }));
    const resistances: SrLevel[] = (obj.resistances || []).map((x: any) => ({ price: Number(x.price), type: 'resistance', confidence: Number(x.confidence) || undefined, rationale: x.rationale }));
    return [...supports, ...resistances].filter(l => isFinite(l.price));
  } catch {
    return null;
  }
}

function heuristicSRSuggest(data: OHLCDataPoint[]): SrLevel[] {
  if (data.length === 0) return [];
  // 간단한 극값 클러스터링: 스윙 하이/로우 탐지 후 가까운 값 묶기
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 1; i < data.length - 1; i++) {
    const prev = data[i - 1];
    const cur = data[i];
    const next = data[i + 1];
    if (cur.high > prev.high && cur.high > next.high) highs.push(cur.high);
    if (cur.low < prev.low && cur.low < next.low) lows.push(cur.low);
  }
  const clusters = (vals: number[], tolPct = 0.004) => {
    vals.sort((a, b) => a - b);
    const groups: number[][] = [];
    for (const v of vals) {
      const g = groups.find(grp => Math.abs(v - avg(grp)) / v <= tolPct);
      if (g) g.push(v); else groups.push([v]);
    }
    return groups.map(g => avg(g)).sort((a, b) => a - b);
  };
  const sup = clusters(lows).map(p => ({ price: p, type: 'support' as const }));
  const res = clusters(highs).map(p => ({ price: p, type: 'resistance' as const }));
  return [...sup, ...res].slice(0, 8);
}

function avg(a: number[]) { return a.reduce((s, v) => s + v, 0) / a.length; }

function readCache(key: string): SrLevel[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.t > CACHE_TTL_MS) return null;
    return obj.v === 1 ? obj.levels : null;
  } catch { return null; }
}

function writeCache(key: string, levels: SrLevel[]) {
  try { localStorage.setItem(key, JSON.stringify({ v: 1, t: Date.now(), levels })); } catch {}
}

async function openRouterComplete(prompt: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${API_CONFIG.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    };
    if (API_CONFIG.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = API_CONFIG.OPENROUTER_SITE_URL as unknown as string;
    if (API_CONFIG.OPENROUTER_SITE_TITLE) headers['X-Title'] = API_CONFIG.OPENROUTER_SITE_TITLE as unknown as string;

    const res = await fetch(API_CONFIG.OPENROUTER_BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'tngtech/deepseek-r1t2-chimera:free',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? null;
    return text;
  } catch {
    return null;
  }
}
