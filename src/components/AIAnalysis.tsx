import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, Target, BarChart3, Brain } from "lucide-react";
import { Progress } from "./ui/progress";
import { AIAnalysis as AIAnalysisType } from "../lib/api-config";

interface AIAnalysisProps {
  analysis: AIAnalysisType;
  stockSymbol: string;
}

export function AIAnalysis({ analysis, stockSymbol }: AIAnalysisProps) {
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'bearish':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <BarChart3 className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'text-green-500 bg-green-50 border-green-200';
      case 'bearish':
        return 'text-red-500 bg-red-50 border-red-200';
      default:
        return 'text-blue-500 bg-blue-50 border-blue-200';
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          AI 분석
          <Badge className={`ml-2 ${getSentimentColor(analysis.sentiment)}`}>
            {getSentimentIcon(analysis.sentiment)}
            <span className="ml-1 capitalize">{analysis.sentiment === 'bullish' ? '강세' : analysis.sentiment === 'bearish' ? '약세' : '중립'}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-2">요약</h4>
          <p className="text-sm text-slate-600 leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Confidence Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-900">AI 신뢰도</h4>
            <span className="text-sm text-slate-900">{Math.round(analysis.confidence * 100)}%</span>
          </div>
          <Progress value={analysis.confidence * 100} className="h-2" />
        </div>

        {/* Key Points */}
        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            주요 포인트
          </h4>
          <div className="space-y-2">
            {analysis.keyPoints.map((point, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-slate-600">{point}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-2">추천 의견</h4>
          <p className="text-sm text-slate-600 leading-relaxed">{analysis.recommendation}</p>
        </div>

        {/* Risk Factors */}
        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            위험 요소
          </h4>
          <div className="space-y-2">
            {analysis.riskFactors.map((risk, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm text-slate-600">{risk}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t pt-4">
          <p className="text-xs text-slate-500 italic">
            이 분석은 AI에 의해 생성되었으며 투자 조언으로 간주되어서는 안 됩니다. 
            투자 결정을 내리기 전에 항상 직접 조사하시기 바랍니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}