"""Financial fundamentals service with 3-tier caching."""
import yfinance as yf
import time
from datetime import datetime
from services.supabase_fundamentals_cache import supabase_fundamentals_cache


# L1 Cache: In-memory with 60s TTL
fundamentals_cache = {}


def get_income_statement(symbol: str) -> dict:
    """Get income statement (annual + quarterly) with 3-tier caching.
    
    Caching strategy:
    1. Memory (60s) -> 2. Supabase (24h) -> 3. yfinance API
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Dict with keys: symbol, annual, quarterly, updated_at
    """
    cache_key = f'{symbol}_income'
    current_time = time.time()
    
    # L1: Memory cache (60s)
    if cache_key in fundamentals_cache:
        data, cached_time = fundamentals_cache[cache_key]
        age = current_time - cached_time
        if age < 60:
            print(f'✅ Memory cache hit for {symbol}/income (age: {age:.1f}s)')
            return data
    
    # L2: Supabase cache (24h)
    db_data = supabase_fundamentals_cache.get(symbol, 'income', ttl=86400)
    if db_data:
        fundamentals_cache[cache_key] = (db_data, current_time)
        return db_data
    
    # L3: Fetch from yfinance API
    print(f'📡 Fetching {symbol} income from yfinance...')
    try:
        ticker = yf.Ticker(symbol)
        
        # Fetch annual and quarterly data
        annual = ticker.financials  # Annual income statement
        quarterly = ticker.quarterly_financials  # Quarterly income statement
        
        # Convert DataFrames to JSON - transpose to get dates as rows
        annual_data = []
        if not annual.empty:
            # Transpose: columns become rows (dates), index becomes columns (metrics)
            annual_t = annual.T
            annual_t.index = annual_t.index.astype(str)  # Convert Timestamp to string
            annual_data = annual_t.to_dict('index')  # Dict with dates as keys
        
        quarterly_data = []
        if not quarterly.empty:
            quarterly_t = quarterly.T
            quarterly_t.index = quarterly_t.index.astype(str)
            quarterly_data = quarterly_t.to_dict('index')
        
        # Convert DataFrames to JSON
        result = {
            'symbol': symbol.upper(),
            'annual': annual_data,
            'quarterly': quarterly_data,
            'updated_at': datetime.now().isoformat()
        }
        
        # Save to Supabase (L2)
        supabase_fundamentals_cache.save(symbol, 'income', result)
        
        # Save to memory (L1)
        fundamentals_cache[cache_key] = (result, current_time)
        
        print(f'✅ Fetched {symbol} income from yfinance')
        
        return result
        
    except Exception as e:
        print(f'❌ Error fetching {symbol} income: {e}')
        raise


def get_balance_sheet(symbol: str) -> dict:
    """Get balance sheet (annual + quarterly) with 3-tier caching.
    
    Caching strategy:
    1. Memory (60s) -> 2. Supabase (24h) -> 3. yfinance API
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Dict with keys: symbol, annual, quarterly, updated_at
    """
    cache_key = f'{symbol}_balance'
    current_time = time.time()
    
    # L1: Memory cache (60s)
    if cache_key in fundamentals_cache:
        data, cached_time = fundamentals_cache[cache_key]
        age = current_time - cached_time
        if age < 60:
            print(f'✅ Memory cache hit for {symbol}/balance (age: {age:.1f}s)')
            return data
    
    # L2: Supabase cache (24h)
    db_data = supabase_fundamentals_cache.get(symbol, 'balance', ttl=86400)
    if db_data:
        fundamentals_cache[cache_key] = (db_data, current_time)
        return db_data
    
    # L3: Fetch from yfinance API
    print(f'📡 Fetching {symbol} balance from yfinance...')
    try:
        ticker = yf.Ticker(symbol)
        
        # Fetch annual and quarterly data
        annual = ticker.balance_sheet  # Annual balance sheet
        quarterly = ticker.quarterly_balance_sheet  # Quarterly balance sheet
        
        # Convert DataFrames to JSON - transpose to get dates as rows
        annual_data = []
        if not annual.empty:
            # Transpose: columns become rows (dates), index becomes columns (metrics)
            annual_t = annual.T
            annual_t.index = annual_t.index.astype(str)  # Convert Timestamp to string
            annual_data = annual_t.to_dict('index')  # Dict with dates as keys
        
        quarterly_data = []
        if not quarterly.empty:
            quarterly_t = quarterly.T
            quarterly_t.index = quarterly_t.index.astype(str)
            quarterly_data = quarterly_t.to_dict('index')
        
        # Convert DataFrames to JSON
        result = {
            'symbol': symbol.upper(),
            'annual': annual_data,
            'quarterly': quarterly_data,
            'updated_at': datetime.now().isoformat()
        }
        
        # Save to Supabase (L2)
        supabase_fundamentals_cache.save(symbol, 'balance', result)
        
        # Save to memory (L1)
        fundamentals_cache[cache_key] = (result, current_time)
        
        print(f'✅ Fetched {symbol} balance from yfinance')
        
        return result
        
    except Exception as e:
        print(f'❌ Error fetching {symbol} balance: {e}')
        raise


def clear_cache(symbol: str = None):
    """Clear fundamentals cache.
    
    Args:
        symbol: Symbol to clear (None = clear all)
    """
    if symbol:
        # Clear specific symbol from memory
        for key in list(fundamentals_cache.keys()):
            if key.startswith(symbol):
                del fundamentals_cache[key]
        print(f'✅ Cleared {symbol} from memory cache')
    else:
        # Clear all
        fundamentals_cache.clear()
        print('✅ Cleared all fundamentals from memory cache')
