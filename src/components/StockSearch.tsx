import { useState, useRef, useEffect } from "react";
import { Search, TrendingUp, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { StockDataService } from "../lib/stock-service";
import { StockSearchResult } from "../lib/api-config";

interface StockSearchProps {
  onSelectStock: (symbol: string) => void;
}

export function StockSearch({ onSelectStock }: StockSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [popularStocks, setPopularStocks] = useState<StockSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load popular stocks on mount
  useEffect(() => {
    async function loadPopularStocks() {
      try {
        const results = await StockDataService.searchStocks("");
        setPopularStocks(results);
      } catch (error) {
        console.error('Failed to load popular stocks:', error);
      }
    }
    loadPopularStocks();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchTerm.trim() === "") {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await StockDataService.searchStocks(searchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchTerm]);

  const displayStocks = searchTerm.trim() === "" ? popularStocks : searchResults;

  const handleSelectStock = (symbol: string, name: string) => {
    onSelectStock(symbol);
    setSearchTerm(name);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="주식 종목 검색..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" />
        )}
      </div>

      {isOpen && (
        <Card className="absolute top-full mt-2 w-full max-h-96 overflow-y-auto z-50 shadow-lg">
          <div className="p-2">
            {searchTerm.trim() === "" && (
              <div className="px-3 py-2 text-xs text-slate-500 font-medium flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                인기 종목
              </div>
            )}
            {displayStocks.length === 0 && searchTerm.trim() !== "" && !isLoading ? (
              <div className="px-3 py-8 text-center text-slate-500 text-sm">
                검색 결과가 없습니다
              </div>
            ) : (
              displayStocks.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock.symbol, stock.name)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-md transition-colors flex items-center justify-between group"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 text-sm">{stock.symbol}</div>
                    <div className="text-xs text-slate-500 truncate">{stock.name}</div>
                  </div>
                  <div className="text-xs text-slate-400 ml-2">
                    {stock.exchange}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
