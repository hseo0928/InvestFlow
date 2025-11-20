import sys
import os
import time
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Mock psycopg2 to avoid import errors
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()

# Mock DatabaseService
mock_db = MagicMock()
sys.modules['services.database'] = mock_db
DatabaseService = MagicMock()
mock_db.DatabaseService = DatabaseService

# Configure Mock DatabaseService methods
DatabaseService.get_quote.return_value = None
DatabaseService.get_fundamentals.return_value = None
DatabaseService.get_news.return_value = []
DatabaseService.save_quote = MagicMock()
DatabaseService.save_history = MagicMock()
DatabaseService.save_fundamentals = MagicMock()
DatabaseService.save_news = MagicMock()
DatabaseService.save_ai_analysis = MagicMock()

from services.stock_service import get_quote, get_history
from services.fundamentals_service import calculate_ratios, calculate_dcf
from services.news_service import news_service
from services.ai_service import ai_service

def test_stock_service():
    print("\n=== Testing StockService ===")
    symbol = "AAPL"
    try:
        print(f"Fetching quote for {symbol}...")
        quote = get_quote(symbol)
        print(f"Quote: {quote.get('currentPrice')} (Source: {quote.get('source', 'Unknown')})")
        
        print(f"Fetching history for {symbol}...")
        history = get_history(symbol, period='1mo')
        print(f"History: {len(history)} records")
        return True
    except Exception as e:
        print(f"StockService Test Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_fundamentals_service():
    print("\n=== Testing FundamentalsService ===")
    symbol = "AAPL"
    try:
        print(f"Calculating ratios for {symbol}...")
        ratios = calculate_ratios(symbol)
        print(f"ROE: {ratios.get('profitability', {}).get('roe')}")
        
        print(f"Calculating DCF for {symbol}...")
        dcf = calculate_dcf(symbol)
        print(f"Intrinsic Value: {dcf.get('intrinsic_value_per_share')}")
        return True
    except Exception as e:
        print(f"FundamentalsService Test Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_news_service():
    print("\n=== Testing NewsService ===")
    try:
        print("Collecting news...")
        # Force collection
        news = news_service.collect_all_news()
        print(f"Collected {len(news)} news items")
        
        if news:
            print(f"Sample: {news[0]['title']}")
            
        print("Testing cache/DB retrieval...")
        cached_news, hit = news_service.get_cached_news()
        print(f"Cached news: {len(cached_news) if cached_news else 0} (Hit: {hit})")
        return True
    except Exception as e:
        print(f"NewsService Test Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_ai_service():
    print("\n=== Testing AIService ===")
    symbol = "AAPL"
    try:
        print(f"Generating analysis for {symbol}...")
        # We need some data to pass
        quote = get_quote(symbol)
        ratios = calculate_ratios(symbol)
        news, _ = news_service.get_cached_news()
        
        analysis = ai_service.generate_stock_analysis(symbol, ratios, news, quote)
        print("Analysis Result:")
        print(f"Summary: {analysis.get('summary')[:100]}...")
        print(f"Recommendation: {analysis.get('recommendation')}")
        return True
    except Exception as e:
        print(f"AIService Test Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Starting Verification...")
    
    results = {
        "stock": test_stock_service(),
        "fundamentals": test_fundamentals_service(),
        "news": test_news_service(),
        "ai": test_ai_service()
    }
    
    print("\n=== Summary ===")
    for test, passed in results.items():
        print(f"{test}: {'✅ PASS' if passed else '❌ FAIL'}")
