/**
 * Unified service for AI analysis
 * Consolidates Gemini and OpenRouter API calls
 */

import { AIAnalysis, ChartAnalysis, StockQuote, NewsItem, APIError } from '../types';
import { API_CONFIG } from '../lib/api-config';
import { GoogleGenAI } from '@google/genai';

class AIService {
  private geminiClient: GoogleGenAI | null = null;
  private backendURL: string;

  constructor() {
    this.backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002';
    if (API_CONFIG.GEMINI_API_KEY) {
      this.geminiClient = new GoogleGenAI({ apiKey: API_CONFIG.GEMINI_API_KEY });
    }
  }

  async analyzeStock(
    stock: StockQuote,
    news: NewsItem[],
    chartData?: ChartAnalysis
  ): Promise<AIAnalysis> {
    // Try Gemini first
    if (this.geminiClient) {
      try {
        return await this.analyzeWithGemini(stock, news, chartData);
      } catch (error) {
        console.warn('Gemini AI failed, trying OpenRouter:', error);
      }
    }

    // Fallback to OpenRouter
    try {
      return await this.analyzeWithOpenRouter(stock, news, chartData);
    } catch (error) {
      console.warn('OpenRouter also failed:', error);
      return this.getFallbackAnalysis(stock);
    }
  }

  private async analyzeWithGemini(
    stock: StockQuote,
    news: NewsItem[],
    chartData?: ChartAnalysis
  ): Promise<AIAnalysis> {
    if (!this.geminiClient) {
      throw new APIError('Gemini client not initialized');
    }

    const prompt = this.buildPrompt(stock, news, chartData);
    const response = await this.geminiClient.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });

    const text = response.text;
    if (!text) {
      throw new APIError('Empty response from Gemini');
    }

    return this.parseAIResponse(text);
  }

  private async analyzeWithOpenRouter(
    stock: StockQuote,
    news: NewsItem[],
    chartData?: ChartAnalysis
  ): Promise<AIAnalysis> {
    const prompt = this.buildPrompt(stock, news, chartData);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new APIError(`OpenRouter API error: ${response.statusText}`, response.status);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new APIError('Empty response from OpenRouter');
    }

    return this.parseAIResponse(content);
  }

  private buildPrompt(
    stock: StockQuote,
    news: NewsItem[],
    chartData?: ChartAnalysis
  ): string {
    const newsContext = news.length > 0 
      ? news.map(n => `- ${n.title}: ${n.summary}`).join('\n')
      : 'No recent news available';
    
    const chartContext = chartData 
      ? `Recent price trend: ${chartData.recentTrend}, Volatility: ${chartData.volatility}`
      : 'No chart analysis available';
    
    return `
As a financial analyst AI, provide a comprehensive analysis of ${stock.symbol} (${stock.name}).

Current Stock Data:
- Price: $${stock.price.toFixed(2)}
- Change: ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} (${stock.changePercent.toFixed(2)}%)
- Volume: ${stock.volume.toLocaleString()}
- Day Range: $${stock.low.toFixed(2)} - $${stock.high.toFixed(2)}
- Previous Close: $${stock.previousClose.toFixed(2)}

Recent News:
${newsContext}

Technical Analysis:
${chartContext}

Please provide your analysis in the following JSON format:
{
  "summary": "Brief 2-3 sentence overview of the stock's current situation",
  "sentiment": "bullish" | "bearish" | "neutral",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "recommendation": "Detailed recommendation with reasoning",
  "confidence": 0.85,
  "riskFactors": ["Risk 1", "Risk 2", "Risk 3"]
}

Ensure the confidence score is between 0 and 1, where 1 is highest confidence.
Base your analysis on the provided data, news sentiment, and general market knowledge.
Be objective and mention both positive and negative factors.
`;
  }

  private parseAIResponse(response: string): AIAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'No summary available',
          sentiment: this.validateSentiment(parsed.sentiment),
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : ['No key points available'],
          recommendation: parsed.recommendation || 'No recommendation available',
          confidence: this.validateConfidence(parsed.confidence),
          riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : ['Risk assessment unavailable'],
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI JSON response:', error);
    }
    
    return this.parsePlainTextResponse(response);
  }

  private validateSentiment(sentiment: any): 'bullish' | 'bearish' | 'neutral' {
    if (typeof sentiment === 'string') {
      const lower = sentiment.toLowerCase();
      if (lower.includes('bull')) return 'bullish';
      if (lower.includes('bear')) return 'bearish';
    }
    return 'neutral';
  }

  private validateConfidence(confidence: any): number {
    const num = parseFloat(confidence);
    if (isNaN(num)) return 0.5;
    return Math.max(0, Math.min(1, num));
  }

  private parsePlainTextResponse(response: string): AIAnalysis {
    return {
      summary: response.substring(0, 200),
      sentiment: 'neutral',
      keyPoints: ['Analysis based on current market conditions'],
      recommendation: response,
      confidence: 0.5,
      riskFactors: ['Please conduct your own research'],
    };
  }

  private getFallbackAnalysis(stock: StockQuote): AIAnalysis {
    const isPositive = stock.change >= 0;
    
    return {
      summary: `${stock.symbol} is currently trading at $${stock.price.toFixed(2)}, ${isPositive ? 'up' : 'down'} ${Math.abs(stock.changePercent).toFixed(2)}% today. Market conditions suggest ${isPositive ? 'positive' : 'negative'} momentum.`,
      sentiment: isPositive ? 'bullish' : 'bearish',
      keyPoints: [
        `Current price: $${stock.price.toFixed(2)}`,
        `${isPositive ? 'Positive' : 'Negative'} daily movement of ${Math.abs(stock.changePercent).toFixed(2)}%`,
        `Trading volume: ${(stock.volume / 1000000).toFixed(2)}M shares`
      ],
      recommendation: 'AI analysis temporarily unavailable. Please conduct thorough research before making investment decisions.',
      confidence: 0.3,
      riskFactors: [
        'AI analysis service unavailable',
        'Limited data for comprehensive analysis',
        'Market conditions may change rapidly'
      ]
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
