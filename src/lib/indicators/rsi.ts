/**
 * RSI (Relative Strength Index) calculation utilities
 * 
 * This module provides RSI calculation functions following the existing project patterns
 * from ai-sr-service.ts and stock-service.ts for consistency.
 */

export interface RSIData {
  rsi: number[];
  signal: number[];
  crossovers: CrossoverPoint[];
}

export interface CrossoverPoint {
  time: number;
  type: 'bullish' | 'bearish';
}

/**
 * Calculate RSI (Relative Strength Index) for given closing prices
 * @param closes Array of closing prices
 * @param period RSI period (default: 14)
 * @returns Array of RSI values (0-100)
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  if (!closes || closes.length < period + 1) {
    return [];
  }

  const rsiValues: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  
  avgGain /= period;
  avgLoss /= period;

  // Calculate initial RSI
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  rsiValues.push(rsi);

  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    rsiValues.push(rsi);
  }

  return rsiValues;
}

// --- Configurable RSI ------------------------------------------------------

export type RsiPriceSource = 'close' | 'hlc3' | 'hl2' | 'ohlc4';
export type RsiSmoothing = 'wilder' | 'ema' | 'sma';

export interface RSIOptions {
  period?: number; // default 14
  source?: RsiPriceSource; // default 'close'
  smoothing?: RsiSmoothing; // default 'wilder'
  includeIncompleteBar?: boolean; // default false
  precision?: number; // optional rounding places
  clampEdges?: boolean; // AD=0 => 100, AU=0 => 0
}

export interface OHLCPoint { open: number; high: number; low: number; close: number; timestamp?: number }

function mapSource(ohlc: OHLCPoint[], source: RsiPriceSource): number[] {
  switch (source) {
    case 'hlc3':
      return ohlc.map(p => (p.high + p.low + p.close) / 3);
    case 'hl2':
      return ohlc.map(p => (p.high + p.low) / 2);
    case 'ohlc4':
      return ohlc.map(p => (p.open + p.high + p.low + p.close) / 4);
    case 'close':
    default:
      return ohlc.map(p => p.close);
  }
}

/**
 * Configurable RSI supporting different price sources and smoothing variants
 */
export function calculateRSIWithOptions(
  ohlc: OHLCPoint[],
  opts: RSIOptions = {}
): number[] {
  const period = opts.period ?? 14;
  if (!ohlc || ohlc.length < period + 1) return [];

  const src = mapSource(ohlc, opts.source ?? 'close');
  // Include all bars by default. If you need to exclude an incomplete bar,
  // pass a pre-trimmed OHLC array from the caller.
  const closes = src;

  if (closes.length < period + 1) return [];

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    gains.push(ch > 0 ? ch : 0);
    losses.push(ch < 0 ? Math.abs(ch) : 0);
  }

  const smoothing = opts.smoothing ?? 'wilder';
  const rsiValues: number[] = [];

  if (smoothing === 'sma') {
    // Rolling SMA of gains/losses over window 'period'
    let sumGain = 0, sumLoss = 0;
    for (let i = 0; i < period; i++) { sumGain += gains[i]; sumLoss += losses[i]; }
    let avgGain = sumGain / period;
    let avgLoss = sumLoss / period;
    let rs: number;
    if (opts.clampEdges && avgLoss === 0) {
      rsiValues.push(100);
    } else {
      rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
      rsiValues.push(100 - 100 / (1 + rs));
    }
    for (let i = period; i < gains.length; i++) {
      sumGain += gains[i] - gains[i - period];
      sumLoss += losses[i] - losses[i - period];
      avgGain = sumGain / period;
      avgLoss = sumLoss / period;
      if (opts.clampEdges && avgLoss === 0) {
        rsiValues.push(100);
      } else if (opts.clampEdges && avgGain === 0) {
        rsiValues.push(0);
      } else {
        rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
        rsiValues.push(100 - 100 / (1 + rs));
      }
    }
  } else if (smoothing === 'ema') {
    // EMA smoothing on gains/losses
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) { avgGain += gains[i]; avgLoss += losses[i]; }
    avgGain /= period; avgLoss /= period;
    const alpha = 2 / (period + 1);
    let rs: number;
    if (opts.clampEdges && avgLoss === 0) {
      rsiValues.push(100);
    } else {
      rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
      rsiValues.push(100 - 100 / (1 + rs));
    }
    for (let i = period; i < gains.length; i++) {
      avgGain = alpha * gains[i] + (1 - alpha) * avgGain;
      avgLoss = alpha * losses[i] + (1 - alpha) * avgLoss;
      if (opts.clampEdges && avgLoss === 0) {
        rsiValues.push(100);
      } else if (opts.clampEdges && avgGain === 0) {
        rsiValues.push(0);
      } else {
        rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
        rsiValues.push(100 - 100 / (1 + rs));
      }
    }
  } else {
    // Wilder (default)
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) { avgGain += gains[i]; avgLoss += losses[i]; }
    avgGain /= period; avgLoss /= period;
    let rs: number;
    if (opts.clampEdges && avgLoss === 0) {
      rsiValues.push(100);
    } else {
      rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
      rsiValues.push(100 - 100 / (1 + rs));
    }
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      if (opts.clampEdges && avgLoss === 0) {
        rsiValues.push(100);
      } else if (opts.clampEdges && avgGain === 0) {
        rsiValues.push(0);
      } else {
        rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
        rsiValues.push(100 - 100 / (1 + rs));
      }
    }
  }

  if (typeof opts.precision === 'number') {
    const p = Math.max(0, Math.floor(opts.precision));
    return rsiValues.map(v => Number.isFinite(v) ? Number(v.toFixed(p)) : v);
  }
  return rsiValues;
}

