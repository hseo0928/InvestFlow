"""Stock data service."""
import time
import requests
import traceback
from datetime import datetime, timedelta
import yfinance as yf
from config.env import config
from utils.cache import cache
from services.supabase_stock_service import supabase_stock_cache

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
    
    # L1 Cache: Memory cache (60 seconds)
    if cache_key in quote_cache:
        cached_data, cached_time = quote_cache[cache_key]
        if current_time - cached_time < 60:
            print(f'💾 Memory cache hit for {symbol}')
            return cached_data
    
    # L2 Cache: Supabase cache (5 minutes)
    db_quote = supabase_stock_cache.get_quote(symbol, ttl=300)
    if db_quote:
        # Update memory cache
        quote_cache[cache_key] = (db_quote, current_time)
        return db_quote
    
    # L3: API calls (yfinance → KIS fallback)
    source = 'yfinance'
    result = None
    
    try:
        # Try yfinance first
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
        print(f'❌ yfinance failed for {symbol}: {str(yf_error)}')
        print('🔄 Falling back to KIS API...')
        
        # Fallback to KIS API
        try:
            from services.kis_service import kis_service
            result = kis_service.get_quote(symbol)
            source = 'kis'
            print(f'✅ KIS API quote fetched for {symbol}')
        except Exception as kis_error:
            print(f'❌ KIS API also failed for {symbol}: {str(kis_error)}')
            traceback.print_exc()
            raise Exception(f'Failed to fetch quote for {symbol}: Both yfinance and KIS failed')
    
    if result:
        # Save to Supabase cache
        supabase_stock_cache.save_quote(symbol, result, source=source)
        
        # Save to memory cache
        quote_cache[cache_key] = (result, current_time)
        
        return result
    else:
        raise Exception(f'Failed to fetch quote for {symbol}')


def get_history(symbol, period='1mo', interval='1d'):
    """Get historical stock data using yfinance with Supabase caching.
    
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
        # Check if we already have some historical data in Supabase
        last_date = supabase_stock_cache.get_last_history_date(symbol)
        
        ticker = yf.Ticker(symbol, session=cf_session)
        
        if last_date:
            # Incremental loading: fetch only missing data
            today = datetime.now().date()
            start_date = last_date + timedelta(days=1)
            
            if start_date >= today:
                # No new data to fetch, return existing data
                print(f'📊 Using cached history for {symbol} (up to date)')
                end_date = today
                db_data = supabase_stock_cache.get_history(symbol, last_date - timedelta(days=30), end_date)
                return db_data if db_data else []
            
            # Fetch only missing dates
            print(f'🔄 Fetching incremental history for {symbol} from {start_date}')
            hist = ticker.history(start=start_date, end=today)
        else:
            # First time: fetch full period
            print(f'🔄 Fetching full history for {symbol} (period: {period})')
            hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            # Try to return cached data if available
            if last_date:
                print(f'⚠️ No new data from yfinance, returning cached history')
                end_date = datetime.now().date()
                db_data = supabase_stock_cache.get_history(symbol, last_date - timedelta(days=30), end_date)
                return db_data if db_data else []
            raise Exception('No data found')
        
        # Convert to records for Supabase
        records = []
        for index, row in hist.iterrows():
            records.append({
                'date': index.strftime('%Y-%m-%d'),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume']),
                'adj_close': float(row.get('Adj Close', row['Close']))
            })
        
        # Save new data to Supabase
        if records:
            saved_count = supabase_stock_cache.save_history_batch(symbol, records)
            print(f'✅ Saved {saved_count} history records for {symbol}')
        
        # Return full dataset from Supabase
        if last_date:
            # Return last 30 days + new data
            start_for_return = last_date - timedelta(days=30)
        else:
            # Return full period
            start_for_return = datetime.strptime(records[0]['date'], '%Y-%m-%d').date()
        
        end_for_return = datetime.now().date()
        all_data = supabase_stock_cache.get_history(symbol, start_for_return, end_for_return)
        
        if all_data:
            return all_data
        else:
            # Fallback to records just fetched
            return records
            
    except Exception as e:
        print(f'❌ Error fetching history for {symbol}: {str(e)}')
        traceback.print_exc()
        raise Exception(f'Failed to fetch history for {symbol}: {str(e)}')
