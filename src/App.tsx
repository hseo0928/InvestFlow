import { useState, useEffect } from "react";
import { HomePage } from "./components/HomePage";
import { StockAnalysis } from "./components/StockAnalysis";
import { TrendingUp, Home, ArrowLeft } from "lucide-react";
import { Button } from "./components/ui/button";
import { StockSearch } from "./components/StockSearch";
import { StockCacheService } from "./lib/stock-cache";

export default function App() {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  // 앱 시작시 인기 종목들 미리 로드
  useEffect(() => {
    // 백그라운드에서 인기 종목들 프리로딩 (비동기)
    StockCacheService.preloadPopularStocks().catch(err => 
      console.warn('Popular stocks preloading failed:', err)
    );
  }, []);

  const handleSelectStock = (symbol: string) => {
    setSelectedStock(symbol);
  };

  const handleGoHome = () => {
    setSelectedStock(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleGoHome}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-slate-900">AI Stock Insights</h1>
                  <p className="text-slate-500 text-sm hidden sm:block">AI가 분석하는 실시간 주식 정보</p>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-3">
              {selectedStock && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleGoHome}
                  className="flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">홈</span>
                </Button>
              )}
              <div className="w-64 sm:w-96">
                <StockSearch onSelectStock={handleSelectStock} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {selectedStock ? (
          <div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleGoHome}
              className="mb-4 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              돌아가기
            </Button>
            <StockAnalysis stockSymbol={selectedStock} />
          </div>
        ) : (
          <HomePage onSelectStock={handleSelectStock} />
        )}
      </main>
    </div>
  );
}
