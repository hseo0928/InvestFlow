/**
 * IndicatorCacheService
 * - Caches derived indicators (e.g., RSI) in localStorage
 * - Keyed by: symbol, timeframe, indicator, params-hash, ohlc-hash
 * - Invalidates when OHLC hash changes (i.e., prices updated)
 */

import { calculateRSIDataWithOptions, KIS_RSI_PRESET, OHLCPoint, RSIOptions, RSIData } from './indicators/rsi';

type Timeframe = '1d' | '1w' | '1mo';

interface IndicatorCacheEntry<T> {
  version: number;
  indicator: string;
  paramsHash: string;
  ohlcHash: string;
  lastUpdated: number;
  data: T;
}

const INDICATOR_CACHE_PREFIX = 'indicator_cache_';
const INDICATOR_CACHE_VERSION = 1;
const INDICATOR_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function simpleHash(str: string): string {
  // 32-bit FNV-1a-ish simple hash
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function hashParams(obj: unknown): string {
  try {
    return simpleHash(JSON.stringify(obj));
  } catch {
    return '0';
  }
}

export function hashOHLC(ohlc: OHLCPoint[]): string {
  // Only hash fields that impact indicators (timestamp/open/high/low/close)
  let acc = '';
  for (const p of ohlc) {
    acc += `${p.timestamp ?? ''}|${p.open}|${p.high}|${p.low}|${p.close};`;
  }
  return simpleHash(acc);
}

function makeKey(symbol: string, timeframe: Timeframe, indicator: string, paramsHash: string, ohlcHash: string): string {
  return `${INDICATOR_CACHE_PREFIX}${symbol.toUpperCase()}:${timeframe}:${indicator}:${paramsHash}:${ohlcHash}`;
}

export class IndicatorCacheService {
  static clearAll() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(INDICATOR_CACHE_PREFIX)) localStorage.removeItem(k);
    }
  }

  static clearSymbol(symbol: string) {
    const prefix = `${INDICATOR_CACHE_PREFIX}${symbol.toUpperCase()}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  }

  private static get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as IndicatorCacheEntry<T>;
      if (entry.version !== INDICATOR_CACHE_VERSION) return null;
      if (Date.now() - entry.lastUpdated > INDICATOR_CACHE_TTL_MS) return null;
      return entry.data;
    } catch {
      return null;
    }
  }

  private static set<T>(key: string, indicator: string, paramsHash: string, ohlcHash: string, data: T): void {
    try {
      const entry: IndicatorCacheEntry<T> = {
        version: INDICATOR_CACHE_VERSION,
        indicator,
        paramsHash,
        ohlcHash,
        lastUpdated: Date.now(),
        data,
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {}
  }

  /**
   * Get or compute RSI bundle (RSI, signal, crossovers) using options and OHLC
   */
  static getOrComputeRSI(
    symbol: string,
    timeframe: Timeframe,
    ohlc: OHLCPoint[],
    options: RSIOptions,
    signalPeriod: number = 9,
  ): RSIData {
    const indicator = 'rsi';
    const paramsHash = hashParams({ options, signalPeriod });
    const ohlcHash = hashOHLC(ohlc);
    const key = makeKey(symbol, timeframe, indicator, paramsHash, ohlcHash);
    const cached = this.get<RSIData>(key);
    if (cached) return cached;

    const computed = calculateRSIDataWithOptions(ohlc, options, signalPeriod);
    this.set(key, indicator, paramsHash, ohlcHash, computed);
    return computed;
  }
}

export { KIS_RSI_PRESET };

