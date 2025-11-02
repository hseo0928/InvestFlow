import { API_CONFIG, APIError, StockQuote, StockSearchResult, ChartDataPoint } from './api-config';

// Yahoo Finance API client for stock data
export class YahooFinanceAPI {
  private static readonly BASE_URL = 'https://query1.finance.yahoo.com';
  private static readonly CORS_PROXY = 'https://corsproxy.io/?';
  
  // Get stock quote
  static async getQuote(symbol: string): Promise<StockQuote> {
    try {
      const apiUrl = `${this.BASE_URL}/v8/finance/chart/${symbol}`;
      const url = this.CORS_PROXY + encodeURIComponent(apiUrl);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new APIError(`Failed to fetch quote for ${symbol}`, response.status);
      }
      
      const data = await response.json();
      const chart = data.chart?.result?.[0];
      
      if (!chart) {
        throw new APIError(`No data found for symbol ${symbol}`);
      }
      
      const meta = chart.meta;
      const quote = chart.indicators?.quote?.[0];
      const currentPrice = meta.regularMarketPrice || quote?.close?.[quote.close.length - 1] || 0;
      const previousClose = meta.previousClose || 0;
      const change = currentPrice - previousClose;
      const changePercent = previousClose ? (change / previousClose) * 100 : 0;
      
      return {
        symbol: meta.symbol,
        name: meta.symbol, // Yahoo doesn't provide company name in this endpoint
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: meta.regularMarketVolume || 0,
        marketCap: meta.marketCap,
        high: meta.regularMarketDayHigh || currentPrice,
        low: meta.regularMarketDayLow || currentPrice,
        open: meta.regularMarketOpen || currentPrice,
        previousClose: previousClose,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Failed to fetch quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Get historical chart data
  static async getChartData(
    symbol: string,
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' = '1mo',
    interval: '1m' | '5m' | '15m' | '1h' | '1d' = '1d'
  ): Promise<ChartDataPoint[]> {
    try {
      const apiUrl = `${this.BASE_URL}/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;
      const url = this.CORS_PROXY + encodeURIComponent(apiUrl);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new APIError(`Failed to fetch chart data for ${symbol}`, response.status);
      }
      
      const data = await response.json();
      const chart = data.chart?.result?.[0];
      
      if (!chart || !chart.timestamp || !chart.indicators?.quote?.[0]) {
        throw new APIError(`No chart data found for symbol ${symbol}`);
      }
      
      const timestamps = chart.timestamp;
      const quotes = chart.indicators.quote[0];
      const closes = quotes.close || [];
      const volumes = quotes.volume || [];
      
      return timestamps.map((timestamp: number, index: number) => ({
        timestamp: timestamp * 1000, // Convert to milliseconds
        price: closes[index] || 0,
        volume: volumes[index] || 0,
      })).filter((point: ChartDataPoint) => point.price > 0);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Failed to fetch chart data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Search for stocks (using a simple symbol validation for now)
  static async searchStocks(query: string): Promise<StockSearchResult[]> {
    // For now, we'll use popular US stocks as search results
    // In a real implementation, you might use Yahoo's search API or TwelveData
    const popularStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NYSE', type: 'stock' },
      { symbol: 'UBER', name: 'Uber Technologies Inc.', exchange: 'NYSE', type: 'stock' },
      { symbol: 'SPOT', name: 'Spotify Technology S.A.', exchange: 'NYSE', type: 'stock' },
      { symbol: 'COIN', name: 'Coinbase Global Inc.', exchange: 'NASDAQ', type: 'stock' },
      { symbol: 'SHOP', name: 'Shopify Inc.', exchange: 'NYSE', type: 'stock' },
      { symbol: 'SQ', name: 'Block Inc.', exchange: 'NYSE', type: 'stock' },
    ];
    
    const filtered = popularStocks.filter(stock =>
      stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    );
    
    return filtered.slice(0, 10); // Return top 10 results
  }
}