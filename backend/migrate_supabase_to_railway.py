"""
Migrate data from Supabase to Railway PostgreSQL
Run this script once to transfer existing data

Usage:
  railway run python backend/migrate_supabase_to_railway.py
"""
import requests
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from services.database import DatabaseService
from config.env import config

def migrate_news_from_supabase():
    """Migrate news articles from Supabase to Railway PostgreSQL"""
    print("=== Supabase → Railway 뉴스 데이터 마이그레이션 시작 ===")
    
    # Supabase configuration
    supabase_url = os.getenv('SUPABASE_URL', config.SUPABASE_URL)
    supabase_key = os.getenv('SUPABASE_ANON_KEY', config.SUPABASE_ANON_KEY)
    
    if not supabase_url or not supabase_key:
        print("❌ Supabase 설정이 없습니다. 마이그레이션을 건너뜁니다.")
        return 0
    
    try:
        # Fetch all news from Supabase
        base_url = supabase_url.rstrip('/')
        url = f"{base_url}/rest/v1/financial_news"
        
        headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json'
        }
        
        params = {
            'select': '*',
            'order': 'published_at.desc',
            'limit': 1000  # Adjust as needed
        }
        
        print(f"📡 Supabase에서 뉴스 데이터 가져오는 중...")
        response = requests.get(url, params=params, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Supabase 조회 실패: {response.status_code}")
            print(response.text)
            return 0
        
        supabase_news = response.json()
        print(f"✅ Supabase에서 {len(supabase_news)}건의 뉴스 가져옴")
        
        if not supabase_news:
            print("ℹ️  마이그레이션할 데이터가 없습니다.")
            return 0
        
        # Transform Supabase format to our format
        news_items = []
        for item in supabase_news:
            news_item = {
                'id': item.get('id', item.get('url', '')),
                'title': item.get('title', ''),
                'summary': item.get('summary', ''),
                'url': item.get('url', ''),
                'source': item.get('source', 'Unknown'),
                'publishedAt': item.get('published_at'),
                'symbols': item.get('symbols', []),
                'sentiment': item.get('sentiment')
            }
            news_items.append(news_item)
        
        # Save to Railway PostgreSQL
        print(f"💾 Railway PostgreSQL에 저장 중...")
        saved_count = DatabaseService.save_news(news_items)
        print(f"✅ {saved_count}건의 뉴스를 Railway로 마이그레이션 완료!")
        
        return saved_count
        
    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        import traceback
        traceback.print_exc()
        return 0

def verify_migration():
    """Verify migration by counting records in Railway"""
    try:
        print("\n=== 마이그레이션 검증 ===")
        news = DatabaseService.get_news(limit=10)
        print(f"✅ Railway에서 {len(news)}건의 뉴스 확인됨 (최근 10건)")
        
        if news:
            print("\n최근 뉴스 샘플:")
            for item in news[:3]:
                print(f"  - {item['title'][:50]}... ({item['source']})")
        
        return True
    except Exception as e:
        print(f"❌ 검증 실패: {e}")
        return False

if __name__ == '__main__':
    # Run migration
    migrated_count = migrate_news_from_supabase()
    
    # Verify
    if migrated_count > 0:
        verify_migration()
    
    print("\n=== 마이그레이션 완료 ===")
    print(f"총 {migrated_count}건의 뉴스가 마이그레이션되었습니다.")
