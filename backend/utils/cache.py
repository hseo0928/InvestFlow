"""Cache management utilities"""
import time

# Cache stores
quote_cache = {}
news_cache = {}

# Cache settings
CACHE_DURATION = 60  # 60 seconds
NEWS_CACHE_DURATION = 30  # 30 seconds
MAX_NEWS_CACHE_SIZE = 100
NEWS_MAX_AGE_HOURS = 24


def get_cached_quote(symbol):
    """Get cached quote data"""
    cache_key = symbol.upper()
    current_time = time.time()
    
    if cache_key in quote_cache:
        cached_data, cached_time = quote_cache[cache_key]
        if current_time - cached_time < CACHE_DURATION:
            return cached_data
    return None


def set_cached_quote(symbol, data):
    """Cache quote data"""
    cache_key = symbol.upper()
    current_time = time.time()
    quote_cache[cache_key] = (data, current_time)


def update_news_cache(new_news):
    """Update news cache with memory management"""
    global news_cache
    current_time = time.time()
    cache_key = 'latest_news'
    
    # Update cache
    news_cache[cache_key] = (new_news, current_time)
    
    # Memory management
    cleanup_old_cache_entries()
    
    # Size limit
    if len(new_news) > MAX_NEWS_CACHE_SIZE:
        new_news = new_news[:MAX_NEWS_CACHE_SIZE]
        news_cache[cache_key] = (new_news, current_time)
    
    print(f"뉴스 캐시 업데이트: {len(new_news)}건")


def cleanup_old_cache_entries():
    """Clean up old cache entries"""
    global news_cache
    current_time = time.time()
    max_age = NEWS_MAX_AGE_HOURS * 3600
    
    keys_to_remove = []
    for key, (data, cached_time) in news_cache.items():
        if current_time - cached_time > max_age:
            keys_to_remove.append(key)
    
    for key in keys_to_remove:
        del news_cache[key]
    
    if keys_to_remove:
        print(f"오래된 캐시 엔트리 {len(keys_to_remove)}개 삭제")
