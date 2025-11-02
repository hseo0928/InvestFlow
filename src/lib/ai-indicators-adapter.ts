import { IndicatorCacheService } from './indicator-cache';
import { RSIOptions, OHLCPoint } from './indicators/rsi';

type Timeframe = '1d' | '1w' | '1mo';

export interface IndicatorsBundle {
  rsi: number[];
  signal: number[];
  crossovers: { time: number; type: 'bullish' | 'bearish' }[];
  features: {
    lastRsi: number | null;
    lastSignal: number | null;
    lastCrossType: 'bullish' | 'bearish' | null;
    overbought: boolean;
    oversold: boolean;
  };
}

export function getIndicatorsBundle(
  symbol: string,
  timeframe: Timeframe,
  ohlc: OHLCPoint[],
  options: RSIOptions,
  signalPeriod: number = 9,
): IndicatorsBundle {
  const data = IndicatorCacheService.getOrComputeRSI(symbol, timeframe, ohlc, options, signalPeriod);

  const lastRsi = data.rsi.length ? data.rsi[data.rsi.length - 1] : null;
  const lastSignal = data.signal.length ? data.signal[data.signal.length - 1] : null;
  const lastCross = data.crossovers.length ? data.crossovers[data.crossovers.length - 1] : null;

  return {
    rsi: data.rsi,
    signal: data.signal,
    crossovers: data.crossovers,
    features: {
      lastRsi,
      lastSignal,
      lastCrossType: lastCross ? lastCross.type : null,
      overbought: typeof lastRsi === 'number' && lastRsi >= 70,
      oversold: typeof lastRsi === 'number' && lastRsi <= 30,
    },
  };
}

