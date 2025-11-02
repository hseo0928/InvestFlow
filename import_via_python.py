#!/usr/bin/env python3
"""
Import news data using psycopg2 directly (no psql required)
"""
import sys
import subprocess
import json
from pathlib import Path

def get_database_url():
    """Get DATABASE_URL from Railway variables"""
    result = subprocess.run(
        ['railway', 'variables', '--json'],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Failed to get Railway variables: {result.stderr}")
        sys.exit(1)
    
    variables = json.loads(result.stdout)
    return variables.get('DATABASE_URL')

def main():
    print("🚀 Direct Python Import to Railway PostgreSQL")
    
    # Get DATABASE_URL
    print("🔍 Getting DATABASE_URL...")
    database_url = get_database_url()
    
    if not database_url:
        print("❌ DATABASE_URL not found")
        sys.exit(1)
    
    # Fix postgres:// -> postgresql:// for SQLAlchemy
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    print(f"✅ Got DATABASE_URL")
    
    # Import using DatabaseService (same as backend)
    sys.path.insert(0, str(Path(__file__).parent / 'backend'))
    
    try:
        from services.database import DatabaseService
        import os
        
        # Set DATABASE_URL for DatabaseService
        os.environ['DATABASE_URL'] = database_url
        
        print("📦 Reading SQL file...")
        sql_file = Path(__file__).parent / "railway_import_news.sql"
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        print(f"📏 SQL size: {len(sql) / 1024:.1f} KB")
        
        # Execute raw SQL
        print("📤 Executing import...")
        engine = DatabaseService.get_engine()
        
        with engine.connect() as conn:
            # Execute as raw SQL
            conn.execute(sql)
            conn.commit()
            print("✅ SQL executed successfully")
            
            # Verify count
            result = conn.execute("SELECT COUNT(*) FROM news_articles")
            count = result.fetchone()[0]
            print(f"✅ Imported {count} rows into news_articles")
        
        print("\n🎉 Import complete!")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure backend dependencies are installed:")
        print("  cd backend && pip3 install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
