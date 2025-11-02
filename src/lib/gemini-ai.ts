import { GoogleGenAI } from '@google/genai';
import { API_CONFIG, APIError, AIAnalysis, StockQuote, NewsItem } from './api-config';
import { formatVolume } from '../components/ui/utils';

// Gemini AI API client for stock analysis
export class GeminiAPI {
  private static client: GoogleGenAI | null = null;
  
  private static getClient(): GoogleGenAI {
    if (!this.client) {
      if (!API_CONFIG.GEMINI_API_KEY) {
        throw new APIError('Gemini API key not configured');
      }
      this.client = new GoogleGenAI({ apiKey: API_CONFIG.GEMINI_API_KEY });
    }
    return this.client;
  }
  
  // Generate AI analysis for a stock
  static async analyzeStock(
    stock: StockQuote,
    news: NewsItem[],
    chartData?: { recentTrend: 'up' | 'down' | 'sideways'; volatility: 'high' | 'medium' | 'low' },
    fundamentals?: {
      ratios?: any;
      dcf?: any;
    }
  ): Promise<AIAnalysis> {
    // Try Gemini first
    try {
      const client = this.getClient();
      const prompt = this.buildAnalysisPrompt(stock, news, chartData, fundamentals);
      
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      const generatedText = response.text;
      if (!generatedText) {
        throw new APIError('Empty response from Gemini API');
      }
      
      return this.parseAnalysisResponse(generatedText);
    } catch (geminiError) {
      console.warn('Gemini API failed, trying OpenRouter:', geminiError);
      
      // Fallback to OpenRouter
      try {
        const prompt = this.buildAnalysisPrompt(stock, news, chartData, fundamentals);
        const openRouterResponse = await this.analyzeWithOpenRouter(prompt);
        return this.parseAnalysisResponse(openRouterResponse);
      } catch (openRouterError) {
        console.warn('OpenRouter API also failed:', openRouterError);
        
        // Return fallback analysis
        return this.getFallbackAnalysis(stock);
      }
    }
  }
  
  // Build the analysis prompt
  private static buildAnalysisPrompt(
    stock: StockQuote,
    news: NewsItem[],
    chartData?: { recentTrend: 'up' | 'down' | 'sideways'; volatility: 'high' | 'medium' | 'low' },
    fundamentals?: {
      ratios?: any;
      dcf?: any;
    }
  ): string {
    const newsContext = news.length > 0 
      ? news.map(n => `- ${n.title}: ${n.summary}`).join('\n')
      : 'No recent news available';
    
    const chartContext = chartData 
      ? `Recent price trend: ${chartData.recentTrend}, Volatility: ${chartData.volatility}`
      : 'No chart analysis available';
    
    // Add fundamentals context
    let fundamentalsContext = '';
    if (fundamentals?.ratios) {
      const r = fundamentals.ratios;
      fundamentalsContext += '\n\nFundamental Ratios:';
      if (r.profitability) {
        fundamentalsContext += `\n- Profitability: ROE ${r.profitability.roe?.toFixed(2)}%, ROA ${r.profitability.roa?.toFixed(2)}%, Net Margin ${r.profitability.net_margin?.toFixed(2)}%`;
      }
      if (r.financial_health) {
        fundamentalsContext += `\n- Financial Health: Debt-to-Equity ${r.financial_health.debt_to_equity?.toFixed(2)}, Current Ratio ${r.financial_health.current_ratio?.toFixed(2)}`;
      }
      if (r.valuation) {
        fundamentalsContext += `\n- Valuation: P/E ${r.valuation.pe_ratio?.toFixed(2)}, P/B ${r.valuation.pb_ratio?.toFixed(2)}`;
      }
    }
    
    if (fundamentals?.dcf) {
      const dcf = fundamentals.dcf;
      fundamentalsContext += '\n\nDCF Valuation:';
      fundamentalsContext += `\n- Intrinsic Value: $${dcf.intrinsic_value_per_share?.toFixed(2)}`;
      fundamentalsContext += `\n- Current Price: $${dcf.current_price?.toFixed(2)}`;
      fundamentalsContext += `\n- Margin of Safety: ${dcf.margin_of_safety?.toFixed(2)}%`;
    }
    
    return `
As a financial analyst AI, provide a comprehensive analysis of ${stock.symbol} (${stock.name}).

Current Stock Data:
- Price: $${stock.price.toFixed(2)}
- Change: ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} (${stock.changePercent.toFixed(2)}%)
- Volume: ${stock.volume.toLocaleString()}
- Day Range: $${stock.low.toFixed(2)} - $${stock.high.toFixed(2)}
- Previous Close: $${stock.previousClose.toFixed(2)}
${fundamentalsContext}

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
Base your analysis on the provided data, news sentiment, fundamental ratios, DCF valuation, and general market knowledge.
Be objective and mention both positive and negative factors.
${fundamentals?.dcf?.margin_of_safety ? `Consider the ${fundamentals.dcf.margin_of_safety > 0 ? 'positive' : 'negative'} margin of safety (${fundamentals.dcf.margin_of_safety.toFixed(2)}%) in your valuation assessment.` : ''}
`;
  }
  
