"""News collection and caching service."""
import time
import random
import threading
import requests
import feedparser
import re
from datetime import datetime
from config.env import config
from utils.helpers import analyze_sentiment


class NewsService:
    """Service for collecting and caching news from multiple sources."""
    
    def __init__(self):
        self.news_cache = {}
        self.scheduler_running = False
        
        # Financial Juice state
        self.fj_last_fetch_ts = 0.0
        self.fj_backoff_until_ts = 0.0
        self.fj_fail_count = 0
        self.fj_etag = None
        self.fj_last_modified = None
        self.fj_cached_items = []
    
    def collect_financial_juice_news(self):
        """Collect news from Financial Juice RSS with rate limiting."""
        try:
            now = time.time()

            # Check backoff period
            if now < self.fj_backoff_until_ts:
                wait_left = int(self.fj_backoff_until_ts - now)
                print(f"Financial Juice: 백오프 활성화로 요청 생략 ({wait_left}s 남음)")
                return self.fj_cached_items

            # Check minimum interval with jitter
            min_interval = config.FINANCIAL_JUICE_MIN_INTERVAL_SEC + random.uniform(0, config.FINANCIAL_JUICE_JITTER_SEC)
            if self.fj_last_fetch_ts and (now - self.fj_last_fetch_ts) < min_interval:
                print(f"Financial Juice: 스로틀링으로 요청 생략 (경과 {int(now - self.fj_last_fetch_ts)}s / 필요 {int(min_interval)}s)")
                return self.fj_cached_items

            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            if self.fj_etag:
                headers['If-None-Match'] = self.fj_etag
            if self.fj_last_modified:
                headers['If-Modified-Since'] = self.fj_last_modified

            print(f"Financial Juice RSS 수집 시도: https://www.financialjuice.com/feed.ashx?xy=rss")

            response = requests.get('https://www.financialjuice.com/feed.ashx?xy=rss', headers=headers, timeout=15)
            status = response.status_code

            if status == 304:
                # Not modified - use cache
                self.fj_last_fetch_ts = now
                print("Financial Juice: 304 Not Modified → 캐시 사용")
                return self.fj_cached_items

            if status == 200:
                # Parse new data
                feed = feedparser.parse(response.content)

                print("Financial Juice RSS 상태:")
                print(f"  - entries count: {len(getattr(feed, 'entries', []))}")
                if hasattr(feed, 'feed'):
                    print(f"  - feed title: {getattr(feed.feed, 'title', 'No title')}")

                if not feed.entries:
                    print("Financial Juice RSS: 뉴스 항목이 없습니다")
                    self.fj_last_fetch_ts = now
                    self.fj_etag = response.headers.get('ETag') or self.fj_etag
                    self.fj_last_modified = response.headers.get('Last-Modified') or self.fj_last_modified
                    self.fj_fail_count = 0
                    self.fj_backoff_until_ts = 0
                    self.fj_cached_items = []
                    return []

                news_items = []
                for entry in feed.entries[:20]:
                    # Parse RSS date format to ISO format
                    published_time = datetime.now().isoformat()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        try:
                            from time import mktime
                            timestamp = mktime(entry.published_parsed)
                            published_time = datetime.fromtimestamp(timestamp).isoformat()
                        except Exception:
                            pass

                    # Clean summary text (remove HTML tags)
                    summary = entry.get('summary', '')
                    if summary:
                        summary = re.sub(r'<[^>]+>', '', summary)
                        summary = summary.strip()

                    news_item = {
                        'title': entry.get('title', 'Untitled'),
                        'summary': summary,
                        'url': entry.get('link', '#'),
                        'source': 'Financial Juice',
                        'publishedAt': published_time,
                        'sentiment': analyze_sentiment(entry.get('title', '') + ' ' + summary)
                    }
                    news_items.append(news_item)

                # Update state on success
                self.fj_last_fetch_ts = now
                self.fj_fail_count = 0
                self.fj_backoff_until_ts = 0
                self.fj_etag = response.headers.get('ETag') or self.fj_etag
                self.fj_last_modified = response.headers.get('Last-Modified') or self.fj_last_modified
                self.fj_cached_items = news_items

                print(f"Financial Juice 뉴스 수집 완료: {len(news_items)}건")
                return news_items

            # Handle error codes
            if status in (403, 429):
                self.fj_fail_count += 1
                backoff = min(config.FINANCIAL_JUICE_MAX_BACKOFF_SEC, int((2 ** min(self.fj_fail_count, 6)) * 30))
                self.fj_backoff_until_ts = now + backoff
                print(f"Financial Juice: 상태 {status}로 백오프 시작 {backoff}s (실패 {self.fj_fail_count}회)")
                return self.fj_cached_items

            print(f"Financial Juice HTTP 에러: {status}")
            return self.fj_cached_items

        except Exception as e:
            print(f"Financial Juice 뉴스 수집 실패: {e}")
            import traceback
            traceback.print_exc()
            
            now = time.time()
            self.fj_fail_count += 1
            backoff = min(config.FINANCIAL_JUICE_MAX_BACKOFF_SEC, int((2 ** min(self.fj_fail_count, 6)) * 30))
            self.fj_backoff_until_ts = now + backoff
            return self.fj_cached_items
    
    def collect_saveticker_news(self):
        """Collect news from SaveTicker API."""
        try:
            proxy_url = 'https://api.allorigins.win/get?url='
            target_url = requests.utils.quote('https://api.saveticker.com/api/news/list', safe='')
            full_url = proxy_url + target_url
            
            response = requests.get(full_url, timeout=15)
            if not response.ok:
                print(f"SaveTicker API 에러: {response.status_code}")
                return []
            
            data = response.json()
            news_data = data.get('contents')
            if not news_data:
                return []
            
            import json
            try:
                parsed_data = json.loads(news_data)
            except json.JSONDecodeError as e:
                print(f"SaveTicker JSON 파싱 에러: {e}")
                return []
            
            news_list = parsed_data.get('news_list', [])
            if not isinstance(news_list, list):
                return []
            
            news_items = []
            for item in news_list[:15]:
                news_item = {
                    'title': item.get('title', 'No title'),
                    'summary': item.get('content', 'No content'),
                    'url': '#',
                    'source': item.get('source', 'SaveTicker'),
                    'publishedAt': item.get('created_at', datetime.now().isoformat()),
                    'sentiment': analyze_sentiment(item.get('title', '') + ' ' + item.get('content', ''))
                }
                news_items.append(news_item)
            
            print(f"SaveTicker 뉴스 수집 완료: {len(news_items)}건")
            return news_items
        except Exception as e:
            print(f"SaveTicker 뉴스 수집 실패: {e}")
            return []
    
    def collect_all_news(self):
        """Collect news from all sources and remove duplicates."""
        try:
            financial_juice_news = self.collect_financial_juice_news()
            saveticker_news = self.collect_saveticker_news()
            
            all_news = financial_juice_news + saveticker_news
            
            # Remove duplicates (by title)
            seen_titles = set()
            unique_news = []
            for news in all_news:
                title_key = news['title'].lower().strip()
                if title_key not in seen_titles:
                    seen_titles.add(title_key)
                    unique_news.append(news)
            
            # Sort by published date (newest first)
            unique_news.sort(key=lambda x: x['publishedAt'], reverse=True)
            
            print(f"전체 뉴스 수집 완료: {len(unique_news)}건 (중복 제거 후)")
            return unique_news
        except Exception as e:
            print(f"뉴스 수집 에러: {e}")
            return []
    
    def update_cache(self, new_news):
        """Update news cache with memory management."""
        current_time = time.time()
        cache_key = 'latest_news'
        
        # Update main cache
        self.news_cache[cache_key] = (new_news, current_time)
        
        # Clean up old cache entries
        self._cleanup_old_cache_entries()
        
        # Limit news size
        if len(new_news) > config.MAX_NEWS_CACHE_SIZE:
            new_news = new_news[:config.MAX_NEWS_CACHE_SIZE]
            self.news_cache[cache_key] = (new_news, current_time)
        
        print(f"뉴스 캐시 업데이트: {len(new_news)}건")
    
    def _cleanup_old_cache_entries(self):
        """Clean up old cache entries."""
        current_time = time.time()
        max_age = config.NEWS_MAX_AGE_HOURS * 3600
        
        keys_to_remove = []
        for key, (data, cached_time) in self.news_cache.items():
            if current_time - cached_time > max_age:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.news_cache[key]
        
        if keys_to_remove:
            print(f"오래된 캐시 엔트리 {len(keys_to_remove)}개 삭제")
    
    def get_cached_news(self):
        """Get cached news if available and not expired."""
        cache_key = 'latest_news'
        current_time = time.time()
        
        if cache_key in self.news_cache:
            cached_news, cached_time = self.news_cache[cache_key]
            if current_time - cached_time < config.NEWS_CACHE_DURATION:
                return cached_news, True
        
        return None, False
    
    def news_collection_scheduler(self):
        """Background scheduler to collect news periodically."""
        self.scheduler_running = True
        print(f"뉴스 수집 스케줄러 시작 (간격: {config.NEWS_SCHEDULER_INTERVAL_SEC}s ± 지터)")
        
        while self.scheduler_running:
            try:
                print("스케줄러: 뉴스 수집 시작...")
                latest_news = self.collect_all_news()
                
                if latest_news:
                    self.update_cache(latest_news)
                    print(f"스케줄러: 뉴스 수집 완료 - {len(latest_news)}건")
                else:
                    print("스케줄러: 수집된 뉴스가 없습니다")
                
                # Wait with jitter
                sleep_time = config.NEWS_SCHEDULER_INTERVAL_SEC + random.uniform(0, 5)
                time.sleep(sleep_time)
                
            except Exception as e:
                print(f"스케줄러 에러: {e}")
                sleep_time = config.NEWS_SCHEDULER_INTERVAL_SEC + random.uniform(0, 5)
                time.sleep(sleep_time)
    
    def start_scheduler(self):
        """Start news scheduler as daemon thread."""
        if not self.scheduler_running:
            scheduler_thread = threading.Thread(target=self.news_collection_scheduler, daemon=True)
            scheduler_thread.start()
            return True
        return False


# Global news service instance
news_service = NewsService()
