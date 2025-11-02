import { YahooFinanceAPI } from './yahoo-finance';
import { TwelveDataAPI } from './twelvedata';
import { NewsAPI } from './news-api';
import { GeminiAPI } from './gemini-ai';
import { DeepLTranslation } from './deepl-translation';
import { StockQuote, StockSearchResult, ChartDataPoint, NewsItem, AIAnalysis, APIError, API_CONFIG } from './api-config';
import * as YFinanceAPI from './yfinance-api';
import * as KISAPI from './kis-api';
import { formatVolume } from '../components/ui/utils';

// Main service class that coordinates all APIs
export class StockDataService {
  // Get stock quote: TwelveData → yfinance → KIS API fallback
  static async getStockQuote(symbol: string): Promise<StockQuote> {
    // 1. TwelveData 시도
    try {
      const q = await TwelveDataAPI.getQuote(symbol);
      // TwelveData가 고가/저가/시가를 제공하지 못하면 close(=price)로 채워지는 경우가 있음
      // 이 경우 보이는 수치가 모두 동일해지므로, 신뢰 가능한 소스로 폴백
      const eps = 1e-9;
      const flat = Math.abs(q.open - q.price) < eps && Math.abs(q.high - q.price) < eps && Math.abs(q.low - q.price) < eps;
      if (flat) {
        throw new Error('TwelveData returned flat OHLC equal to price');
      }
      return q;
    } catch (twelveDataError) {
      console.warn(`TwelveData failed for ${symbol}, trying yfinance:`, twelveDataError);
    }
    
    // 2. yfinance fallback
    try {
      const quote = await YFinanceAPI.getQuote(symbol);
      return {
        symbol: quote.symbol,
        name: quote.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        marketCap: quote.marketCap,
        high: quote.high,
        low: quote.low,
        open: quote.open,
        previousClose: quote.previousClose
      };
    } catch (yfinanceError) {
      console.warn(`yfinance failed for ${symbol}, trying KIS API:`, yfinanceError);
    }
    
    // 3. KIS API fallback
    try {
      const quote = await KISAPI.getUSStockQuote(symbol);
      return {
        symbol: quote.symbol,
        name: quote.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        marketCap: 0, // KIS API에서 제공하지 않음
        high: quote.high,
        low: quote.low,
        open: quote.open,
        previousClose: quote.previousClose
      };
    } catch (kisError) {
      throw new APIError(`Failed to get quote for ${symbol}: All APIs failed`);
    }
  }
  
