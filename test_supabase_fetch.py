"""
Simple migration test - fetch from Supabase and display data
"""
import requests
import os

SUPABASE_URL = "https://czjtlzbqljrhosdydwye.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6anRsemJxbGpyaG9zZHlkd3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDA4OTgsImV4cCI6MjA3NDA3Njg5OH0.rl3EAbGusnNNbSgPvRlNYDU9hQlgTZjSTk8pxxo9KB4"

url = f"{SUPABASE_URL}/rest/v1/financial_news"
headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

params = {
    'select': '*',
    'order': 'published_at.desc',
    'limit': 10
}

print("📡 Supabase에서 뉴스 데이터 가져오는 중...")
response = requests.get(url, params=params, headers=headers, timeout=30)

if response.status_code == 200:
    news = response.json()
    print(f"✅ {len(news)}건의 뉴스 가져옴")
    
    if news:
        print("\n최근 뉴스 샘플:")
        for item in news[:3]:
            print(f"  - {item.get('title', 'No title')}")
            print(f"    Source: {item.get('source', 'Unknown')}")
            print(f"    Published: {item.get('published_at', 'Unknown')}")
            print()
    
    # Save to file for inspection
    import json
    with open('/tmp/supabase_news.json', 'w') as f:
        json.dump(news, f, indent=2)
    print("💾 데이터를 /tmp/supabase_news.json에 저장했습니다")
else:
    print(f"❌ 오류: {response.status_code}")
    print(response.text)
