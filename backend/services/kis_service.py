"""KIS (Korea Investment & Securities) API service."""
import time
import threading
import requests
from config.env import config


class KISService:
    """KIS API service for stock quotes and history."""
    
    def __init__(self):
        self.access_token = None
        self.token_expiry = 0
        self.token_lock = threading.Lock()
    
    def get_token(self):
        """Get or refresh KIS access token with thread-safe locking."""
        current_time = time.time()
        
        # Check if token is still valid
        if self.access_token and self.token_expiry > current_time:
            return self.access_token
        
        # Use lock to prevent multiple simultaneous token requests
        with self.token_lock:
            # Double-check after acquiring lock
            if self.access_token and self.token_expiry > current_time:
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
                    # If we have an old token, keep using it
                    if self.access_token:
                        print(f'⚠️ KIS token refresh failed, using cached token: {response.text}')
                        self.token_expiry = current_time + (5 * 60)  # Extend by 5 minutes
                        return self.access_token
                    raise Exception(f'KIS token error: {response.text}')
                
                data = response.json()
                self.access_token = data['access_token']
                self.token_expiry = current_time + (23 * 60 * 60)  # 23시간
                
                return self.access_token
            except Exception as e:
                # If we have an old token, keep using it
                if self.access_token:
                    print(f'⚠️ KIS token request failed, using cached token: {str(e)}')
                    self.token_expiry = current_time + (5 * 60)  # Extend by 5 minutes
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
