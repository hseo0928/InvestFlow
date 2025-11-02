/**
 * AI analysis type definitions
 */

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface AIAnalysis {
  summary: string;
  sentiment: Sentiment;
  keyPoints: string[];
  recommendation: string;
  confidence: number;
  riskFactors: string[];
}

export interface ChartAnalysis {
  recentTrend: 'up' | 'down' | 'sideways';
  volatility: 'high' | 'medium' | 'low';
}

export interface TechnicalIndicators {
  rsi?: number;
  rsi_signal?: 'overbought' | 'oversold' | 'neutral';
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  sma?: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
}
