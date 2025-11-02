import { API_CONFIG, NewsItem, AIAnalysis } from './api-config';

/**
 * DeepL Translation Service (Backend API)
 * Provides Korean translation for news and AI analysis using backend DeepL API
 */
export class DeepLTranslation {
  private static readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002';
  
  /**
   * Batch translate texts to Korean via backend
   * @param texts - Array of texts to translate
   * @returns Array of translated texts (or original if translation fails)
   */
  static async translateToKorean(texts: string[]): Promise<string[]> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/api/translate/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts })
      });
      
      if (!response.ok) {
        throw new Error(`Translation API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.translated || texts;
      
    } catch (error) {
      console.warn('[DeepL] Translation failed:', error);
      return texts;
    }
  }
  
  /**
   * Translate news items (title and summary) to Korean via backend
   * @param newsItems - Array of news items
   * @returns Array of translated news items
   */
  static async translateNews(newsItems: NewsItem[]): Promise<NewsItem[]> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/api/translate/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news: newsItems })
      });
      
      if (!response.ok) {
        throw new Error(`Translation API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.translated || newsItems;
      
    } catch (error) {
      console.warn('[DeepL] News translation failed:', error);
      return newsItems;
    }
  }
  
  /**
   * Translate AI analysis to Korean via backend
   * @param analysis - AI analysis object
   * @returns Translated AI analysis
   */
  static async translateAIAnalysis(analysis: AIAnalysis): Promise<AIAnalysis> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/api/translate/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis })
      });
      
      if (!response.ok) {
        throw new Error(`Translation API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.translated || analysis;
      
    } catch (error) {
      console.warn('[DeepL] AI analysis translation failed:', error);
      return analysis;
    }
  }
}