  // Search stocks: Use new symbols API with 6,957 US stocks
  static async searchStocks(query: string): Promise<StockSearchResult[]> {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';
      const response = await fetch(`${API_BASE}/api/symbols/search?q=${encodeURIComponent(query)}&limit=10`);
      
      if (!response.ok) {
        throw new Error(`Symbols API error: ${response.status}`);
      }
      
      const results = await response.json();
      return results.map((r: any) => ({
        symbol: r.symbol,
        name: r.name,
        exchange: r.exchange || 'US',
        type: r.type || 'stock'
      }));
    } catch (error) {
      console.error('Symbols search error:', error);
      // Fallback to popular stocks if API fails
      return [
        { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "stock" },
        { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", type: "stock" },
        { symbol: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", type: "stock" },
        { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", type: "stock" },
        { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", type: "stock" },
      ];
    }
  }
  
  // Get chart data: KIS API → yfinance → TwelveData fallback (크레딧 절약)
  static async getChartData(symbol: string, timeRange: '1d' | '1w' | '1mo' = '1mo'): Promise<ChartDataPoint[]> {
    // 1. KIS API 우선 시도 (크레딧 무제한) - 2년치 데이터 요청
    try {
      const history = await KISAPI.getUSStockHistory(symbol, 'D', 730); // 2년 = 약 730일
      
      return history.map(h => {
        // KIS API의 날짜 형식: "20251024" → "2025-10-24"
        let dateStr = h.date;
        if (typeof dateStr === 'string' && dateStr.length === 8) {
          dateStr = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
        
        const timestamp = new Date(dateStr).getTime();
        
        return {
          timestamp: timestamp,
          price: h.close, // 하위 호환성
          volume: h.volume,
          date: dateStr,
          open: h.open,
          high: h.high,
          low: h.low,
          close: h.close
        };
      });
    } catch (kisError) {
      console.warn(`KIS API chart failed for ${symbol}, trying yfinance:`, kisError);
    }
    
    // 2. yfinance fallback - 2년치 데이터 요청
    try {
      const history = await YFinanceAPI.getHistory(symbol, '2y', '1d'); // 2년치 일봉 데이터
      
      return history.map(h => ({
        timestamp: new Date(h.date).getTime(),
        price: h.close, // 하위 호환성
        volume: h.volume,
        date: h.date,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close
      }));
    } catch (yfinanceError) {
      console.warn(`yfinance chart failed for ${symbol}, trying TwelveData:`, yfinanceError);
    }
    
    // 3. TwelveData fallback (크레딧 절약을 위해 마지막) - 2년치 데이터
    try {
      return await TwelveDataAPI.getChartData(symbol, '1day', 730); // 2년 = 약 730일
    } catch (twelveDataError) {
      throw new APIError(`Failed to get chart data for ${symbol}: All APIs failed`);
    }
  }
  
  // Get news for a specific stock
  static async getStockNews(symbol: string, maxItems: number = 10): Promise<NewsItem[]> {
    try {
      return await NewsAPI.getStockNews(symbol, maxItems);
    } catch (error) {
      console.warn('Failed to get stock news:', error);
      return [];
    }
  }
  
  // Get general financial news
  static async getGeneralNews(maxItems: number = 20): Promise<NewsItem[]> {
    try {
      return await NewsAPI.getAllNews(maxItems);
    } catch (error) {
      console.warn('Failed to get general news:', error);
      return [];
    }
  }
  
  // Get AI analysis for a stock
  static async getStockAnalysis(
    stock: StockQuote,
    news: NewsItem[],
    chartData?: ChartDataPoint[]
  ): Promise<AIAnalysis> {
    try {
      // Analyze chart data if provided
      let chartAnalysis: { recentTrend: 'up' | 'down' | 'sideways'; volatility: 'high' | 'medium' | 'low' } | undefined;
      
      if (chartData && chartData.length > 1) {
        chartAnalysis = this.analyzeChartData(chartData);
      }
      
      // Fetch fundamentals data in parallel
      const [ratios, dcf] = await Promise.allSettled([
        this.getFundamentalsRatios(stock.symbol),
        this.getFundamentalsDCF(stock.symbol)
      ]);
      
      const fundamentals = {
        ratios: ratios.status === 'fulfilled' ? ratios.value : undefined,
        dcf: dcf.status === 'fulfilled' ? dcf.value : undefined
      };
      
      // Get AI analysis
      const analysis = await GeminiAPI.analyzeStock(stock, news, chartAnalysis, fundamentals);
      
      // Translate AI analysis to Korean using DeepL backend
      try {
        return await DeepLTranslation.translateAIAnalysis(analysis);
      } catch (error) {
        console.warn('[DeepL] AI analysis translation failed:', error);
        return analysis; // fallback to English
      }
    } catch (error) {
      console.warn('Failed to get AI analysis:', error);
      
      // Return fallback analysis
      return {
        summary: `${stock.symbol} is currently trading at $${stock.price.toFixed(2)} with a ${stock.changePercent >= 0 ? 'positive' : 'negative'} change of ${stock.changePercent.toFixed(2)}%.`,
        sentiment: stock.changePercent > 2 ? 'bullish' : stock.changePercent < -2 ? 'bearish' : 'neutral',
        keyPoints: [
          `Current price: $${stock.price.toFixed(2)}`,
          `Daily change: ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`,
          `Trading volume: ${formatVolume(stock.volume)}`
        ],
        recommendation: 'AI analysis temporarily unavailable. Please consider multiple factors before making investment decisions.',
        confidence: 0.5,
        riskFactors: ['Market volatility', 'Economic uncertainty', 'Company-specific risks'],
      };
    }
  }
  
  // Get fundamentals ratios
  static async getFundamentalsRatios(symbol: string): Promise<any> {
    const response = await fetch(`${API_CONFIG.BACKEND_API_URL}/fundamentals/${symbol}/ratios`);
    if (!response.ok) throw new Error('Failed to fetch ratios');
    return await response.json();
  }
  
  // Get DCF valuation
  static async getFundamentalsDCF(symbol: string): Promise<any> {
    const response = await fetch(`${API_CONFIG.BACKEND_API_URL}/fundamentals/${symbol}/dcf`);
    if (!response.ok) throw new Error('Failed to fetch DCF');
    return await response.json();
  }
  
  // Generate market summary
  static async getMarketSummary(symbols: string[] = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA']): Promise<string> {
    try {
      const quotes = await Promise.allSettled(
        symbols.map(symbol => this.getStockQuote(symbol))
      );
      
      const validQuotes = quotes
        .filter((result): result is PromiseFulfilledResult<StockQuote> => result.status === 'fulfilled')
        .map(result => result.value);
      
      if (validQuotes.length === 0) {
        return 'Market data unavailable at this time.';
      }
      
      return await GeminiAPI.generateMarketSummary(validQuotes);
    } catch (error) {
      console.warn('Failed to generate market summary:', error);
      return 'Market summary unavailable at this time.';
    }
  }
  
  // Analyze chart data for trends
  private static analyzeChartData(data: ChartDataPoint[]): { recentTrend: 'up' | 'down' | 'sideways'; volatility: 'high' | 'medium' | 'low' } {
    if (data.length < 2) {
      return { recentTrend: 'sideways', volatility: 'low' };
    }
    
    const recent = data.slice(-10); // Last 10 data points
    const firstPrice = recent[0].price;
    const lastPrice = recent[recent.length - 1].price;
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Determine trend
    let recentTrend: 'up' | 'down' | 'sideways';
    if (changePercent > 1) recentTrend = 'up';
    else if (changePercent < -1) recentTrend = 'down';
    else recentTrend = 'sideways';
    
    // Calculate volatility
    const prices = recent.map(d => d.price);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;
    
    let volatility: 'high' | 'medium' | 'low';
    if (coefficientOfVariation > 0.05) volatility = 'high';
    else if (coefficientOfVariation > 0.02) volatility = 'medium';
    else volatility = 'low';
    
    return { recentTrend, volatility };
  }
  
  // Get comprehensive stock data
  static async getStockData(symbol: string) {
    try {
      const [quote, chartData, news] = await Promise.allSettled([
        this.getStockQuote(symbol),
        this.getChartData(symbol, '1mo'),
        this.getStockNews(symbol, 5),
      ]);
      
      const stockQuote = quote.status === 'fulfilled' ? quote.value : null;
      const stockChart = chartData.status === 'fulfilled' ? chartData.value : [];
      let stockNews = news.status === 'fulfilled' ? news.value : [];
      
      if (!stockQuote) {
        throw new APIError(`Failed to get data for ${symbol}`);
      }
      
      // Translate news to Korean using DeepL backend
      if (stockNews.length > 0) {
        try {
          stockNews = await DeepLTranslation.translateNews(stockNews);
        } catch (error) {
          console.warn('[DeepL] News translation failed:', error);
          // Fallback: use original English news
        }
      }
      
      // Get AI analysis
      const analysis = await this.getStockAnalysis(stockQuote, stockNews, stockChart);
      
      return {
        quote: stockQuote,
        chartData: stockChart,
        news: stockNews,
        analysis,
      };
    } catch (error) {
      throw new APIError(`Failed to get comprehensive stock data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
