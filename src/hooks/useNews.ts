/**
 * Custom hook for fetching news data
 */

import { useState, useEffect, useCallback } from 'react';
import { newsService } from '../services';
import { NewsItem } from '../types';

interface UseNewsResult {
  news: NewsItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useNews(limit: number = 20): UseNewsResult {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newsData = await newsService.getFinancialNews(limit);
      setNews(newsData);
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return {
    news,
    isLoading,
    error,
    refetch: fetchNews,
  };
}

export function useStockNews(symbol: string | null, limit: number = 10): UseNewsResult {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    if (!symbol) {
      setNews([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newsData = await newsService.getStockRelatedNews(symbol, limit);
      setNews(newsData);
    } catch (err) {
      console.error('Failed to fetch stock news:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, limit]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return {
    news,
    isLoading,
    error,
    refetch: fetchNews,
  };
}
