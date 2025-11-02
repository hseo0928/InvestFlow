"""Financial fundamentals service with 3-tier caching."""
import yfinance as yf
import time
from datetime import datetime
from services.supabase_fundamentals_cache import supabase_fundamentals_cache
from services.stock_service import get_quote


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


def _safe_divide(numerator, denominator, default=0):
    """Safely divide two numbers, returning default if denominator is 0 or None."""
    try:
        if denominator and denominator != 0:
            return numerator / denominator
        return default
    except (TypeError, ZeroDivisionError):
        return default


def _get_latest_data(data_dict):
    """Get the most recent data from annual dict (first key chronologically)."""
    if not data_dict or not isinstance(data_dict, dict):
        return {}
    
    # Get the most recent date (dates are in descending order)
    dates = sorted(data_dict.keys(), reverse=True)
    return data_dict[dates[0]] if dates else {}


def calculate_net_margin(income_data: dict) -> float:
    """Calculate net profit margin (%)."""
    revenue = income_data.get('Total Revenue', 0) or income_data.get('Operating Revenue', 0)
    net_income = income_data.get('Net Income', 0)
    
    if not revenue or not net_income:
        return None
    
    return _safe_divide(net_income, revenue, None) * 100 if revenue else None


def calculate_gross_margin(income_data: dict) -> float:
    """Calculate gross profit margin (%)."""
    revenue = income_data.get('Total Revenue', 0) or income_data.get('Operating Revenue', 0)
    gross_profit = income_data.get('Gross Profit', 0)
    
    if not revenue or gross_profit is None:
        return None
    
    return _safe_divide(gross_profit, revenue, None) * 100 if revenue else None


def calculate_operating_margin(income_data: dict) -> float:
    """Calculate operating profit margin (%)."""
    revenue = income_data.get('Total Revenue', 0) or income_data.get('Operating Revenue', 0)
    operating_income = income_data.get('Operating Income', 0) or income_data.get('EBIT', 0)
    
    if not revenue or operating_income is None:
        return None
    
    return _safe_divide(operating_income, revenue, None) * 100 if revenue else None


def calculate_quick_ratio(balance_data: dict) -> float:
    """Calculate quick ratio (acid test)."""
    current_assets = balance_data.get('Current Assets', 0) or balance_data.get('Total Current Assets', 0)
    inventory = balance_data.get('Inventory', 0) or 0
    current_liabilities = balance_data.get('Current Liabilities', 0) or balance_data.get('Total Current Liabilities', 0)
    
    if not current_liabilities:
        return None
    
    return _safe_divide(current_assets - inventory, current_liabilities, None)


def calculate_ratios(symbol: str) -> dict:
    """Calculate financial ratios from income statement and balance sheet.
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Dict with profitability, financial_health, and valuation ratios
    """
    cache_key = f'{symbol}_ratios'
    current_time = time.time()
    
    # L1: Memory cache (60s)
    if cache_key in fundamentals_cache:
        data, cached_time = fundamentals_cache[cache_key]
        age = current_time - cached_time
        if age < 60:
            print(f'✅ Memory cache hit for {symbol}/ratios (age: {age:.1f}s)')
            return data
    
    # L2: Supabase cache (24h)
    db_data = supabase_fundamentals_cache.get(symbol, 'ratios', ttl=86400)
    if db_data:
        fundamentals_cache[cache_key] = (db_data, current_time)
        return db_data
    
    # L3: Calculate ratios
    print(f'📊 Calculating ratios for {symbol}...')
    
    try:
        # Fetch required data
        income = get_income_statement(symbol)
        balance = get_balance_sheet(symbol)
        quote = get_quote(symbol)
        
        # Extract latest values
        latest_income = _get_latest_data(income.get('annual', {}))
        latest_balance = _get_latest_data(balance.get('annual', {}))
        
        if not latest_income or not latest_balance:
            raise ValueError(f'No financial data available for {symbol}')
        
        # Extract key metrics
        net_income = latest_income.get('Net Income', 0)
        revenue = latest_income.get('Total Revenue', 0) or latest_income.get('Operating Revenue', 0)
        total_equity = latest_balance.get('Stockholders Equity', 0) or latest_balance.get('Total Equity Gross Minority Interest', 0) or latest_balance.get('Common Stock Equity', 0)
        total_assets = latest_balance.get('Total Assets', 0)
        total_debt = latest_balance.get('Total Debt', 0) or 0
        current_assets = latest_balance.get('Current Assets', 0) or latest_balance.get('Total Current Assets', 0)
        current_liabilities = latest_balance.get('Current Liabilities', 0) or latest_balance.get('Total Current Liabilities', 0)
        
        # Calculate profitability ratios
        roe = _safe_divide(net_income, total_equity, None) * 100 if total_equity else None
        roa = _safe_divide(net_income, total_assets, None) * 100 if total_assets else None
        
        # Calculate financial health ratios
        debt_to_equity = _safe_divide(total_debt, total_equity, None) if total_equity else None
        current_ratio = _safe_divide(current_assets, current_liabilities, None) if current_liabilities else None
        quick_ratio = calculate_quick_ratio(latest_balance)
        
        # Calculate valuation ratios
        market_cap = quote.get('marketCap', 0)
        price = quote.get('currentPrice', 0) or quote.get('regularMarketPrice', 0)
        book_value = total_equity
        
        pe_ratio = _safe_divide(market_cap, net_income, None) if net_income and net_income > 0 else None
        pb_ratio = _safe_divide(market_cap, book_value, None) if book_value and book_value > 0 else None
        ps_ratio = _safe_divide(market_cap, revenue, None) if revenue and revenue > 0 else None
        
        # Prepare result
        result = {
            'symbol': symbol.upper(),
            'profitability': {
                'roe': round(roe, 2) if roe is not None else None,
                'roa': round(roa, 2) if roa is not None else None,
                'net_margin': round(calculate_net_margin(latest_income), 2) if calculate_net_margin(latest_income) is not None else None,
                'gross_margin': round(calculate_gross_margin(latest_income), 2) if calculate_gross_margin(latest_income) is not None else None,
                'operating_margin': round(calculate_operating_margin(latest_income), 2) if calculate_operating_margin(latest_income) is not None else None
            },
            'financial_health': {
                'debt_to_equity': round(debt_to_equity, 2) if debt_to_equity is not None else None,
                'current_ratio': round(current_ratio, 2) if current_ratio is not None else None,
                'quick_ratio': round(quick_ratio, 2) if quick_ratio is not None else None
            },
            'valuation': {
                'pe_ratio': round(pe_ratio, 2) if pe_ratio is not None else None,
                'pb_ratio': round(pb_ratio, 2) if pb_ratio is not None else None,
                'ps_ratio': round(ps_ratio, 2) if ps_ratio is not None else None,
                'market_cap': market_cap,
                'price': price
            },
            'updated_at': datetime.now().isoformat()
        }
        
        # Save to Supabase (L2)
        supabase_fundamentals_cache.save(symbol, 'ratios', result)
        
        # Save to memory (L1)
        fundamentals_cache[cache_key] = (result, current_time)
        
        print(f'✅ Calculated ratios for {symbol}')
        
        return result
        
    except Exception as e:
        print(f'❌ Error calculating ratios for {symbol}: {e}')
        raise

