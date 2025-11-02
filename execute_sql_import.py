#!/usr/bin/env python3
"""
Execute SQL import directly into Railway PostgreSQL using Python
"""
import subprocess
import sys
from pathlib import Path

SQL_FILE = Path(__file__).parent / "railway_import_news.sql"

def main():
    print("🚀 Importing news data to Railway PostgreSQL")
    
    if not SQL_FILE.exists():
        print(f"❌ SQL file not found: {SQL_FILE}")
        print("Run import_sql_data.py first!")
        sys.exit(1)
    
    print(f"📁 SQL file: {SQL_FILE}")
    
    # Get DATABASE_URL from Railway
    print("🔍 Getting DATABASE_URL from Railway...")
    result = subprocess.run(
        ['railway', 'variables', '--json'],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Failed to get Railway variables: {result.stderr}")
        sys.exit(1)
    
    import json
    variables = json.loads(result.stdout)
    database_url = variables.get('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL not found in Railway variables")
        sys.exit(1)
    
    print(f"✅ Got DATABASE_URL")
    
    # Check if psql is installed
    psql_check = subprocess.run(['/opt/homebrew/opt/libpq/bin/psql', '--version'], capture_output=True)
    
    if psql_check.returncode != 0:
        print("\n⚠️  psql not installed")
        print("Install: brew install libpq")
        print("Add to PATH: export PATH=\"/opt/homebrew/opt/libpq/bin:$PATH\"")
        sys.exit(1)
    
    psql_path = '/opt/homebrew/opt/libpq/bin/psql'
    
    # Convert internal URL to external (Railway proxy)
    if 'postgres.railway.internal' in database_url:
        # Note: External connections may not be enabled. Try direct internal connection via railway run.
        print("⚠️  DATABASE_URL uses internal host. External connections may not be enabled.")
        print("Attempting to import via Railway CLI tunnel...")
        
        # Try using railway connect
        result = subprocess.run(
            ['railway', 'connect', 'postgres'],
            input=f'\\i {SQL_FILE}',
            text=True,
            capture_output=True
        )
        
        if result.returncode == 0:
            print("✅ Import successful via Railway CLI!")
            print(result.stdout)
            return 0
        else:
            print(f"❌ Railway connect failed: {result.stderr}")
            print("\n� Manual import required:")
            print("1. Run: railway connect postgres")
            print(f"2. In psql prompt: \\i {SQL_FILE}")
            sys.exit(1)
    
    # Execute SQL import with external URL
    print(f"�📤 Importing {SQL_FILE.stat().st_size / 1024:.1f} KB...")
    with open(SQL_FILE, 'r') as f:
        result = subprocess.run(
            [psql_path, database_url],
            stdin=f,
            capture_output=True,
            text=True
        )
    
    if result.returncode != 0:
        print(f"❌ Import failed: {result.stderr}")
        sys.exit(1)
    
    print("✅ Import successful!")
    print(result.stdout)
    
    # Verify import
    print("\n🔍 Verifying import...")
    result = subprocess.run(
        [psql_path, database_url, '-c', 'SELECT COUNT(*) FROM news_articles;'],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print(result.stdout)
    else:
        print(f"⚠️  Verification failed: {result.stderr}")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
