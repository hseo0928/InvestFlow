/**
 * Python yfinance 백엔드 API 클라이언트
 */

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002'}/api`;

export interface StockQuote {
  symbol: string;
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

export interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
}

/**
 * 주식 현재가 조회
 */
export async function getQuote(symbol: string): Promise<StockQuote> {
  const response = await fetch(`${API_BASE_URL}/quote/${symbol}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch quote: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * 주식 차트 데이터 조회
 * @param period - 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
 * @param interval - 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
 */
export async function getHistory(
  symbol: string,
  period: string = '1mo',
  interval: string = '1d'
): Promise<HistoricalData[]> {
  const response = await fetch(
    `${API_BASE_URL}/history/${symbol}?period=${period}&interval=${interval}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * 주식 심볼 검색
 */
export async function searchStocks(query: string): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to search stocks: ${response.statusText}`);
  }
  
  return response.json();
}