  // Parse the AI response into structured analysis
  private static parseAnalysisResponse(response: string): AIAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate required fields
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
      console.warn('Failed to parse Gemini JSON response:', error);
    }
    
    // Fallback: parse response as plain text
    return this.parseTextResponse(response);
  }
  
  // Validate sentiment value
  private static validateSentiment(sentiment: any): 'bullish' | 'bearish' | 'neutral' {
    if (typeof sentiment === 'string') {
      const lower = sentiment.toLowerCase();
      if (lower.includes('bull')) return 'bullish';
      if (lower.includes('bear')) return 'bearish';
      if (lower.includes('neutral')) return 'neutral';
    }
    return 'neutral';
  }
  
  // Validate confidence score
  private static validateConfidence(confidence: any): number {
    const num = parseFloat(confidence);
    if (isNaN(num)) return 0.5;
    return Math.max(0, Math.min(1, num));
  }
  
  // Parse response as plain text (fallback)
  private static parseTextResponse(response: string): AIAnalysis {
    const lines = response.split('\n').filter(line => line.trim());
    
    return {
      summary: lines.slice(0, 2).join(' ') || 'AI analysis completed',
      sentiment: 'neutral',
      keyPoints: lines.slice(2, 5).map(line => line.replace(/^[-*]\s*/, '')) || ['Analysis available in summary'],
      recommendation: lines.slice(-2).join(' ') || 'Please review the analysis carefully',
      confidence: 0.7,
      riskFactors: ['Market volatility', 'Economic conditions', 'Company-specific risks'],
    };
  }
  
  // Generate market summary
  static async generateMarketSummary(topStocks: StockQuote[]): Promise<string> {
    try {
      const client = this.getClient();
      const stocksData = topStocks.map(stock => 
        `${stock.symbol}: $${stock.price.toFixed(2)} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)`
      ).join(', ');
      
      const prompt = `
As a financial market analyst, provide a brief market summary based on these key stocks:
${stocksData}

Provide a 2-3 sentence overview of the current market sentiment and trends. Keep it concise and informative.
`;
      
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      return response.text || 'Market analysis unavailable at this time.';
    } catch (error) {
      console.warn('Gemini market summary error:', error);
      return 'Market analysis unavailable at this time.';
    }
  }

  // Translate news to Korean
  static async translateNews(newsItems: NewsItem[]): Promise<NewsItem[]> {
    try {
      const client = this.getClient();
      
      // 최대 5개만 번역 (API 제한 고려)
      const itemsToTranslate = newsItems.slice(0, 5);
      const remainingItems = newsItems.slice(5);
      
      const translatedItems: NewsItem[] = [];

      for (const item of itemsToTranslate) {
        try {
          // 이미 한국어인 경우 번역하지 않음
          if (this.isKorean(item.title) && this.isKorean(item.summary)) {
            translatedItems.push(item);
            continue;
          }

          const prompt = `Translate the following financial news to Korean. Keep the translation natural and professional:

Title: ${item.title}
Summary: ${item.summary}

Provide the translation in this exact format:
TITLE: [translated title]
SUMMARY: [translated summary]`;

          const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          
          const generatedText = response.text;
          
          if (generatedText) {
            const titleMatch = generatedText.match(/TITLE:\s*(.+)/i);
            const summaryMatch = generatedText.match(/SUMMARY:\s*(.+)/is);

            translatedItems.push({
              ...item,
              title: titleMatch ? titleMatch[1].trim() : item.title,
              summary: summaryMatch ? summaryMatch[1].trim() : item.summary,
            });
          } else {
            translatedItems.push(item);
          }
          
          // API 제한을 피하기 위해 요청 사이에 딜레이 추가
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.warn('Translation failed for item:', item.title, error);
          translatedItems.push(item); // 실패해도 원본 추가
        }
      }

      // 번역된 항목 + 번역하지 않은 나머지 항목 반환
      return [...translatedItems, ...remainingItems];
    } catch (error) {
      console.warn('Translation batch error:', error);
      return newsItems;
    }
  }

  // Check if text is Korean
  private static isKorean(text: string): boolean {
    const koreanRegex = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
    return koreanRegex.test(text);
  }

  // OpenRouter API fallback
  private static async analyzeWithOpenRouter(prompt: string): Promise<string> {
    if (!API_CONFIG.OPENROUTER_API_KEY) {
      throw new APIError('OpenRouter API key not configured');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${API_CONFIG.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    };
    if (API_CONFIG.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = API_CONFIG.OPENROUTER_SITE_URL as unknown as string;
    if (API_CONFIG.OPENROUTER_SITE_TITLE) headers['X-Title'] = API_CONFIG.OPENROUTER_SITE_TITLE as unknown as string;

    const response = await fetch(API_CONFIG.OPENROUTER_BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'tngtech/deepseek-r1t2-chimera:free',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new APIError(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    try { console.info('[AI] OpenRouter (DeepSeek) fallback used'); } catch {}
    return data.choices?.[0]?.message?.content || '';
  }

  // Fallback analysis when all AI services fail
  private static getFallbackAnalysis(stock: StockQuote): AIAnalysis {
    return {
      summary: `${stock.symbol}은 현재 $${stock.price.toFixed(2)}에 거래되고 있으며, ${stock.changePercent >= 0 ? '상승' : '하락'} 추세입니다 (${stock.changePercent.toFixed(2)}%).`,
      sentiment: stock.changePercent > 2 ? 'bullish' : stock.changePercent < -2 ? 'bearish' : 'neutral',
      keyPoints: [
        `현재 가격: $${stock.price.toFixed(2)}`,
        `일일 변화: ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`,
        `거래량: ${formatVolume(stock.volume)}`,
        `일일 범위: $${stock.low.toFixed(2)} - $${stock.high.toFixed(2)}`
      ],
      recommendation: 'AI 분석이 일시적으로 사용할 수 없습니다. 투자 결정 전 여러 요소를 종합적으로 검토하시기 바랍니다.',
      confidence: 0.3,
      riskFactors: ['AI 분석 서비스 중단', '시장 변동성', '경제적 불확실성', '회사별 리스크'],
    };
  }
}
