import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Newspaper, TrendingUp, TrendingDown, Clock, ExternalLink } from "lucide-react";
import { NewsItem as NewsItemType } from "../lib/api-config";

interface NewsAnalysisProps {
  stockSymbol: string;
  news: NewsItemType[];
}

export function NewsAnalysis({ stockSymbol, news }: NewsAnalysisProps) {
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'negative':
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3 text-blue-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'negative':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
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

  const positiveCount = news.filter(n => n.sentiment === 'positive').length;
  const negativeCount = news.filter(n => n.sentiment === 'negative').length;
  const neutralCount = news.filter(n => n.sentiment === 'neutral').length;

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-500" />
          뉴스 분석
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment Summary */}
        {news.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-900 mb-3">감성 분석 요약</h4>
            <div className="flex gap-2 flex-wrap">
              {positiveCount > 0 && (
                <Badge className="text-green-600 bg-green-50 border-green-200">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  긍정 {positiveCount}
                </Badge>
              )}
              {negativeCount > 0 && (
                <Badge className="text-red-600 bg-red-50 border-red-200">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  부정 {negativeCount}
                </Badge>
              )}
              {neutralCount > 0 && (
                <Badge className="text-blue-600 bg-blue-50 border-blue-200">
                  <Clock className="w-3 h-3 mr-1" />
                  중립 {neutralCount}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* News Items */}
        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-3">최근 뉴스</h4>
          <div className="space-y-3">
            {news.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{stockSymbol}의 최근 뉴스가 없습니다</p>
              </div>
            ) : (
              news.slice(0, 8).map((item, index) => (
                <div key={index} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h5 className="text-sm font-medium text-slate-900 leading-tight line-clamp-2">
                      {item.title}
                    </h5>
                    {item.sentiment && (
                      <Badge className={`${getSentimentColor(item.sentiment)} flex-shrink-0`}>
                        {getSentimentIcon(item.sentiment)}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-600 leading-relaxed mb-2 line-clamp-2">
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
                </div>
              ))
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t pt-3">
          <p className="text-xs text-slate-500 italic">
            뉴스 감성 분석은 자동화되어 있으며 실제 시장 영향을 반영하지 않을 수 있습니다. 
            원본 출처에서 정보를 확인하시기 바랍니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}