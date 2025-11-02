"""Supabase integration service."""
import requests
from config.env import config
from utils.helpers import clamp


def get_supabase_headers():
    """Get Supabase API headers."""
    return {
        'apikey': config.SUPABASE_ANON_KEY or '',
        'Authorization': f'Bearer {config.SUPABASE_ANON_KEY or ""}',
        'Content-Type': 'application/json'
    }


def fetch_news(limit=100, last_update_iso=None):
    """Fetch news from Supabase PostgREST.
    
    Args:
        limit: Maximum number of items to fetch (1-200)
        last_update_iso: ISO timestamp to filter newer items
        
    Returns:
        List of news items
        
    Raises:
        Exception: If Supabase configuration is missing or API call fails
    """
    if not config.SUPABASE_URL or not config.SUPABASE_ANON_KEY:
        raise Exception('Supabase configuration missing: set SUPABASE_URL and SUPABASE_ANON_KEY')

    safe_limit = clamp(limit, 1, 200)
    base_url = (config.SUPABASE_URL or '').rstrip('/')
    url = f"{base_url}/rest/v1/news_items"

    params = {
        'select': 'title,summary,url,source,published_at,sentiment',
        'order': 'published_at.desc',
        'limit': str(safe_limit),
    }
    
    if last_update_iso:
        params['published_at'] = f'gt.{last_update_iso}'

    try:
        resp = requests.get(url, params=params, headers=get_supabase_headers(), timeout=10)
        if resp.status_code != 200:
            raise Exception(f"Supabase REST error {resp.status_code}: {resp.text}")

        items = resp.json() or []
        mapped = []
        for i in items:
            mapped.append({
                'title': i.get('title', 'Untitled'),
                'summary': i.get('summary', ''),
                'url': i.get('url', '#'),
                'source': i.get('source', 'Financial Juice'),
                'publishedAt': i.get('published_at'),
                'sentiment': i.get('sentiment'),
            })
        return mapped
    except Exception as e:
        raise
