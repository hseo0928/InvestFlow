import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Target, Loader2, AlertCircle } from "lucide-react";
import { API_CONFIG } from "../lib/api-config";

interface FundamentalsPanelProps {
  stockSymbol: string;
}

export function FundamentalsPanel({ stockSymbol }: FundamentalsPanelProps) {
  const [ratios, setRatios] = useState<any>(null);
  const [dcf, setDcf] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFundamentals();
  }, [stockSymbol]);

  const loadFundamentals = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [ratiosRes, dcfRes] = await Promise.allSettled([
        fetch(`${API_CONFIG.BACKEND_API_URL}/fundamentals/${stockSymbol}/ratios`),
        fetch(`${API_CONFIG.BACKEND_API_URL}/fundamentals/${stockSymbol}/dcf`)
      ]);

      if (ratiosRes.status === 'fulfilled' && ratiosRes.value.ok) {
        const ratiosData = await ratiosRes.value.json();
        setRatios(ratiosData);
      }

      if (dcfRes.status === 'fulfilled' && dcfRes.value.ok) {
        const dcfData = await dcfRes.value.json();
        setDcf(dcfData);
      }

      if (ratiosRes.status === 'rejected' && dcfRes.status === 'rejected') {
        setError('Failed to load fundamental data');
      }
    } catch (err) {
      console.error('Failed to load fundamentals:', err);
      setError('Failed to load fundamental data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>재무 데이터 로딩 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !ratios && !dcf) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3 text-slate-500">
            <AlertCircle className="w-6 h-6" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Ratios */}
      {ratios && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              재무 비율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="profitability" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profitability">수익성</TabsTrigger>
                <TabsTrigger value="health">재무건전성</TabsTrigger>
                <TabsTrigger value="valuation">밸류에이션</TabsTrigger>
              </TabsList>

              <TabsContent value="profitability" className="space-y-4">
                {ratios.profitability && (
                  <div className="grid grid-cols-2 gap-4">
                    {ratios.profitability.roe !== null && (
                      <MetricCard
                        label="ROE"
                        value={`${ratios.profitability.roe.toFixed(2)}%`}
                        icon={<TrendingUp className="w-4 h-4" />}
                        positive={ratios.profitability.roe > 15}
                      />
                    )}
                    {ratios.profitability.roa !== null && (
                      <MetricCard
                        label="ROA"
                        value={`${ratios.profitability.roa.toFixed(2)}%`}
                        icon={<TrendingUp className="w-4 h-4" />}
                        positive={ratios.profitability.roa > 5}
                      />
                    )}
                    {ratios.profitability.net_margin !== null && (
                      <MetricCard
                        label="순이익률"
                        value={`${ratios.profitability.net_margin.toFixed(2)}%`}
                        icon={<TrendingUp className="w-4 h-4" />}
                        positive={ratios.profitability.net_margin > 10}
                      />
                    )}
                    {ratios.profitability.gross_margin !== null && (
                      <MetricCard
                        label="매출총이익률"
                        value={`${ratios.profitability.gross_margin.toFixed(2)}%`}
                        icon={<TrendingUp className="w-4 h-4" />}
                        positive={ratios.profitability.gross_margin > 30}
                      />
                    )}
                    {ratios.profitability.operating_margin !== null && (
                      <MetricCard
                        label="영업이익률"
                        value={`${ratios.profitability.operating_margin.toFixed(2)}%`}
                        icon={<TrendingUp className="w-4 h-4" />}
                        positive={ratios.profitability.operating_margin > 10}
                      />
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="health" className="space-y-4">
                {ratios.financial_health && (
                  <div className="grid grid-cols-2 gap-4">
                    {ratios.financial_health.debt_to_equity !== null && (
                      <MetricCard
                        label="부채비율"
                        value={ratios.financial_health.debt_to_equity.toFixed(2)}
                        icon={<BarChart3 className="w-4 h-4" />}
                        positive={ratios.financial_health.debt_to_equity < 1}
                      />
                    )}
                    {ratios.financial_health.current_ratio !== null && (
                      <MetricCard
                        label="유동비율"
                        value={ratios.financial_health.current_ratio.toFixed(2)}
                        icon={<BarChart3 className="w-4 h-4" />}
                        positive={ratios.financial_health.current_ratio > 1}
                      />
                    )}
                    {ratios.financial_health.quick_ratio !== null && (
                      <MetricCard
                        label="당좌비율"
                        value={ratios.financial_health.quick_ratio.toFixed(2)}
                        icon={<BarChart3 className="w-4 h-4" />}
                        positive={ratios.financial_health.quick_ratio > 1}
                      />
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="valuation" className="space-y-4">
                {ratios.valuation && (
                  <div className="grid grid-cols-2 gap-4">
                    {ratios.valuation.pe_ratio !== null && (
                      <MetricCard
                        label="P/E 비율"
                        value={ratios.valuation.pe_ratio.toFixed(2)}
                        icon={<DollarSign className="w-4 h-4" />}
                        positive={ratios.valuation.pe_ratio < 25}
                      />
                    )}
                    {ratios.valuation.pb_ratio !== null && (
                      <MetricCard
                        label="P/B 비율"
                        value={ratios.valuation.pb_ratio.toFixed(2)}
                        icon={<DollarSign className="w-4 h-4" />}
                        positive={ratios.valuation.pb_ratio < 3}
                      />
                    )}
                    {ratios.valuation.ps_ratio !== null && (
                      <MetricCard
                        label="P/S 비율"
                        value={ratios.valuation.ps_ratio.toFixed(2)}
                        icon={<DollarSign className="w-4 h-4" />}
                        positive={ratios.valuation.ps_ratio < 5}
                      />
                    )}
                    {ratios.valuation.market_cap && (
                      <MetricCard
                        label="시가총액"
                        value={`$${(ratios.valuation.market_cap / 1e9).toFixed(1)}B`}
                        icon={<DollarSign className="w-4 h-4" />}
                      />
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* DCF Valuation */}
      {dcf && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              DCF 밸류에이션
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Valuation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">내재가치</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${dcf.intrinsic_value_per_share?.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">현재가</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${dcf.current_price?.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">안전마진</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${dcf.margin_of_safety > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dcf.margin_of_safety?.toFixed(2)}%
                  </p>
                  {dcf.margin_of_safety > 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Valuation Details */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">밸류에이션 상세</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">최근 FCF</span>
                  <span className="font-medium">${(dcf.latest_fcf / 1e9).toFixed(2)}B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">기업가치 (EV)</span>
                  <span className="font-medium">${(dcf.enterprise_value / 1e9).toFixed(2)}B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">순부채</span>
                  <span className="font-medium">${(dcf.net_debt / 1e9).toFixed(2)}B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">자기자본가치</span>
                  <span className="font-medium">${(dcf.equity_value / 1e9).toFixed(2)}B</span>
                </div>
              </div>
            </div>

            {/* Assumptions */}
            {dcf.assumptions && (
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-3">가정</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">성장률</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {(dcf.assumptions.growth_rate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 mb-1">할인율</p>
                    <p className="text-lg font-semibold text-purple-900">
                      {(dcf.assumptions.discount_rate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">예측기간</p>
                    <p className="text-lg font-semibold text-green-900">
                      {dcf.assumptions.projection_years}년
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Interpretation */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-slate-700">
                {dcf.margin_of_safety > 20
                  ? '💎 내재가치가 현재가보다 크게 높아 저평가된 것으로 보입니다.'
                  : dcf.margin_of_safety > 0
                  ? '✅ 내재가치가 현재가보다 높아 적정 가격 이하로 거래되고 있습니다.'
                  : dcf.margin_of_safety > -20
                  ? '⚠️ 현재가가 내재가치보다 높아 고평가 가능성이 있습니다.'
                  : '🚨 현재가가 내재가치를 크게 초과하여 고평가된 것으로 보입니다.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper component for metric cards
function MetricCard({ 
  label, 
  value, 
  icon, 
  positive 
}: { 
  label: string; 
  value: string; 
  icon?: React.ReactNode; 
  positive?: boolean;
}) {
  return (
    <div className="p-4 bg-slate-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">{label}</p>
        {icon && (
          <span className={positive !== undefined ? (positive ? 'text-green-600' : 'text-red-600') : 'text-slate-600'}>
            {icon}
          </span>
        )}
      </div>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
