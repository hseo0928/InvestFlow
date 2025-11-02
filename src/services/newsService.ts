/**
 * Unified service for news data
 */

import { NewsItem, APIError } from '../types';

class NewsService {
  private backendURL: string;

  constructor() {
    this.backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002';
  }

  async getFinancialNews(limit: number = 20): Promise<NewsItem[]> {
    try {
      const response = await fetch(`${this.backendURL}/api/news?limit=${limit}`);
      
      if (!response.ok) {
        throw new APIError(
          `Failed to fetch news: ${response.statusText}`,
          response.status,
          'backend'
        );
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('Failed to fetch news:', error);
      return [];
    }
  }

  async getStockRelatedNews(symbol: string, limit: number = 10): Promise<NewsItem[]> {
    // For now, get general financial news
    // In the future, this could filter by symbol
    const allNews = await this.getFinancialNews(limit * 2);
    
    // Simple keyword matching for stock-related news
    const symbolLower = symbol.toLowerCase();
    const filtered = allNews.filter(item => 
      item.title.toLowerCase().includes(symbolLower) ||
      item.summary.toLowerCase().includes(symbolLower)
    );
    
    return filtered.length > 0 ? filtered.slice(0, limit) : allNews.slice(0, limit);
  }
}

// Export singleton instance
export const newsService = new NewsService();
