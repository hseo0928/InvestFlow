"""Stock data service."""
import time
import requests
import traceback
import yfinance as yf
from config.env import config
from utils.cache import cache

# Disable curl_cffi due to compatibility issues
cf_session = None

# Rate limiting 방지를 위한 캐시
quote_cache = {}


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
    
    # Check cache
    if cache_key in quote_cache:
        cached_data, cached_time = quote_cache[cache_key]
        if current_time - cached_time < 60:  # 60 seconds cache
            return cached_data
    
    try:
        # Fetch from yfinance with curl_cffi session if available
        ticker = yf.Ticker(symbol, session=cf_session) if cf_session else yf.Ticker(symbol)
        
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
                raise Exception(f'Failed to fetch data for {symbol}')
        
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
        
        # Save to cache
        quote_cache[cache_key] = (result, current_time)
        
        return result
    
    except Exception as e:
        print(f'❌ Error fetching quote for {symbol}: {str(e)}')
        traceback.print_exc()
        raise Exception(f'Failed to fetch quote for {symbol}: {str(e)}')


def get_history(symbol, period='1mo', interval='1d'):
    """Get historical stock data using yfinance.
    
    Args:
        symbol: Stock symbol
        period: Time period (1d, 1w, 1mo, etc.)
        interval: Data interval (1d, 1h, etc.)
        
    Returns:
        List of historical data points
        
    Raises:
        Exception: If data fetch fails or no data found
    """
    ticker = yf.Ticker(symbol, session=cf_session)
    hist = ticker.history(period=period, interval=interval)
    
    if hist.empty:
        raise Exception('No data found')
    
    data = []
    for index, row in hist.iterrows():
        data.append({
            'date': index.strftime('%Y-%m-%d %H:%M:%S'),
            'open': float(row['Open']),
            'high': float(row['High']),
            'low': float(row['Low']),
            'close': float(row['Close']),
            'volume': int(row['Volume'])
        })
    
    return data


def search_stocks(query):
    """Simple stock search - returns popular stocks matching query.
    
    Args:
        query: Search query string
        
    Returns:
        List of matching stocks
    """
    query_upper = query.upper()
    
    popular_stocks = [
        {'symbol': 'AAPL', 'name': 'Apple Inc.', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'GOOGL', 'name': 'Alphabet Inc.', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'MSFT', 'name': 'Microsoft Corporation', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'AMZN', 'name': 'Amazon.com Inc.', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'TSLA', 'name': 'Tesla Inc.', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'META', 'name': 'Meta Platforms Inc.', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'NVDA', 'name': 'NVIDIA Corporation', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'NFLX', 'name': 'Netflix Inc.', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'AMD', 'name': 'Advanced Micro Devices', 'exchange': 'NASDAQ', 'type': 'stock'},
        {'symbol': 'CRM', 'name': 'Salesforce Inc.', 'exchange': 'NYSE', 'type': 'stock'},
    ]
    
    results = [s for s in popular_stocks if query_upper in s['symbol'] or query_upper in s['name'].upper()]
    return results
