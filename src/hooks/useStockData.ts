/**
 * Custom hook for fetching and managing stock data
 */

import { useState, useEffect, useCallback } from 'react';
import { StockDataService } from '../services';
import { StockQuote, NewsItem, AIAnalysis } from '../types';

interface UseStockDataResult {
  quote: StockQuote | null;
  news: NewsItem[];
  analysis: AIAnalysis | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStockData(symbol: string | null): UseStockDataResult {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!symbol) {
      setQuote(null);
      setNews([]);
      setAnalysis(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await StockDataService.getStockData(symbol);
      setQuote(data.quote);
      setNews(data.news);
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Failed to load stock data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    quote,
    news,
    analysis,
    isLoading,
    error,
    refetch: fetchData,
  };
}
