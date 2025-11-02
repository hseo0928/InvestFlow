// API configuration and base URLs
export const API_CONFIG = {
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
  TWELVEDATA_API_KEY: import.meta.env.VITE_TWELVEDATA_API_KEY,
  FINANCIAL_JUICE_RSS: import.meta.env.VITE_FINANCIAL_JUICE_RSS,
  SAVETICKER_API: import.meta.env.VITE_SAVETICKER_API,
  OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1/chat/completions',
  OPENROUTER_SITE_URL: import.meta.env.VITE_SITE_URL,
  OPENROUTER_SITE_TITLE: import.meta.env.VITE_SITE_TITLE,
  
  // Base URLs
  GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
  TWELVEDATA_BASE_URL: 'https://api.twelvedata.com',
  YFINANCE_BASE_URL: 'https://query1.finance.yahoo.com/v8/finance/chart',
  BACKEND_API_URL: 'http://localhost:5002/api',
  
  // Request timeouts
  TIMEOUT: 10000,
} as const;

// Stock data types
export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
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
  price: number;
  volume?: number;
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

// OHLC 데이터를 위한 확장 인터페이스
export interface OHLCDataPoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface AIAnalysis {
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keyPoints: string[];
  recommendation: string;
  confidence: number;
  riskFactors: string[];
}

// Error types
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Generic API client helper
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new APIError(
        `API request failed: ${response.statusText}`,
        response.status,
        url
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof APIError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, url);
      }
      throw new APIError(`Network error: ${error.message}`, undefined, url);
    }
    
    throw new APIError('Unknown error occurred', undefined, url);
  }
}
