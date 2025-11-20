"""Scheduler service for background tasks."""
import time
import threading
import schedule
from config.env import config
from services.news_service import news_service
from services.stock_service import get_quote
from services.database import DatabaseService

class SchedulerService:
    """Centralized scheduler for all background tasks."""
    
    def __init__(self):
        self.running = False
        self.thread = None

    def _run_scheduler(self):
        """Internal loop to run pending tasks."""
        print("🕒 Scheduler started.")
        while self.running:
            schedule.run_pending()
            time.sleep(1)

    def start(self):
        """Start the scheduler in a background thread."""
        if self.running:
            return
        
        self.running = True
        
        # Register tasks
        self._register_tasks()
        
        self.thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.thread.start()

    def stop(self):
        """Stop the scheduler."""
        self.running = False
        if self.thread:
            self.thread.join()

    def _register_tasks(self):
        """Register all scheduled jobs."""
        
        # 1. News Collection (Every X seconds)
        interval = config.NEWS_SCHEDULER_INTERVAL_SEC or 300
        schedule.every(interval).seconds.do(self._job_collect_news)
        print(f"📅 Job registered: Collect News every {interval}s")

        # 2. Stock Price Update (Every 1 hour)
        schedule.every(1).hours.do(self._job_update_stocks)
        print(f"📅 Job registered: Update Stocks every 1 hour")

    def _job_collect_news(self):
        """Job: Collect news."""
        print("🔄 Job: Collecting news...")
        try:
            news = news_service.collect_all_news()
            if news:
                news_service.update_cache(news)
        except Exception as e:
            print(f"❌ Job Error (News): {e}")

    def _job_update_stocks(self):
        """Job: Update stock prices for tracked symbols."""
        print("🔄 Job: Updating stock prices...")
        try:
            # In a real app, you might fetch this list from DB
            tracked_symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', '005930.KS'] 
            for symbol in tracked_symbols:
                try:
                    get_quote(symbol) # This function already handles caching/saving
                    time.sleep(1) # Rate limiting
                except Exception as e:
                    print(f"⚠️ Failed to update {symbol}: {e}")
        except Exception as e:
            print(f"❌ Job Error (Stocks): {e}")

scheduler_service = SchedulerService()
