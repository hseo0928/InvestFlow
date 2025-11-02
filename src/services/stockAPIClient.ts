/**
 * Unified API client for stock data
 * Consolidates kis-api, yfinance-api, and twelvedata into a single service
 */

import { StockQuote, ChartDataPoint, StockSearchResult, APIError } from '../types';
import { API_CONFIG } from '../lib/api-config';

type APIProvider = 'twelvedata' | 'yfinance' | 'kis';

interface APIStrategy {
  name: APIProvider;
  getQuote: (symbol: string) => Promise<StockQuote>;
  searchStocks: (query: string) => Promise<StockSearchResult[]>;
  getChartData: (symbol: string, range: string) => Promise<ChartDataPoint[]>;
}

class StockAPIClient {
  private strategies: APIStrategy[] = [];
  private backendURL: string;

  constructor() {
    this.backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002';
    this.initializeStrategies();
  }

  private initializeStrategies() {
    // All API calls now go through the backend
    this.strategies = [
      {
        name: 'yfinance',
        getQuote: (symbol) => this.fetchFromBackend(`/api/quote/${symbol}`),
        searchStocks: (query) => this.fetchFromBackend(`/api/search?q=${encodeURIComponent(query)}`),
        getChartData: (symbol, range) => this.fetchFromBackend(`/api/history/${symbol}?range=${range}`)
      }
    ];
  }

  private async fetchFromBackend<T>(endpoint: string): Promise<T> {
    const url = `${this.backendURL}${endpoint}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new APIError(
          `Backend API error: ${response.statusText}`,
          response.status,
          'backend'
        );
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'network'
      );
    }
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    for (const strategy of this.strategies) {
      try {
        const quote = await strategy.getQuote(symbol);
        return quote;
      } catch (error) {
        console.warn(`${strategy.name} failed for getQuote:`, error);
        if (strategy === this.strategies[this.strategies.length - 1]) {
          throw new APIError(
            `Failed to get quote for ${symbol}: All APIs failed`,
            undefined,
            'all'
          );
        }
      }
    }
    throw new APIError(`No API strategies available`);
  }

  async searchStocks(query: string): Promise<StockSearchResult[]> {
    if (!query.trim()) return [];

    for (const strategy of this.strategies) {
      try {
        const results = await strategy.searchStocks(query);
        if (results.length > 0) return results;
      } catch (error) {
        console.warn(`${strategy.name} failed for searchStocks:`, error);
      }
    }
    return [];
  }

  async getChartData(
    symbol: string,
    timeRange: '1d' | '1w' | '1mo' = '1mo'
  ): Promise<ChartDataPoint[]> {
    for (const strategy of this.strategies) {
      try {
        const data = await strategy.getChartData(symbol, timeRange);
        if (data && data.length > 0) {
          return data;
        }
      } catch (error) {
        console.warn(`${strategy.name} failed for getChartData:`, error);
      }
    }
    throw new APIError(
      `Failed to get chart data for ${symbol}: All APIs failed`,
      undefined,
      'all'
    );
  }
}

// Export singleton instance
export const stockAPIClient = new StockAPIClient();
