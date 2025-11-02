import { API_CONFIG, APIError, NewsItem } from './api-config';

// News API client for financial news
export class NewsAPI {
  // Parse RSS feed from Financial Juice
  static async getFinancialJuiceNews(): Promise<NewsItem[]> {
    try {
      const rssUrl = API_CONFIG.FINANCIAL_JUICE_RSS;
      
      // URL 유효성 검사
      if (!rssUrl || rssUrl === 'undefined' || rssUrl.trim() === '') {
        console.warn('⚠️ Financial Juice RSS URL이 설정되지 않음');
        return [];
      }
      
      // Direct fetch without CORS proxy - use RSS2JSON service
      const encodedUrl = encodeURIComponent(rssUrl);
      const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodedUrl}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new APIError(`Failed to fetch RSS: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.items || !Array.isArray(data.items)) {
        return [];
      }
      
      const news: NewsItem[] = data.items.slice(0, 20).map((item: any) => ({
        title: item.title || 'Untitled',
        summary: item.description || item.content || '',
        url: item.link || '#',
        source: 'Financial Juice',
        publishedAt: item.pubDate || new Date().toISOString(),
        sentiment: this.analyzeSentiment(item.title + ' ' + (item.description || '')),
      }));
      
      return news;
    } catch (error) {
      console.warn('📰 Financial Juice RSS fetch error:', error);
      console.warn('📰 RSS URL:', API_CONFIG.FINANCIAL_JUICE_RSS);
      return [];
    }
  }
  
  // SaveTicker API 크롤링
  static async getSaveTickerNews(): Promise<NewsItem[]> {
    try {
      console.log('🎯 [SaveTicker] API 호출 시작');
      
      // Use CORS proxy to access SaveTicker API
      const proxyUrl = 'https://api.allorigins.win/get?url=';
      const targetUrl = encodeURIComponent('https://api.saveticker.com/api/news/list');
      const fullUrl = proxyUrl + targetUrl;
      
      console.log('🎯 [SaveTicker] 요청 URL:', fullUrl);
      
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        console.error('🎯 [SaveTicker] HTTP 에러:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🎯 [SaveTicker] 프록시 응답:', data);
      
      let newsData;
      try {
        newsData = JSON.parse(data.contents);
        console.log('🎯 [SaveTicker] 파싱된 뉴스 데이터:', newsData);
      } catch (parseError) {
        console.error('🎯 [SaveTicker] JSON 파싱 실패:', parseError);
        console.log('🎯 [SaveTicker] 원본 contents:', data.contents);
        return [];
      }

      if (!newsData.news_list || !Array.isArray(newsData.news_list)) {
        console.warn('🎯 [SaveTicker] news_list가 배열이 아님:', newsData);
        return [];
      }

      console.log('🎯 [SaveTicker] 원본 뉴스 수:', newsData.news_list.length);

      const newsItems: NewsItem[] = newsData.news_list.slice(0, 15).map((item: any) => {
        const newsItem: NewsItem = {
          title: item.title || 'No title',
          summary: item.content || 'No content',
          url: '#', // SaveTicker doesn't provide direct URL
          source: item.source || 'SaveTicker',
          publishedAt: item.created_at || new Date().toISOString(),
          sentiment: 'neutral'
        };
        
        // Apply sentiment analysis
        const sentimentResult = this.analyzeSentiment(newsItem.title + ' ' + newsItem.summary);
        newsItem.sentiment = sentimentResult;
        
        console.log('🎯 [SaveTicker] 변환된 뉴스:', newsItem.title.substring(0, 50));
        
        return newsItem;
      });

      console.log('🎯 [SaveTicker] 최종 변환된 뉴스 수:', newsItems.length);
      
      return newsItems;
    } catch (error) {
      console.error('🎯 [SaveTicker] API 호출 실패:', error);
      return [];
    }
  }
  
  // Get combined news from all sources
  static async getAllNews(maxItems: number = 20): Promise<NewsItem[]> {
    try {
      console.log('📰 [NewsAPI] getAllNews 시작, maxItems:', maxItems);
      
      const [financialJuiceResults, saveTickerResults] = await Promise.allSettled([
        this.getFinancialJuiceNews(),
        this.getSaveTickerNews()
      ]);

      const allNews: NewsItem[] = [];

      if (financialJuiceResults.status === 'fulfilled') {
        console.log('📰 [NewsAPI] Financial Juice 성공:', financialJuiceResults.value.length, '건');
        allNews.push(...financialJuiceResults.value);
      } else {
        console.warn('📰 [NewsAPI] Financial Juice 실패:', financialJuiceResults.reason);
      }

      if (saveTickerResults.status === 'fulfilled') {
        console.log('📰 [NewsAPI] SaveTicker 성공:', saveTickerResults.value.length, '건');
        allNews.push(...saveTickerResults.value);
      } else {
        console.warn('📰 [NewsAPI] SaveTicker 실패:', saveTickerResults.reason);
      }

      console.log('📰 [NewsAPI] 전체 뉴스:', allNews.length, '건');

      // Sort by published date (newest first)
      allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      const finalNews = allNews.slice(0, maxItems);
      console.log('📰 [NewsAPI] 최종 반환:', finalNews.length, '건');
      
      return finalNews;
    } catch (error) {
      console.error('📰 [NewsAPI] getAllNews 에러:', error);
      return [];
    }
  }  // Fallback news when APIs fail
  static getFallbackNews(): NewsItem[] {
    return [
      {
        title: '뉴스를 불러오는 중입니다',
        summary: 'API 연결을 확인하고 있습니다. 잠시만 기다려주세요.',
        url: '#',
        source: 'System',
        publishedAt: new Date().toISOString(),
        sentiment: 'neutral',
      }
    ];
  }
  
  // Get stock-specific news (filter by symbol)
  static async getStockNews(symbol: string, maxItems: number = 10): Promise<NewsItem[]> {
    const allNews = await this.getAllNews(50); // Get more news to filter from
    
    // Filter news that mentions the stock symbol or company
    const stockNews = allNews.filter(news => {
      const searchText = (news.title + ' ' + news.summary).toLowerCase();
      const symbolLower = symbol.toLowerCase();
      
      // Basic filtering - in production, you'd want more sophisticated matching
      return searchText.includes(symbolLower) || searchText.includes(this.getCompanyName(symbol).toLowerCase());
    });
    
    return stockNews.slice(0, maxItems);
  }
  
  // Simple sentiment analysis based on keywords
  private static analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const textLower = text.toLowerCase();
    
    const positiveWords = [
      'gain', 'gains', 'rally', 'up', 'rise', 'surge', 'bull', 'bullish',
      'growth', 'increase', 'breakthrough', 'success', 'strong', 'beat',
      'exceed', 'outperform', 'profit', 'revenue', 'earnings'
    ];
    
    const negativeWords = [
      'fall', 'falls', 'decline', 'down', 'drop', 'crash', 'bear', 'bearish',
      'loss', 'decrease', 'weak', 'miss', 'disappoint', 'concern', 'worry',
      'risk', 'threat', 'challenge', 'struggle'
    ];
    
    const positiveCount = positiveWords.reduce((count, word) => 
      count + (textLower.includes(word) ? 1 : 0), 0);
    const negativeCount = negativeWords.reduce((count, word) => 
      count + (textLower.includes(word) ? 1 : 0), 0);
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
  
  // Get company name from symbol (basic mapping)
  private static getCompanyName(symbol: string): string {
    const companyMap: Record<string, string> = {
      'AAPL': 'Apple',
      'GOOGL': 'Google Alphabet',
      'MSFT': 'Microsoft',
      'AMZN': 'Amazon',
      'TSLA': 'Tesla',
      'META': 'Meta Facebook',
      'NVDA': 'NVIDIA',
      'NFLX': 'Netflix',
      'AMD': 'AMD',
      'CRM': 'Salesforce',
      'UBER': 'Uber',
      'SPOT': 'Spotify',
      'COIN': 'Coinbase',
      'SHOP': 'Shopify',
      'SQ': 'Block Square',
    };
    
    return companyMap[symbol.toUpperCase()] || symbol;
  }
}