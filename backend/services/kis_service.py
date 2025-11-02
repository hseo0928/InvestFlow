"""KIS (Korea Investment & Securities) API service."""
import os
import time
import threading
import requests
import json
from pathlib import Path
from config.env import config


class KISService:
    """KIS API service for stock quotes and history."""
    
    def __init__(self):
        self.access_token = None
        self.token_expiry = 0
        self.token_lock = threading.Lock()
        # File-based token cache (shared across gunicorn workers)
        self.token_cache_file = Path('/tmp/kis_token_cache.json')
    
    def _load_token_from_file(self):
        """Load token from file cache."""
        try:
            if self.token_cache_file.exists():
                with open(self.token_cache_file, 'r') as f:
                    data = json.load(f)
                    self.access_token = data.get('access_token')
                    self.token_expiry = data.get('token_expiry', 0)
                    
                    # Check if loaded token is still valid
                    if self.access_token and self.token_expiry > time.time():
                        remaining_hours = (self.token_expiry - time.time()) / 3600
                        print(f'📂 KIS token loaded from cache (valid for {remaining_hours:.1f} hours)')
                        return True
        except Exception as e:
            print(f'⚠️ Failed to load KIS token from cache: {e}')
        return False
    
    def _save_token_to_file(self):
        """Save token to file cache."""
        try:
            data = {
                'access_token': self.access_token,
                'token_expiry': self.token_expiry
            }
            with open(self.token_cache_file, 'w') as f:
                json.dump(data, f)
            print(f'💾 KIS token saved to cache')
        except Exception as e:
            print(f'⚠️ Failed to save KIS token to cache: {e}')
    
    def get_token(self):
        """Get or refresh KIS access token with thread-safe locking.
        
        KIS API allows 1 token request per minute, but tokens are valid for 24 hours.
        This method caches the token for the full 24 hours to minimize API calls.
        Token is stored in file system to share across gunicorn workers.
        """
        current_time = time.time()
        
        # Check memory cache first
        if self.access_token and self.token_expiry > current_time:
            return self.access_token
        
        # Use lock to prevent multiple simultaneous token requests
        with self.token_lock:
            # Double-check after acquiring lock
            if self.access_token and self.token_expiry > current_time:
                return self.access_token
            
            # Try loading from file cache (shared across workers)
            if self._load_token_from_file():
                return self.access_token
            
            if not config.KIS_APP_KEY or not config.KIS_APP_SECRET:
                return None
            
            try:
                response = requests.post(
                    f'https://openapi.koreainvestment.com:9443/oauth2/tokenP',
                    json={
                        'grant_type': 'client_credentials',
                        'appkey': config.KIS_APP_KEY,
                        'appsecret': config.KIS_APP_SECRET
                    },
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if response.status_code != 200:
                    # If we have an old token, extend it for another hour
                    if self.access_token:
                        print(f'⚠️ KIS token refresh failed (rate limit), extending cached token: {response.text}')
                        self.token_expiry = current_time + (60 * 60)  # Extend by 1 hour
                        self._save_token_to_file()
                        return self.access_token
                    raise Exception(f'KIS token error: {response.text}')
                
                data = response.json()
                self.access_token = data['access_token']
                # Token is valid for 24 hours (1 day)
                self.token_expiry = current_time + (24 * 60 * 60)
                print(f'✅ KIS token acquired, valid for 24 hours')
                
                # Save to file cache for other workers
                self._save_token_to_file()
                
                return self.access_token
            except Exception as e:
                # If we have an old token, extend it for another hour
                if self.access_token:
                    print(f'⚠️ KIS token request failed, extending cached token: {str(e)}')
                    self.token_expiry = current_time + (60 * 60)  # Extend by 1 hour
                    self._save_token_to_file()
                    return self.access_token
                raise
    
    def get_quote(self, symbol, exchange_code='NAS'):
        """Get stock quote from KIS API.
        
        Args:
            symbol: Stock symbol
            exchange_code: Exchange code (NAS, NYSE, etc.)
            
        Returns:
            Dict with stock quote data
            
        Raises:
            Exception: If API call fails
        """
        token = self.get_token()
        
        if not token:
            raise Exception('KIS API credentials not configured')
        
        response = requests.get(
            f'https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/price',
            params={'AUTH': '', 'EXCD': exchange_code, 'SYMB': symbol},
            headers={
                'content-type': 'application/json; charset=utf-8',
                'authorization': f'Bearer {token}',
                'appkey': config.KIS_APP_KEY,
                'appsecret': config.KIS_APP_SECRET,
                'tr_id': 'HHDFS00000300'
            }
        )
        
        if response.status_code != 200:
            raise Exception(f'KIS API error: {response.text}')
        
        data = response.json()
        
        if data.get('rt_cd') != '0':
            raise Exception(f'KIS API error: {data.get("msg1")}')
        
        output = data['output']
        current_price = float(output['last'])
        previous_close = float(output['base'])
        change = current_price - previous_close
        change_percent = (change / previous_close) * 100
        
        return {
            'symbol': symbol.upper(),
            'name': symbol.upper(),
            'price': current_price,
            'change': change,
            'changePercent': change_percent,
            'volume': int(output.get('tvol', 0)),
            'marketCap': 0,
            'high': float(output.get('high', current_price)),
            'low': float(output.get('low', current_price)),
            'open': float(output.get('open', current_price)),
            'previousClose': previous_close
        }
    
    def get_history(self, symbol, period='D', count=30, exchange_code='NAS'):
        """Get historical stock data from KIS API.
        
        Args:
            symbol: Stock symbol
            period: Period type (D for daily)
            count: Number of data points to fetch
            exchange_code: Exchange code (NAS, NYSE, etc.)
            
        Returns:
            List of historical data points
            
        Raises:
            Exception: If API call fails
        """
        token = self.get_token()
        
        response = requests.get(
            f'https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/dailyprice',
            params={'AUTH': '', 'EXCD': exchange_code, 'SYMB': symbol, 'GUBN': period, 'BYMD': '', 'MODP': '1'},
            headers={
                'Content-Type': 'application/json',
                'authorization': f'Bearer {token}',
                'appkey': config.KIS_APP_KEY,
                'appsecret': config.KIS_APP_SECRET,
                'tr_id': 'HHDFS76240000'
            }
        )
        
        if response.status_code != 200:
            raise Exception(f'KIS API error: {response.text}')
        
        data = response.json()
        
        if data.get('rt_cd') != '0':
            raise Exception(f'KIS API error: {data.get("msg1")}')
        
        history = data['output2'][:count]
        result = []
        
        for item in history:
            result.append({
                'date': item['xymd'],
                'open': float(item['open']),
                'high': float(item['high']),
                'low': float(item['low']),
                'close': float(item['clos']),
                'volume': int(item['tvol'])
            })
        
        return result


# Global KIS service instance
kis_service = KISService()
