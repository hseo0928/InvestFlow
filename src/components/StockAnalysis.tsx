import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { StockChart } from "./StockChart";
import { NewsAnalysis } from "./NewsAnalysis";
import { AIAnalysis } from "./AIAnalysis";
import { TrendingUp, TrendingDown, Volume2, DollarSign, BarChart3, Loader2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { StockDataService } from "../lib/stock-service";
import { DrawingToolbar } from "./DrawingToolbar";
import { formatVolume } from "./ui/utils";
import { AiSrService } from "../lib/ai-sr-service";
import { StockQuote, NewsItem, AIAnalysis as AIAnalysisType } from "../lib/api-config";

interface StockAnalysisProps {
  stockSymbol: string;
}

export function StockAnalysis({ stockSymbol }: StockAnalysisProps) {
  const [stockData, setStockData] = useState<StockQuote | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'1d' | '1w' | '1mo'>('1d');
  const [drawingMode, setDrawingMode] = useState<'select' | 'create-horizontal' | 'erase'>('select');

  useEffect(() => {
    loadStockData();
  }, [stockSymbol]);

  const loadStockData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await StockDataService.getStockData(stockSymbol);
      setStockData(data.quote);
      setNews(data.news);
      setAiAnalysis(data.analysis);
    } catch (err) {
      console.error('Failed to load stock data:', err);
      setError('Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>주식 데이터 로딩 중...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stockData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-slate-500">
            <AlertCircle className="w-6 h-6" />
            <span>{error || '주식 데이터를 사용할 수 없습니다'}</span>
          </div>
        </div>
      </div>
    );
  }

  const isPositive = stockData.change >= 0;

  return (
    <div className="space-y-6">
      {/* Stock Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-slate-900">{stockData.name}</h1>
            <Badge variant="outline" className="text-xs">{stockSymbol}</Badge>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-slate-900">${stockData.price.toFixed(2)}</span>
            <span className="text-slate-500">USD</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
            {isPositive ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            <div>
              <p className={`${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}${stockData.change.toFixed(2)}
              </p>
              <p className={`text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{stockData.changePercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">시가</p>
            <p className="text-sm text-slate-900">${stockData.open.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">고가</p>
            <p className="text-sm text-green-500">${stockData.high.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">저가</p>
            <p className="text-sm text-red-500">${stockData.low.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">거래량</p>
            <p className="text-sm text-slate-900">{formatVolume(stockData.volume)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">전일종가</p>
            <p className="text-sm text-slate-900">${stockData.previousClose.toFixed(2)}</p>
          </CardContent>
        </Card>
        {stockData.marketCap && (
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-500 mb-1">시가총액</p>
              <p className="text-sm text-slate-900">
                ${(stockData.marketCap / 1e9).toFixed(1)}B
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Chart */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between relative z-10" style={{ pointerEvents: 'auto' }}>
                <CardTitle>차트</CardTitle>
                <div className="flex items-center gap-3">
                  {(['1d', '1w', '1mo'] as const).map((period) => {
                    const periodLabels = {
                      '1d': '일봉',
                      '1w': '주봉',
                      '1mo': '월봉'
                    };
                    
                    return (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          selectedPeriod === period 
                            ? 'bg-slate-100 text-slate-900' 
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {periodLabels[period]}
                      </button>
                    );
                  })}
                  <DrawingToolbar
                    mode={drawingMode}
                    onModeChange={setDrawingMode}
                    onAiSuggest={async () => {
                      const levels = await AiSrService.suggest(stockSymbol, selectedPeriod);
                      window.dispatchEvent(new CustomEvent('aisr-levels', { detail: { symbol: stockSymbol, period: selectedPeriod, levels } }));
                    }}
                    onClearAI={() => {
                      window.dispatchEvent(new CustomEvent('clear-ai-levels', { detail: { symbol: stockSymbol, period: selectedPeriod } }));
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <StockChart stockSymbol={stockSymbol} period={selectedPeriod} drawingMode={drawingMode} />
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {aiAnalysis && <AIAnalysis analysis={aiAnalysis} stockSymbol={stockSymbol} />}
        </div>

        {/* Right Column - News */}
        <div className="lg:col-span-1">
          <NewsAnalysis stockSymbol={stockSymbol} news={news} />
        </div>
      </div>
    </div>
  );
}
