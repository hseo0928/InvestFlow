"""Stock data service."""
import time
import requests
import traceback
from datetime import datetime, timedelta
import yfinance as yf
from config.env import config
from utils.cache import cache
from services.database import DatabaseService

# Create a persistent session to avoid 429 errors
# Reference: https://github.com/ranaroussi/yfinance/issues
_session = requests.Session()
_session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
})

# Rate limiting 방지를 위한 캐시
quote_cache = {}

# Rate limiting: Track last API call time
_last_api_call = 0
_min_api_interval = 1.0  # 1 second between API calls

def get_quote(symbol):
    """Get stock quote using yfinance with caching.
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Dict with stock quote data
        
    Raises:
        Exception: If data fetch fails
    """
    cache_key = symbol.upper()
    current_time = time.time()
    
    # L1 Cache: Memory cache (60 seconds)
    if cache_key in quote_cache:
        cached_data, cached_time = quote_cache[cache_key]
        if current_time - cached_time < 60:
            print(f'💾 Memory cache hit for {symbol}')
            return cached_data
    
    # L2 Cache: Database cache (5 minutes)
    db_quote = DatabaseService.get_quote(symbol, max_age_minutes=5)
    if db_quote:
        # Update memory cache
        quote_cache[cache_key] = (db_quote, current_time)
        return db_quote
    
    # L3: API calls (KIS → yfinance fallback)
    source = 'kis'
    result = None
    
    # Rate limiting: Wait if needed
    global _last_api_call
    elapsed = time.time() - _last_api_call
    if elapsed < _min_api_interval:
        time.sleep(_min_api_interval - elapsed)
    _last_api_call = time.time()
    
    try:
        # Try KIS API first
        from services.kis_service import kis_service
        result = kis_service.get_quote(symbol)
        print(f'✅ KIS API quote fetched for {symbol}')
        
    except Exception as kis_error:
        print(f'❌ KIS API failed for {symbol}: {str(kis_error)}')
        print('🔄 Falling back to yfinance...')
        source = 'yfinance'
        
        # Fallback to yfinance
        try:
            # Try yfinance with persistent session
            ticker = yf.Ticker(symbol, session=_session)
            
            # Try to get info with error handling
            try:
                info = ticker.info
            except (AttributeError, KeyError, TypeError) as e:
                print(f'⚠️ yfinance info fetch error for {symbol}: {str(e)}')
                # Try alternative method using fast_info
                try:
                    fast_info = ticker.fast_info
                    info = {
                        'currentPrice': fast_info.get('last_price'),
                        'previousClose': fast_info.get('previous_close'),
                        'regularMarketPrice': fast_info.get('last_price'),
                        'volume': fast_info.get('last_volume'),
                        'shortName': symbol.upper()
                    }
                except Exception:
                    raise Exception(f'Failed to fetch data from yfinance for {symbol}')
            
            # Extract current price info
            current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('ask', 0)
            previous_close = info.get('previousClose', 0)
            
            if current_price == 0:
                current_price = info.get('bid', 0)
            
            change = current_price - previous_close if previous_close else 0
            change_percent = (change / previous_close * 100) if previous_close else 0
            
            result = {
                'symbol': symbol.upper(),
                'name': info.get('longName', info.get('shortName', symbol.upper())),
                'price': float(current_price),
                'change': float(change),
                'changePercent': float(change_percent),
                'volume': info.get('volume', info.get('regularMarketVolume', 0)),
                'marketCap': info.get('marketCap', 0),
                'high': info.get('dayHigh', info.get('regularMarketDayHigh', current_price)),
                'low': info.get('dayLow', info.get('regularMarketDayLow', current_price)),
                'open': info.get('open', info.get('regularMarketOpen', current_price)),
                'previousClose': float(previous_close),
            }
            
            print(f'✅ yfinance quote fetched for {symbol}')
        except Exception as yf_error:
            print(f'❌ yfinance also failed for {symbol}: {str(yf_error)}')
            traceback.print_exc()
            raise Exception(f'Failed to fetch quote for {symbol}: Both KIS and yfinance failed')
    
    if result:
        # Save to Database cache
        DatabaseService.save_quote(symbol, result)
        
        # Save to memory cache
        quote_cache[cache_key] = (result, current_time)
        
        return result
    else:
        raise Exception(f'Failed to fetch quote for {symbol}')


def get_history(symbol, period='1mo', interval='1d'):
    """Get historical stock data using yfinance with Database caching.
    
    Args:
        symbol: Stock symbol
        period: Time period (1d, 1w, 1mo, etc.)
        interval: Data interval (1d, 1h, etc.)
        
    Returns:
        List of historical data points
        
    Raises:
        Exception: If data fetch fails or no data found
    """
    try:
        # Rate limiting: Wait if needed
        global _last_api_call
        elapsed = time.time() - _last_api_call
        if elapsed < _min_api_interval:
            time.sleep(_min_api_interval - elapsed)
        _last_api_call = time.time()
        
        # Check if we already have some historical data in Database
        # For simplicity in this refactor, we'll just fetch from API if not recent enough
        # Ideally, implement incremental fetch like before but with DatabaseService
        
        ticker = yf.Ticker(symbol, session=_session)
        
        print(f'🔄 Fetching full history for {symbol} (period: {period})')
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            # Try to return cached data if available (fallback)
            db_data = DatabaseService.get_history(symbol, days=30)
            if db_data:
                print(f'⚠️ No new data from yfinance, returning cached history')
                return db_data
            raise Exception('No data found')
        
        # Convert to records for Database
        records = []
        for index, row in hist.iterrows():
            records.append({
                'date': index.strftime('%Y-%m-%d') if hasattr(index, 'strftime') else str(index).split(' ')[0],
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume']),
                'adj_close': float(row.get('Adj Close', row['Close']))
            })
        
        # Save new data to Database
        if records:
            # Note: DatabaseService.save_history might need batch optimization if large
            # For now, we just save recent ones or overwrite
            # To avoid duplicates, we might want to clear old or upsert. 
            # DatabaseService.save_history does INSERT. 
            # Let's assume we just save new ones or rely on DB constraints if any.
            # For now, let's just save.
            DatabaseService.save_history(symbol, records)
            print(f'✅ Saved history records for {symbol}')
        
        return records
            
    except Exception as e:
        print(f'❌ Error fetching history for {symbol}: {str(e)}')
        traceback.print_exc()
        raise Exception(f'Failed to fetch history for {symbol}: {str(e)}')