/**
 * Calculate RSI Signal line (9-period Simple Moving Average of the RSI itself)
 * @param rsi Array of RSI values
 * @param period Signal period (default: 9)
 * @returns Array of signal values
 */
export function calculateSignal(rsi: number[], period: number = 9): number[] {
  if (!rsi || rsi.length < period) {
    return [];
  }

  const signal: number[] = [];
  
  for (let i = period - 1; i < rsi.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += rsi[i - j];
    }
    signal.push(sum / period);
  }

  return signal;
}

/**
 * Detect crossover points between RSI and Signal lines
 * @param rsi Array of RSI values
 * @param signal Array of Signal values
 * @returns Array of crossover points with type (bullish/bearish)
 */
export function detectCrossovers(rsi: number[], signal: number[]): CrossoverPoint[] {
  if (!rsi || !signal || rsi.length === 0 || signal.length === 0) {
    return [];
  }

  const crossovers: CrossoverPoint[] = [];
  const minLength = Math.min(rsi.length, signal.length);
  
  // Start from index 1 to compare with previous values
  for (let i = 1; i < minLength; i++) {
    const prevRsi = rsi[rsi.length - minLength + i - 1];
    const prevSignal = signal[i - 1];
    const currentRsi = rsi[rsi.length - minLength + i];
    const currentSignal = signal[i];

    // Check for bullish crossover (RSI crosses above Signal)
    if (prevRsi <= prevSignal && currentRsi > currentSignal) {
      crossovers.push({
        time: rsi.length - minLength + i,
        type: 'bullish'
      });
    }
    
    // Check for bearish crossover (RSI crosses below Signal)
    if (prevRsi >= prevSignal && currentRsi < currentSignal) {
      crossovers.push({
        time: rsi.length - minLength + i,
        type: 'bearish'
      });
    }
  }

  return crossovers;
}

/**
 * Calculate complete RSI data including RSI, Signal, and crossovers
 * @param closes Array of closing prices
 * @param rsiPeriod RSI period (default: 14)
 * @param signalPeriod Signal period (default: 9)
 * @returns Complete RSI data object
 */
export function calculateRSIData(
  closes: number[], 
  rsiPeriod: number = 14, 
  signalPeriod: number = 9
): RSIData {
  if (!closes || closes.length < rsiPeriod + signalPeriod) {
    return {
      rsi: [],
      signal: [],
      crossovers: []
    };
  }

  const rsi = calculateRSI(closes, rsiPeriod);
  const signal = calculateSignal(rsi, signalPeriod);
  const crossovers = detectCrossovers(rsi, signal);

  return {
    rsi,
    signal,
    crossovers
  };
}

/**
 * Options-aware full RSI bundle (RSI, Signal, Crossovers) from OHLC
 */
export function calculateRSIDataWithOptions(
  ohlc: OHLCPoint[],
  rsiOpts: RSIOptions = {},
  signalPeriod: number = 9,
): RSIData {
  const rsi = calculateRSIWithOptions(ohlc, rsiOpts);
  if (!rsi || rsi.length === 0) {
    return { rsi: [], signal: [], crossovers: [] };
  }
  const signal = calculateSignal(rsi, signalPeriod);
  const crossovers = detectCrossovers(rsi, signal);
  return { rsi, signal, crossovers };
}

// Common preset aligned for KIS (initial guess): HLC3 + Wilder + clamp edges, 14-period
export const KIS_RSI_PRESET: RSIOptions = {
  period: 14,
  source: 'hlc3',
  smoothing: 'wilder',
  includeIncompleteBar: false,
  clampEdges: true,
  precision: 2,
};

/**
 * Helper function to get RSI level classification
 * @param rsiValue RSI value (0-100)
 * @returns Classification string
 */
export function getRSILevel(rsiValue: number): 'oversold' | 'oversold_warning' | 'neutral' | 'overbought_warning' | 'overbought' {
  if (rsiValue <= 20) return 'oversold';
  if (rsiValue <= 30) return 'oversold_warning';
  if (rsiValue >= 80) return 'overbought';
  if (rsiValue >= 70) return 'overbought_warning';
  return 'neutral';
}
