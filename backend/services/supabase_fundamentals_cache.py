"""Supabase fundamentals data caching service."""
import requests
from datetime import datetime, timezone
from config.env import config


class SupabaseFundamentalsCache:
    """Service for caching financial fundamentals data in Supabase."""
    
    def __init__(self):
        """Initialize Supabase fundamentals cache service."""
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
    
    def get(self, symbol: str, data_type: str, ttl: int = 86400):
        """Get cached fundamentals data from Supabase.
        
        Args:
            symbol: Stock symbol
            data_type: Type of data ('income', 'balance', 'ratios', 'dcf')
            ttl: Time to live in seconds (default: 24 hours)
            
        Returns:
            Fundamentals data dict if fresh, None if stale or not found
        """
        if not self.base_url or not self.anon_key:
            return None
            
        try:
            url = f"{self.base_url}/rest/v1/fundamentals_data"
            params = {
                'symbol': f'eq.{symbol.upper()}',
                'data_type': f'eq.{data_type}',
                'select': '*'
            }
            
            resp = requests.get(url, params=params, headers=self._headers(), timeout=10)
            
            if resp.status_code != 200:
                print(f'⚠️ Supabase fundamentals get error {resp.status_code}: {resp.text}')
                return None
                
            items = resp.json()
            if not items or len(items) == 0:
                return None
                
            record = items[0]
            
            # Check TTL
            updated_at = datetime.fromisoformat(record['updated_at'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            age_seconds = (now - updated_at).total_seconds()
            
            if age_seconds > ttl:
                print(f'⏰ Supabase fundamentals cache expired for {symbol}/{data_type} ({age_seconds:.0f}s > {ttl}s)')
                return None
                
            print(f'✅ Supabase fundamentals cache hit for {symbol}/{data_type} (age: {age_seconds:.0f}s)')
            
            return record['value_json']
            
        except requests.exceptions.RequestException as e:
            print(f'⚠️ Supabase connection error: {e}')
            return None
        except Exception as e:
            print(f'⚠️ Supabase fundamentals get error: {e}')
            return None
    
    def save(self, symbol: str, data_type: str, data: dict):
        """Save or update fundamentals data in Supabase.
        
        Args:
            symbol: Stock symbol
            data_type: Type of data ('income', 'balance', 'ratios', 'dcf')
            data: Fundamentals data dict
            
        Returns:
            True if successful, False otherwise
        """
        if not self.base_url or not self.anon_key:
            return False
            
        try:
            url = f"{self.base_url}/rest/v1/fundamentals_data"
            
            payload = {
                'symbol': symbol.upper(),
                'data_type': data_type,
                'value_json': data
            }
            
            # Upsert (insert or update)
            headers = self._headers()
            headers['Prefer'] = 'resolution=merge-duplicates'
            
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            
            if resp.status_code in (200, 201):
                print(f'✅ Saved {symbol}/{data_type} to Supabase cache')
                return True
            else:
                print(f'⚠️ Supabase fundamentals save error {resp.status_code}: {resp.text}')
                return False
                
        except requests.exceptions.RequestException as e:
            print(f'⚠️ Supabase connection error: {e}')
            return False
        except Exception as e:
            print(f'⚠️ Supabase fundamentals save error: {e}')
            return False
    
    def delete(self, symbol: str, data_type: str = None):
        """Delete fundamentals data from Supabase.
        
        Args:
            symbol: Stock symbol
            data_type: Type to delete (None = delete all types for symbol)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.base_url or not self.anon_key:
            return False
            
        try:
            url = f"{self.base_url}/rest/v1/fundamentals_data"
            params = {'symbol': f'eq.{symbol.upper()}'}
            
            if data_type:
                params['data_type'] = f'eq.{data_type}'
            
            resp = requests.delete(url, params=params, headers=self._headers(), timeout=10)
            
            if resp.status_code in (200, 204):
                print(f'✅ Deleted {symbol}/{data_type or "all"} from Supabase cache')
                return True
            else:
                print(f'⚠️ Supabase fundamentals delete error {resp.status_code}: {resp.text}')
                return False
                
        except Exception as e:
            print(f'⚠️ Supabase fundamentals delete error: {e}')
            return False


# Singleton instance
supabase_fundamentals_cache = SupabaseFundamentalsCache()
