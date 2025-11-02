"""Utility helper functions."""
import random


# Additional caching layer
CACHE_DURATION = 60  # seconds


def clamp(n, lo, hi):
    """Clamp a number between min and max values."""
    try:
        n = int(n)
    except Exception:
        n = lo
    return max(lo, min(hi, n))


def get_random_headers():
    """Get random headers for HTTP requests."""
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59'
    ]
    
    return {
        'User-Agent': random.choice(user_agents),
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
    }


def analyze_sentiment(text):
    """Simple keyword-based sentiment analysis."""
    positive_keywords = ['상승', '증가', '성장', '긍정', '성공', '수익', '급등', '호재', 
                        'up', 'gain', 'bull', 'rise', 'positive', 'growth']
    negative_keywords = ['하락', '감소', '손실', '부정', '실패', '급락', '악재', 
                        'down', 'loss', 'bear', 'fall', 'negative', 'decline']
    
    text_lower = text.lower()
    positive_count = sum(1 for keyword in positive_keywords if keyword in text_lower)
    negative_count = sum(1 for keyword in negative_keywords if keyword in text_lower)
    
    if positive_count > negative_count:
        return 'positive'
    elif negative_count > positive_count:
        return 'negative'
    else:
        return 'neutral'
