/**
 * Custom hook for fetching and managing chart data
 */

import { useState, useEffect, useCallback } from 'react';
import { StockDataService } from '../services';
import { StockCacheService } from '../lib/stock-cache';
import { ChartDataPoint } from '../types';

interface UseChartDataResult {
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useChartData(
  symbol: string | null,
  period: '1d' | '1w' | '1mo' = '1mo'
): UseChartDataResult {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!symbol) {
      setChartData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Try to get from cache first
      const cachedData = StockCacheService.getFilteredData(symbol, period);
      if (cachedData && cachedData.length > 0) {
        console.log(`📦 Using cached data for ${symbol} (${cachedData.length} ${period} candles)`);
        setChartData(cachedData);
        setIsLoading(false);
        
        // Background refresh
        StockCacheService.refreshCacheWithLatest(symbol).then((updated) => {
          if (updated) {
            const updatedCandles = StockCacheService.getFilteredData(symbol, period);
            if (updatedCandles) {
              setChartData(updatedCandles);
            }
          }
        });
        return;
      }
      
      // 2. Fetch from API if not cached
      console.log(`🌐 Fetching data for ${symbol}...`);
      const rawData = await StockDataService.getChartData(symbol, period);
      
      if (rawData && rawData.length > 0) {
        // Cache the data
        StockCacheService.setCachedData(symbol, rawData);
        
        // Get filtered data for the selected period
        const filteredData = StockCacheService.getFilteredData(symbol, period);
        setChartData(filteredData || rawData);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    chartData,
    isLoading,
    error,
    refetch: fetchData,
  };
}
