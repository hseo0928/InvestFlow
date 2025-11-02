/**
 * Custom hook for stock search functionality
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { StockDataService } from '../services';
import { StockSearchResult } from '../types';

interface UseStockSearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: StockSearchResult[];
  isSearching: boolean;
  error: string | null;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}

export function useStockSearch(
  onSelect?: (symbol: string) => void,
  debounceMs: number = 300
): UseStockSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const searchResults = await StockDataService.searchStocks(searchQuery);
      setResults(searchResults);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Stock search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    // Clear previous timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new timeout for debounced search
    if (query.trim()) {
      debounceTimeout.current = setTimeout(() => {
        search(query);
      }, debounceMs);
    } else {
      setResults([]);
      setIsSearching(false);
    }

    // Cleanup
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, debounceMs, search]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    selectedIndex,
    setSelectedIndex,
  };
}
