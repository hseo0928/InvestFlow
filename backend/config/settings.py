"""Application configuration and environment variables."""
import os
from dotenv import load_dotenv

# .env 파일 로드 (프로젝트 루트 .env 우선)
load_dotenv()
# backend 디렉터리의 .env도 보조 로드 (루트에서 실행 시 대비)
try:
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'), override=False)
except Exception:
    pass


class Config:
    """Application configuration."""
    
    # Flask settings
    DEBUG = True
    PORT = 5002
    
    # Cache settings
    CACHE_DURATION = 60  # 60초 캐시
    NEWS_CACHE_DURATION = 30  # 30초 캐시
    MAX_NEWS_CACHE_SIZE = 100  # 최대 캐시 크기
    NEWS_MAX_AGE_HOURS = 24  # 24시간 후 뉴스 삭제
    
    # Supabase settings
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')
    
    # KIS API settings
    KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443'
    KIS_APP_KEY = os.environ.get('KIS_APP_KEY', '')
    KIS_APP_SECRET = os.environ.get('KIS_APP_SECRET', '')
    
    # Financial Juice RSS settings
    FINANCIAL_JUICE_RSS_URL = "https://www.financialjuice.com/feed.ashx?xy=rss"
    FINANCIAL_JUICE_MIN_INTERVAL_SEC = int(os.environ.get('FINANCIAL_JUICE_MIN_INTERVAL_SEC', '180'))
    FINANCIAL_JUICE_JITTER_SEC = int(os.environ.get('FINANCIAL_JUICE_JITTER_SEC', '15'))
    FINANCIAL_JUICE_MAX_BACKOFF_SEC = int(os.environ.get('FINANCIAL_JUICE_MAX_BACKOFF_SEC', '900'))
    
    # News scheduler settings
    NEWS_SCHEDULER_ENABLED = os.environ.get('NEWS_SCHEDULER_ENABLED', '0').lower() in ('1', 'true', 'yes', 'on')
    NEWS_SCHEDULER_INTERVAL_SEC = int(os.environ.get('NEWS_SCHEDULER_INTERVAL_SEC', '120'))
    
    # User-Agent rotation
    USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59'
    ]
    
    @staticmethod
    def supabase_config_present():
        """Check if Supabase configuration is present."""
        return bool(Config.SUPABASE_URL and Config.SUPABASE_ANON_KEY)
    
    @staticmethod
    def validate():
        """Validate configuration and print warnings."""
        if not Config.supabase_config_present():
            print('[WARN] Supabase configuration missing: set SUPABASE_URL and SUPABASE_ANON_KEY in environment/.env')


# Validate configuration on import
Config.validate()
