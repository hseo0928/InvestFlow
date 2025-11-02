import { API_CONFIG, APIError, StockQuote, StockSearchResult, ChartDataPoint, apiRequest } from './api-config';

// TwelveData API client for enhanced stock data
export class TwelveDataAPI {
  private static readonly BASE_URL = API_CONFIG.TWELVEDATA_BASE_URL;
  private static readonly API_KEY = API_CONFIG.TWELVEDATA_API_KEY;
  
  // Get real-time stock quote
  static async getQuote(symbol: string): Promise<StockQuote> {
    if (!this.API_KEY) {
      throw new APIError('TwelveData API key not configured');
    }
    
    try {
      const url = `${this.BASE_URL}/quote?symbol=${symbol}&apikey=${this.API_KEY}`;
      const data = await apiRequest<any>(url);
      
      if (data.status === 'error') {
        throw new APIError(data.message || 'TwelveData API error');
      }
      
      const price = parseFloat(data.close || 0);
      const change = parseFloat(data.change || 0);
      const changePercent = parseFloat(data.percent_change || 0);
      
      return {
        symbol: data.symbol,
        name: data.name || data.symbol,
        price: price,
        change: change,
        changePercent: changePercent,
        volume: parseInt(data.volume || 0),
        high: parseFloat(data.high || price),
        low: parseFloat(data.low || price),
        open: parseFloat(data.open || price),
        previousClose: parseFloat(data.previous_close || (price - change)),
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`TwelveData quote error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Get historical time series data
  static async getChartData(
    symbol: string,
    interval: '1min' | '5min' | '15min' | '30min' | '45min' | '1h' | '2h' | '4h' | '1day' = '1day',
    outputsize: number = 100
  ): Promise<ChartDataPoint[]> {
    if (!this.API_KEY) {
      throw new APIError('TwelveData API key not configured');
    }
    
    try {
      const url = `${this.BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${this.API_KEY}`;
      const data = await apiRequest<any>(url);
      
      if (data.status === 'error') {
        throw new APIError(data.message || 'TwelveData API error');
      }
      
      if (!data.values || !Array.isArray(data.values)) {
        throw new APIError('No time series data available');
      }
      
      return data.values.map((item: any) => ({
        timestamp: new Date(item.datetime).getTime(),
        price: parseFloat(item.close), // 하위 호환성
        volume: parseInt(item.volume || 0),
        date: item.datetime,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
      })).reverse(); // TwelveData returns newest first, we want oldest first
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`TwelveData chart error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Search for stocks
  static async searchStocks(query: string): Promise<StockSearchResult[]> {
    if (!this.API_KEY) {
      throw new APIError('TwelveData API key not configured');
    }
    
    try {
      const url = `${this.BASE_URL}/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${this.API_KEY}`;
      const data = await apiRequest<any>(url);
      
      if (data.status === 'error') {
        throw new APIError(data.message || 'TwelveData API error');
      }
      
      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }
      
      return data.data.slice(0, 10).map((item: any) => ({
        symbol: item.symbol,
        name: item.instrument_name || item.symbol,
        exchange: item.exchange || 'Unknown',
        type: item.instrument_type || 'stock',
      }));
    } catch (error) {
      // For search errors, return empty array instead of throwing
      console.warn('TwelveData search error:', error);
      return [];
    }
  }
  
  // Get company profile/fundamentals
  static async getCompanyProfile(symbol: string): Promise<any> {
    if (!this.API_KEY) {
      throw new APIError('TwelveData API key not configured');
    }
    
    try {
      const url = `${this.BASE_URL}/profile?symbol=${symbol}&apikey=${this.API_KEY}`;
      const data = await apiRequest<any>(url);
      
      if (data.status === 'error') {
        throw new APIError(data.message || 'TwelveData API error');
      }
      
      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(`TwelveData profile error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}