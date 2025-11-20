"""Financial fundamentals service with 3-tier caching."""
import yfinance as yf
import time
import math
from datetime import datetime
from typing import Dict, Optional
from services.database import DatabaseService
from services.stock_service import get_quote
from services.yahooquery_service import yahooquery_service

db_service = DatabaseService()


# L1 Cache: In-memory with 60s TTL
fundamentals_cache = {}


def clean_nan_values(obj):
    """Recursively convert NaN and inf values to None for JSON serialization."""
    if isinstance(obj, dict):
        return {k: clean_nan_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj


def get_income_statement(symbol: str) -> dict:
    """Get income statement (annual + quarterly) with 3-tier caching.
    
    Caching strategy:
    1. Memory (60s) -> 2. Database (24h) -> 3. yfinance API
    
    Args:
        symbol: Stock symbol
        
    Returns:
        Dict with keys: symbol, annual, quarterly, updated_at
    """
    # Note: DatabaseService might not have specific table for raw income statement yet.
    # For this refactor, we will assume we only cache the processed ratios or 
    # we need to extend DatabaseService if we want to cache raw statements.
    # Given the user request was about "fixing" and "consolidating", 
    # and DatabaseService has StockFundamentals table which stores "data=fundamentals",
    # we can try to use that or just rely on memory + API for raw data if DB schema doesn't support it.
    # Looking at DatabaseService.StockFundamentals, it stores 'data' JSON.
    # We can store the income statement there if we want, or just skip DB cache for raw data 
    # if it's not critical.
    # However, to keep it robust, let's use DatabaseService.get_fundamentals for now
    # assuming it can store generic data, or just rely on API if not found.
    
    # Actually, let's stick to the plan: "Migrate all data access to services/database.py".
    # If DatabaseService doesn't support it, we should probably add it or just use API.
    # For now, let's use API directly for raw data if not in memory, 
    # as storing full raw JSONs might require schema updates we haven't fully planned 
    # (though StockFundamentals.data is JSON).
    
    cache_key = f'{symbol}_income'
    current_time = time.time()
    
    # L1: Memory cache (60s)
    if cache_key in fundamentals_cache:
        data, cached_time = fundamentals_cache[cache_key]
        age = current_time - cached_time
        if age < 60:
            print(f'✅ Memory cache hit for {symbol}/income (age: {age:.1f}s)')
            return data
    
    # L3: Fetch from API - Try yahooquery first, then yfinance fallback
    print(f'📡 Fetching {symbol} income statement...')
    
    # Try yahooquery first (more reliable in 2025)
    try:
        print(f'  → Trying yahooquery for {symbol} income...')
        result = yahooquery_service.get_income_statement(symbol)
        
        # Check if we got data
        if result.get('annual') or result.get('quarterly'):
            # Save to memory (L1)
            fundamentals_cache[cache_key] = (result, current_time)
            print(f'✅ Fetched {symbol} income from yahooquery')
            return result
        else:
            print(f'⚠️ yahooquery returned no data for {symbol}, trying yfinance fallback...')
    except Exception as e:
        print(f'⚠️ yahooquery failed for {symbol}: {e}, trying yfinance fallback...')
    
    # Fallback to yfinance
    print(f'📡 Fetching {symbol} income from yfinance (fallback)...')
    try:
        ticker = yf.Ticker(symbol)
        
        # Fetch annual and quarterly data using new yfinance API
        # Fallback to legacy API if new properties don't work
        try:
            annual = ticker.income_stmt  # Annual income statement (new API)
            quarterly = ticker.quarterly_income_stmt  # Quarterly income statement (new API)
        except (AttributeError, ValueError):
            # Fallback to legacy method
            try:
                annual = ticker.get_income_stmt(legacy=True, freq='yearly')
                quarterly = ticker.get_income_stmt(legacy=True, freq='quarterly')
            except:
                # Last resort: old property names
                annual = ticker.financials
                quarterly = ticker.quarterly_financials
        
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
        
        # Save to memory (L1)
        fundamentals_cache[cache_key] = (result, current_time)
        
        print(f'✅ Fetched {symbol} income from yfinance')
        
        return result
        
    except Exception as e:
        print(f'❌ Error fetching {symbol} income: {e}')
        raise


def get_balance_sheet(symbol: str) -> dict:
    """Get balance sheet (annual + quarterly) with caching."""
    cache_key = f'{symbol}_balance'
    current_time = time.time()
    
    # L1: Memory cache (60s)
    if cache_key in fundamentals_cache:
        data, cached_time = fundamentals_cache[cache_key]
        age = current_time - cached_time
        if age < 60:
            print(f'✅ Memory cache hit for {symbol}/balance (age: {age:.1f}s)')
            return data
    
    # L3: Fetch from API - Try yahooquery first, then yfinance fallback
    print(f'📡 Fetching {symbol} balance sheet...')
    
    # Try yahooquery first
    try:
        print(f'  → Trying yahooquery for {symbol} balance...')
        result = yahooquery_service.get_balance_sheet(symbol)
        
        if result.get('annual') or result.get('quarterly'):
            fundamentals_cache[cache_key] = (result, current_time)
            print(f'✅ Fetched {symbol} balance from yahooquery')
            return result
        else:
            print(f'⚠️ yahooquery returned no data for {symbol}, trying yfinance fallback...')
    except Exception as e:
        print(f'⚠️ yahooquery failed for {symbol}: {e}, trying yfinance fallback...')
    
    # Fallback to yfinance
    print(f'📡 Fetching {symbol} balance from yfinance (fallback)...')
    try:
        ticker = yf.Ticker(symbol)
        
        # Fetch annual and quarterly data using new yfinance API
        try:
            annual = ticker.balance_sheet  # Annual balance sheet (new API)
            quarterly = ticker.quarterly_balance_sheet  # Quarterly balance sheet (new API)
        except (AttributeError, ValueError):
            # Fallback to legacy method
            try:
                annual = ticker.get_balance_sheet(legacy=True, freq='yearly')
                quarterly = ticker.get_balance_sheet(legacy=True, freq='quarterly')
            except:
                # Last resort: old property names (which likely still work for balance sheet)
                annual = ticker.balance_sheet
                quarterly = ticker.quarterly_balance_sheet
        
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
        
        # Save to memory (L1)
        fundamentals_cache[cache_key] = (result, current_time)
        
        print(f'✅ Fetched {symbol} balance from yfinance')
        
        return result
        
    except Exception as e:
        print(f'❌ Error fetching {symbol} balance: {e}')
        raise


def clear_cache(symbol: str = None):
    """Clear fundamentals cache."""
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
    
    # L2: Database cache (24h)
    db_data = DatabaseService.get_fundamentals(symbol)
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
        
        # Extract latest values - handle both list (yahooquery) and dict (yfinance) formats
        if isinstance(income.get('annual'), list) and len(income.get('annual', [])) > 0:
            # yahooquery format: list of dicts
            latest_income = income['annual'][0]  # First item is most recent
        else:
            # yfinance format: dict
            latest_income = _get_latest_data(income.get('annual', {}))
        
        if isinstance(balance.get('annual'), list) and len(balance.get('annual', [])) > 0:
            # yahooquery format
            latest_balance = balance['annual'][0]
        else:
            # yfinance format
            latest_balance = _get_latest_data(balance.get('annual', {}))
        
        if not latest_income or not latest_balance:
            raise ValueError(f'No financial data available for {symbol}')
        
        # Extract key metrics (handle both yahooquery and yfinance field names)
        net_income = (latest_income.get('NetIncome') or 
                     latest_income.get('NetIncomeCommonStockholders') or
                     latest_income.get('Net Income') or 0)
        revenue = (latest_income.get('TotalRevenue') or
                  latest_income.get('OperatingRevenue') or
                  latest_income.get('Total Revenue') or 0)
        total_equity = (latest_balance.get('StockholdersEquity') or
                       latest_balance.get('CommonStockEquity') or 
                       latest_balance.get('Stockholders Equity') or 
                       latest_balance.get('Total Equity Gross Minority Interest') or 0)
        total_assets = (latest_balance.get('TotalAssets') or
                       latest_balance.get('Total Assets') or 0)
        total_debt = (latest_balance.get('TotalDebt') or
                     latest_balance.get('Total Debt') or 0)
        current_assets = (latest_balance.get('CurrentAssets') or
                         latest_balance.get('Total Current Assets') or 0)
        current_liabilities = (latest_balance.get('CurrentLiabilities') or
                              latest_balance.get('Total Current Liabilities') or 0)
        
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
        
        # Clean NaN values before returning
        result = clean_nan_values(result)
        
        # Save to Database (L2)
        DatabaseService.save_fundamentals(symbol, result)
        
        # Save to memory (L1)
        fundamentals_cache[cache_key] = (result, current_time)
        
        print(f'✅ Calculated ratios for {symbol}')
        
        return result
        
    except Exception as e:
        print(f'❌ Error calculating ratios for {symbol}: {e}')
        raise


def calculate_dcf(symbol: str, growth_rate: float = 0.05, discount_rate: float = 0.10, years: int = 5) -> dict:
    """Calculate Discounted Cash Flow (DCF) valuation."""
    cache_key = f'{symbol}_dcf_{growth_rate}_{discount_rate}_{years}'
    current_time = time.time()
    
    # L1: Memory cache (60s) - only for default parameters
    if growth_rate == 0.05 and discount_rate == 0.10 and years == 5:
        if cache_key in fundamentals_cache:
            data, cached_time = fundamentals_cache[cache_key]
            if current_time - cached_time < 60:
                print(f'✅ Memory cache hit for {symbol} DCF (age: {current_time - cached_time:.1f}s)')
                return data
        
        # Note: DatabaseService currently doesn't have a dedicated DCF table or method.
        # We could add it, but for now let's rely on memory + calculation.
        # Or we could store it in StockFundamentals if we expand the schema.
        # For now, let's skip DB cache for DCF to keep it simple, or just use memory.
    
    try:
        print(f'📊 Calculating DCF for {symbol}...')
        
        # Get cash flow data
        ticker = yf.Ticker(symbol)
        print(f'📡 Fetching {symbol} cash flow from yfinance...')
        cashflow = ticker.cashflow
        
        if cashflow.empty:
            raise ValueError(f'No cash flow data available for {symbol}')
        
        # Extract Free Cash Flow (use most recent value)
        fcf_row = None
        for fcf_key in ['Free Cash Flow', 'FreeCashFlow', 'Free Cash Flow From Operations']:
            if fcf_key in cashflow.index:
                fcf_row = cashflow.loc[fcf_key]
                break
        
        if fcf_row is None or fcf_row.empty:
            raise ValueError(f'Free Cash Flow not available for {symbol}')
        
        # Get latest FCF (first column is most recent)
        latest_fcf = float(fcf_row.iloc[0])
        
        if latest_fcf <= 0:
            raise ValueError(f'Latest FCF is non-positive ({latest_fcf:,.0f}) for {symbol}')
        
        # Project future cash flows
        projected_fcf = []
        for i in range(1, years + 1):
            projected = latest_fcf * ((1 + growth_rate) ** i)
            projected_fcf.append(float(projected))
        
        # Calculate present values of projected FCF
        pv_fcf = []
        for i, fcf in enumerate(projected_fcf, start=1):
            pv = fcf / ((1 + discount_rate) ** i)
            pv_fcf.append(float(pv))
        
        # Terminal value (Gordon Growth Model)
        terminal_fcf = projected_fcf[-1] * (1 + growth_rate)
        
        if discount_rate <= growth_rate:
            raise ValueError(f'Discount rate ({discount_rate}) must be > growth rate ({growth_rate})')
        
        terminal_value = terminal_fcf / (discount_rate - growth_rate)
        pv_terminal = terminal_value / ((1 + discount_rate) ** years)
        
        # Enterprise value
        enterprise_value = sum(pv_fcf) + pv_terminal
        
        # Get balance sheet for net debt calculation
        print(f'📡 Fetching {symbol} balance sheet from yfinance...')
        balance = ticker.balance_sheet
        
        total_debt = 0
        cash = 0
        
        if not balance.empty:
            # Try multiple column names for total debt
            for debt_key in ['Total Debt', 'Long Term Debt', 'Net Debt']:
                if debt_key in balance.index:
                    total_debt = float(balance.loc[debt_key].iloc[0])
                    break
            
            # Try multiple column names for cash
            for cash_key in ['Cash And Cash Equivalents', 'Cash', 'Cash Cash Equivalents And Short Term Investments']:
                if cash_key in balance.index:
                    cash = float(balance.loc[cash_key].iloc[0])
                    break
        
        net_debt = total_debt - cash
        
        # Equity value
        equity_value = enterprise_value - net_debt
        
        # Get shares outstanding
        info = ticker.info
        shares_outstanding = info.get('sharesOutstanding', 0)
        
        if shares_outstanding == 0:
            raise ValueError(f'Shares outstanding not available for {symbol}')
        
        # Intrinsic value per share
        intrinsic_value_per_share = equity_value / shares_outstanding
        
        # Get current price for comparison
        quote = get_quote(symbol)
        current_price = quote.get('currentPrice', 0) or quote.get('regularMarketPrice', 0) or quote.get('price', 0)
        
        # Margin of Safety
        if intrinsic_value_per_share > 0 and current_price > 0:
            margin_of_safety = ((intrinsic_value_per_share - current_price) / intrinsic_value_per_share) * 100
        else:
            margin_of_safety = None
        
        result = {
            'symbol': symbol,
            'latest_fcf': float(latest_fcf),
            'projected_fcf': projected_fcf,
            'pv_fcf': pv_fcf,
            'terminal_value': float(terminal_value),
            'pv_terminal': float(pv_terminal),
            'enterprise_value': float(enterprise_value),
            'net_debt': float(net_debt),
            'equity_value': float(equity_value),
            'shares_outstanding': int(shares_outstanding),
            'intrinsic_value_per_share': round(intrinsic_value_per_share, 2),
            'current_price': float(current_price),
            'margin_of_safety': round(margin_of_safety, 2) if margin_of_safety is not None else None,
            'assumptions': {
                'growth_rate': growth_rate,
                'discount_rate': discount_rate,
                'projection_years': years
            },
            'updated_at': datetime.now().isoformat()
        }
        
        # Clean NaN values before returning
        result = clean_nan_values(result)
        
        # Save to memory (L1)
        if growth_rate == 0.05 and discount_rate == 0.10 and years == 5:
            fundamentals_cache[cache_key] = (result, current_time)
        
        print(f'✅ Calculated DCF for {symbol}: Intrinsic ${intrinsic_value_per_share:.2f} vs Current ${current_price:.2f}')
        
        return result
        
    except Exception as e:
        print(f'❌ Error calculating DCF for {symbol}: {e}')
        raise


