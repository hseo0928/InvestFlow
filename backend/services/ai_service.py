"""AI Service using Google Gemini for stock analysis."""
import os
import json
import google.generativeai as genai
from config.env import config
from services.database import DatabaseService

class AIService:
    """Service for AI-powered stock analysis."""
    
    def __init__(self):
        self.api_key = config.GEMINI_API_KEY
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            print("⚠️ Gemini API Key not found. AI features will be disabled.")
            self.model = None

    def generate_stock_analysis(self, symbol, fundamentals, news, price_data):
        """Generate comprehensive stock analysis using Gemini."""
        if not self.model:
            return {"error": "AI service not configured"}

        try:
            # Prepare context for AI
            context = {
                "symbol": symbol,
                "price": price_data.get('price'),
                "pe_ratio": fundamentals.get('valuation', {}).get('pe_ratio'),
                "market_cap": fundamentals.get('valuation', {}).get('market_cap'),
                "roe": fundamentals.get('profitability', {}).get('roe'),
                "recent_news": [n['title'] for n in news[:5]] if news else []
            }

            prompt = f"""
            Analyze the stock {symbol} based on the following data:
            {json.dumps(context, indent=2)}

            Please provide a structured analysis in JSON format with the following fields:
            - summary: A brief executive summary (Korean).
            - strength: Key strengths (list of strings, Korean).
            - weakness: Key weaknesses (list of strings, Korean).
            - outlook: Short-term and long-term outlook (Korean).
            - recommendation: 'BUY', 'HOLD', or 'SELL' based on data.
            
            Respond ONLY with valid JSON.
            """

            response = self.model.generate_content(prompt)
            text = response.text
            
            # Clean up markdown code blocks if present
            if text.startswith('```json'):
                text = text[7:]
            if text.endswith('```'):
                text = text[:-3]
                
            analysis_result = json.loads(text.strip())
            
            # Save to Database
            DatabaseService.save_ai_analysis(symbol, analysis_result)
            
            return analysis_result

        except Exception as e:
            print(f"❌ AI Analysis failed for {symbol}: {e}")
            return {"error": str(e)}

ai_service = AIService()
