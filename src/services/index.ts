/**
 * Main service orchestrator
 * Provides high-level API for components
 */

import { stockAPIClient } from './stockAPIClient';
import { aiService } from './aiService';
import { newsService } from './newsService';
import { StockQuote, NewsItem, AIAnalysis, ChartDataPoint, StockSearchResult } from '../types';

export class StockDataService {
  // Stock quote methods
  static async getStockQuote(symbol: string): Promise<StockQuote> {
    return stockAPIClient.getQuote(symbol);
  }

  static async searchStocks(query: string): Promise<StockSearchResult[]> {
    return stockAPIClient.searchStocks(query);
  }

  static async getChartData(
    symbol: string,
    timeRange: '1d' | '1w' | '1mo' = '1mo'
  ): Promise<ChartDataPoint[]> {
    return stockAPIClient.getChartData(symbol, timeRange);
  }

  // Combined data fetch
  static async getStockData(symbol: string): Promise<{
    quote: StockQuote;
    news: NewsItem[];
    analysis: AIAnalysis;
  }> {
    // Fetch data in parallel
    const [quote, news] = await Promise.all([
      this.getStockQuote(symbol),
      newsService.getStockRelatedNews(symbol, 10),
    ]);

    // Generate AI analysis with the fetched data
    const analysis = await aiService.analyzeStock(quote, news);

    return { quote, news, analysis };
  }

  // News methods
  static async getFinancialNews(limit: number = 20): Promise<NewsItem[]> {
    return newsService.getFinancialNews(limit);
  }
}

// Re-export services for direct access if needed
export { stockAPIClient } from './stockAPIClient';
export { aiService } from './aiService';
export { newsService } from './newsService';
