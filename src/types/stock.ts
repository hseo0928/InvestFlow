/**
 * Stock-related type definitions
 */

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface ChartDataPoint {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  price?: number; // Legacy field for backward compatibility
}

export interface OHLCDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type TimeRange = '1d' | '1w' | '1mo' | '3mo' | '1y' | '5y';
export type Interval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1mo';
