#!/usr/bin/env python3
"""
Simple script to import SQL via Railway run
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from services.database import DatabaseService
from sqlalchemy import text

def main():
    print("🚀 Importing news data to Railway PostgreSQL")
    
    # Read SQL file
    sql_file = os.path.join(os.path.dirname(__file__), 'railway_import_news.sql')
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    print(f"📏 SQL size: {len(sql) / 1024:.1f} KB")
    
    # Get engine and execute
    engine = DatabaseService.get_engine()
    
    print("📤 Executing import...")
    with engine.begin() as conn:
        conn.execute(text(sql))
    
    print("✅ SQL executed successfully")
    
    # Verify count
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM news_articles"))
        count = result.fetchone()[0]
        print(f"✅ {count} rows in news_articles")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
