import { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Newspaper, Clock, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { StockDataService } from "../lib/stock-service";
import { NewsAPI } from "../lib/news-api";
import { GeminiAPI } from "../lib/gemini-ai";
import { StockQuote, NewsItem } from "../lib/api-config";
import { formatVolume } from "./ui/utils";

interface HomePageProps {
  onSelectStock: (symbol: string) => void;
}

const POPULAR_SYMBOLS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "NFLX"];

export function HomePage({ onSelectStock }: HomePageProps) {
  const [popularStocks, setPopularStocks] = useState<StockQuote[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [marketSummary, setMarketSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHomePageData();
  }, []);

  const loadHomePageData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stockPromises = POPULAR_SYMBOLS.map(symbol => 
        StockDataService.getStockQuote(symbol).catch(err => {
          console.warn(`Failed to load ${symbol}:`, err);
          return null;
        })
      );

      const [stockResults, newsResults, summaryResults] = await Promise.allSettled([
        Promise.all(stockPromises),
        NewsAPI.getAllNews(20),
        StockDataService.getMarketSummary(POPULAR_SYMBOLS),
      ]);

      if (stockResults.status === 'fulfilled') {
        const validStocks = stockResults.value.filter((stock): stock is StockQuote => stock !== null);
        setPopularStocks(validStocks);
      }

      if (newsResults.status === 'fulfilled') {
        let newsData = newsResults.value;
        // Translate news to Korean
        try {
          newsData = await GeminiAPI.translateNews(newsData);
        } catch (error) {
          console.warn('News translation failed:', error);
        }
        setNews(newsData);
      }

      if (summaryResults.status === 'fulfilled') {
        setMarketSummary(summaryResults.value);
      }

    } catch (err) {
      console.error('Failed to load homepage data:', err);
      setError('시장 데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (publishedAt: string) => {
    const now = new Date();
    const published = new Date(publishedAt);
    const diffInMinutes = Math.floor((now.getTime() - published.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}시간 전`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}일 전`;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>시장 데이터 로딩 중...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-slate-500">
            <AlertCircle className="w-6 h-6" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-slate-900 mb-2">AI 주식 인사이트에 오신 것을 환영합니다</h1>
        <p className="text-slate-600">
          인공지능 기반 실시간 주식 분석 서비스
        </p>
        {marketSummary && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{marketSummary}</p>
          </div>
        )}
      </div>

      <Tabs defaultValue="stocks" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stocks" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            인기 종목
          </TabsTrigger>
          <TabsTrigger value="news" className="flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            시장 뉴스
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stocks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              return (
                <Card 
                  key={stock.symbol} 
                  className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onSelectStock(stock.symbol)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-slate-900">{stock.symbol}</h3>
                        <p className="text-xs text-slate-500 truncate">{stock.name}</p>
                      </div>
                      <Badge 
                        className={isPositive ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}
                      >
                        {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold text-slate-900">
                          ${stock.price.toFixed(2)}
                        </span>
                        <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}${stock.change.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-500">
                        거래량: {formatVolume(stock.volume)}
                        {stock.marketCap && (
                          <span className="ml-2">
                            시총: ${(stock.marketCap / 1e9).toFixed(1)}B
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="news" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {news.length === 0 ? (
              <div className="col-span-2 text-center py-12">
                <Newspaper className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">뉴스를 불러올 수 없습니다</p>
              </div>
            ) : (
              news.slice(0, 8).map((item, index) => (
                <Card key={index} className="border-slate-200 hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-medium text-slate-900 leading-tight line-clamp-2">
                        {item.title}
                      </h3>
                      {item.sentiment && (
                        <Badge 
                          className={
                            item.sentiment === 'positive' 
                              ? 'bg-green-50 text-green-600 border-green-200'
                              : item.sentiment === 'negative'
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-blue-50 text-blue-600 border-blue-200'
                          }
                        >
                          {item.sentiment === 'positive' ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : item.sentiment === 'negative' ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-600 leading-relaxed mb-3 line-clamp-3">
                      {item.summary}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{item.source}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatTimeAgo(item.publishedAt)}</span>
                        {item.url && item.url !== '#' && (
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
