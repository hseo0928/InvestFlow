/**
 * News-related type definitions
 */

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface NewsAnalysisData {
  items: NewsItem[];
  totalCount: number;
  lastUpdate: string;
}
