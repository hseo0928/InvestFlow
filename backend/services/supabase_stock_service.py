"""Supabase stock data caching service."""
import requests
from datetime import datetime, timezone
from config.env import config


class SupabaseStockCache:
    """Service for caching stock data in Supabase."""
    
    def __init__(self):
        """Initialize Supabase stock cache service."""
        self.base_url = (config.SUPABASE_URL or '').rstrip('/')
        self.anon_key = config.SUPABASE_ANON_KEY or ''
        
    def _headers(self):
        """Generate Supabase API headers."""
        return {
            'apikey': self.anon_key,
            'Authorization': f'Bearer {self.anon_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    
    def get_quote(self, symbol, ttl=300):
        """Get cached stock quote from Supabase.
        
        Args:
            symbol: Stock symbol
            ttl: Time to live in seconds (default: 5 minutes)
            
        Returns:
            Quote data dict if fresh, None if stale or not found
        """
        if not self.base_url or not self.anon_key:
            return None
            
        try:
            url = f"{self.base_url}/rest/v1/stock_quotes"
            params = {
                'symbol': f'eq.{symbol.upper()}',
                'select': '*'
            }
            
            resp = requests.get(url, params=params, headers=self._headers(), timeout=10)
            
            if resp.status_code != 200:
                print(f'⚠️ Supabase get_quote error {resp.status_code}: {resp.text}')
                return None
                
            items = resp.json()
            if not items or len(items) == 0:
                return None
                
            quote = items[0]
            
            # Check TTL
            updated_at = datetime.fromisoformat(quote['updated_at'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            age_seconds = (now - updated_at).total_seconds()
            
            if age_seconds > ttl:
                print(f'⏰ Supabase cache expired for {symbol} ({age_seconds:.0f}s > {ttl}s)')
                return None
                
            print(f'✅ Supabase cache hit for {symbol} (age: {age_seconds:.0f}s)')
            
            # Convert to stock_service format
            return {
                'symbol': quote['symbol'],
                'name': quote['name'] or quote['symbol'],
                'price': float(quote['price'] or 0),
                'change': float(quote['change'] or 0),
                'changePercent': float(quote['change_percent'] or 0),
                'volume': int(quote['volume'] or 0),
                'marketCap': int(quote['market_cap'] or 0),
                'high': float(quote['high'] or 0),
                'low': float(quote['low'] or 0),
                'open': float(quote['open'] or 0),
                'previousClose': float(quote['previous_close'] or 0),
            }
            
        except requests.exceptions.RequestException as e:
            print(f'⚠️ Supabase connection error: {e}')
            return None
        except Exception as e:
            print(f'⚠️ Supabase get_quote error: {e}')
            return None
    
    def save_quote(self, symbol, quote_data, source='yfinance'):
        """Save or update stock quote in Supabase.
        
        Args:
            symbol: Stock symbol
            quote_data: Quote data dict
            source: Data source ('yfinance', 'kis', 'manual')
            
        Returns:
            True if successful, False otherwise
        """
        if not self.base_url or not self.anon_key:
            return False
            
        try:
            url = f"{self.base_url}/rest/v1/stock_quotes"
            
            payload = {
                'symbol': symbol.upper(),
                'name': quote_data.get('name', symbol.upper()),
                'price': float(quote_data.get('price', 0)),
                'change': float(quote_data.get('change', 0)),
                'change_percent': float(quote_data.get('changePercent', 0)),
                'volume': int(quote_data.get('volume', 0)),
                'market_cap': int(quote_data.get('marketCap', 0)),
                'high': float(quote_data.get('high', 0)),
                'low': float(quote_data.get('low', 0)),
                'open': float(quote_data.get('open', 0)),
                'previous_close': float(quote_data.get('previousClose', 0)),
                'source': source,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Upsert (insert or update)
            headers = self._headers()
            headers['Prefer'] = 'resolution=merge-duplicates'
            
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            
            if resp.status_code in [200, 201]:
                print(f'✅ Supabase saved quote for {symbol} (source: {source})')
                return True
            else:
                print(f'⚠️ Supabase save_quote error {resp.status_code}: {resp.text}')
                return False
                
        except Exception as e:
            print(f'⚠️ Supabase save_quote error: {e}')
            return False
    
    def get_history(self, symbol, start_date, end_date):
        """Get historical stock data from Supabase.
        
        Args:
            symbol: Stock symbol
            start_date: Start date (datetime or string)
            end_date: End date (datetime or string)
            
        Returns:
            List of historical data points
        """
        if not self.base_url or not self.anon_key:
            return []
            
        try:
            url = f"{self.base_url}/rest/v1/stock_history"
            
            # Convert dates to strings if needed
            start_str = start_date.strftime('%Y-%m-%d') if isinstance(start_date, datetime) else start_date
            end_str = end_date.strftime('%Y-%m-%d') if isinstance(end_date, datetime) else end_date
            
            params = {
                'symbol': f'eq.{symbol.upper()}',
                'date': f'gte.{start_str}',
                'date': f'lte.{end_str}',
                'order': 'date.asc',
                'select': '*'
            }
            
            resp = requests.get(url, params=params, headers=self._headers(), timeout=10)
            
            if resp.status_code != 200:
                print(f'⚠️ Supabase get_history error {resp.status_code}: {resp.text}')
                return []
                
            items = resp.json()
            
            # Convert to stock_service format
            return [{
                'date': item['date'],
                'open': float(item['open'] or 0),
                'high': float(item['high'] or 0),
                'low': float(item['low'] or 0),
                'close': float(item['close'] or 0),
                'volume': int(item['volume'] or 0)
            } for item in items]
            
        except Exception as e:
            print(f'⚠️ Supabase get_history error: {e}')
            return []
    
    def get_last_history_date(self, symbol):
        """Get the last date of historical data for a symbol.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Last date as datetime object, or None if no data
        """
        if not self.base_url or not self.anon_key:
            return None
            
        try:
            url = f"{self.base_url}/rest/v1/stock_history"
            params = {
                'symbol': f'eq.{symbol.upper()}',
                'select': 'date',
                'order': 'date.desc',
                'limit': '1'
            }
            
            resp = requests.get(url, params=params, headers=self._headers(), timeout=10)
            
            if resp.status_code != 200:
                return None
                
            items = resp.json()
            if not items or len(items) == 0:
                return None
                
            date_str = items[0]['date']
            return datetime.strptime(date_str, '%Y-%m-%d').date()
            
        except Exception as e:
            print(f'⚠️ Supabase get_last_history_date error: {e}')
            return None
    
    def save_history_batch(self, symbol, records):
        """Save historical data in batches to Supabase.
        
        Args:
            symbol: Stock symbol
            records: List of history records
            
        Returns:
            Number of records successfully saved
        """
        if not self.base_url or not self.anon_key:
            return 0
            
        if not records or len(records) == 0:
            return 0
            
        try:
            url = f"{self.base_url}/rest/v1/stock_history"
            
            # Prepare payload
            payload = []
            for record in records:
                payload.append({
                    'symbol': symbol.upper(),
                    'date': record['date'],
                    'open': float(record.get('open', 0)),
                    'high': float(record.get('high', 0)),
                    'low': float(record.get('low', 0)),
                    'close': float(record.get('close', 0)),
                    'volume': int(record.get('volume', 0)),
                    'adj_close': float(record.get('adj_close', record.get('close', 0)))
                })
            
            # Split into batches of 100 (Supabase recommendation)
            batch_size = 100
            total_saved = 0
            
            for i in range(0, len(payload), batch_size):
                batch = payload[i:i + batch_size]
                
                headers = self._headers()
                headers['Prefer'] = 'resolution=ignore-duplicates'
                
                resp = requests.post(url, json=batch, headers=headers, timeout=30)
                
                if resp.status_code in [200, 201]:
                    total_saved += len(batch)
                    print(f'✅ Supabase saved {len(batch)} history records for {symbol}')
                else:
                    print(f'⚠️ Supabase batch error {resp.status_code}: {resp.text}')
                    
                    # Retry with smaller batch on failure
                    if len(batch) > 10:
                        retry_size = 10
                        for j in range(0, len(batch), retry_size):
                            retry_batch = batch[j:j + retry_size]
                            retry_resp = requests.post(url, json=retry_batch, headers=headers, timeout=30)
                            if retry_resp.status_code in [200, 201]:
                                total_saved += len(retry_batch)
                                print(f'✅ Retry successful: {len(retry_batch)} records')
            
            print(f'✅ Total saved: {total_saved}/{len(records)} records for {symbol}')
            return total_saved
            
        except Exception as e:
            print(f'⚠️ Supabase save_history_batch error: {e}')
            return 0


# Global instance
supabase_stock_cache = SupabaseStockCache()
