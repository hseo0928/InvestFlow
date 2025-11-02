/**
 * 한국투자증권 KIS API 클라이언트 (Flask 백엔드 경유)
 * 미국 주식 시세 조회
 */

const API_BASE_URL = 'http://localhost:5002/api/kis';

export interface KISQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

/**
 * 미국 주식 현재가 조회
 */
export async function getUSStockQuote(symbol: string): Promise<KISQuote> {
  const response = await fetch(`${API_BASE_URL}/quote/${symbol}`);

  if (!response.ok) {
    throw new Error(`KIS API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 미국 주식 차트 데이터 조회
 */
export async function getUSStockHistory(
  symbol: string,
  period: string = 'D',
  count: number = 30
): Promise<any[]> {
  const response = await fetch(
    `${API_BASE_URL}/history/${symbol}?period=${period}&count=${count}`
  );

  if (!response.ok) {
    throw new Error(`KIS API error: ${response.statusText}`);
  }

  return response.json();
}
