import * as deepl from 'deepl-node';
import { API_CONFIG, NewsItem, AIAnalysis } from './api-config';

/**
 * DeepL Translation Service
 * Provides Korean translation for news and AI analysis using DeepL API
 */
export class DeepLTranslation {
  private static client: deepl.Translator | null = null;
  
  /**
   * Get or create DeepL client (Singleton pattern)
   */
  private static getClient(): deepl.Translator {
    if (!this.client) {
      if (!API_CONFIG.DEEPL_API_KEY) {
        throw new Error('DeepL API key not configured');
      }
      this.client = new deepl.Translator(API_CONFIG.DEEPL_API_KEY);
    }
    return this.client;
  }
  
  /**
   * Batch translate texts to Korean
   * @param texts - Array of texts to translate
   * @returns Array of translated texts (or original if translation fails)
   */
  static async translateToKorean(texts: string[]): Promise<string[]> {
    try {
      const client = this.getClient();
      
      // Filter out empty texts
      const validTexts = texts.filter(t => t && t.trim().length > 0);
      if (validTexts.length === 0) return texts;
      
      // DeepL batch translation API
      const results = await client.translateText(
        validTexts, 
        null,  // auto-detect source language
        'ko'   // target: Korean
      );
      
      // Map results back to original indices
      const translatedMap = new Map<string, string>();
      const resultsArray = Array.isArray(results) ? results : [results];
      validTexts.forEach((text, idx) => {
        const translated = resultsArray[idx]?.text || text;
        translatedMap.set(text, translated);
      });
      
      return texts.map(t => translatedMap.get(t) || t);
    } catch (error) {
      console.warn('[DeepL] Translation failed:', error);
      return texts; // fallback to original
    }
  }
  
  /**
   * Translate news items (title and summary)
   * @param newsItems - Array of news items to translate
   * @returns Array of translated news items
   */
  static async translateNews(newsItems: NewsItem[]): Promise<NewsItem[]> {
    if (newsItems.length === 0) return newsItems;
    
    try {
      // Extract all texts (title + summary pairs)
      const textsToTranslate: string[] = [];
      newsItems.forEach(item => {
        textsToTranslate.push(item.title);
        textsToTranslate.push(item.summary);
      });
      
      // Batch translate all texts at once
      const translated = await this.translateToKorean(textsToTranslate);
      
      // Reconstruct news items with translations
      return newsItems.map((item, idx) => ({
        ...item,
        title: translated[idx * 2] || item.title,
        summary: translated[idx * 2 + 1] || item.summary,
      }));
    } catch (error) {
      console.warn('[DeepL] News translation failed:', error);
      return newsItems; // fallback to original
    }
  }
  
  /**
   * Translate AI analysis results
   * @param analysis - AI analysis object to translate
   * @returns Translated AI analysis object
   */
  static async translateAIAnalysis(analysis: AIAnalysis): Promise<AIAnalysis> {
    try {
      // Collect all texts to translate
      const textsToTranslate = [
        analysis.summary,
        analysis.recommendation,
        ...analysis.keyPoints,
        ...analysis.riskFactors,
      ];
      
      // Batch translate
      const translated = await this.translateToKorean(textsToTranslate);
      
      // Reconstruct analysis with translations
      let idx = 0;
      return {
        ...analysis,
        summary: translated[idx++],
        recommendation: translated[idx++],
        keyPoints: analysis.keyPoints.map(() => translated[idx++]),
        riskFactors: analysis.riskFactors.map(() => translated[idx++]),
      };
    } catch (error) {
      console.warn('[DeepL] AI analysis translation failed:', error);
      return analysis; // fallback to original
    }
  }
}
