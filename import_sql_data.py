#!/usr/bin/env python3
"""
Import Supabase SQL dumps into Railway PostgreSQL
Maps news_items -> news_articles table
"""
import re
import sys
from pathlib import Path

# SQL file paths
NEWS_SQL = Path("/Users/hs/Downloads/news_items_rows.sql")
KV_SQL = Path("/Users/hs/Downloads/kv_store_d76be8a4_rows.sql")

def parse_news_sql(sql_file):
    """Parse INSERT statement from news_items SQL dump"""
    with open(sql_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract INSERT statement
    # Format: INSERT INTO "public"."news_items" (...) VALUES (...), (...), ...;
    match = re.search(r'INSERT INTO "public"\."news_items" \((.*?)\) VALUES (.+);', content, re.DOTALL)
    if not match:
        print("❌ No INSERT statement found")
        return None, []
    
    columns = [col.strip().strip('"') for col in match.group(1).split(',')]
    values_str = match.group(2)
    
    # Parse individual value tuples
    # This is complex due to nested parentheses and quotes
    rows = []
    current_row = []
    in_string = False
    escape_next = False
    depth = 0
    current_value = ""
    
    for char in values_str:
        if escape_next:
            current_value += char
            escape_next = False
            continue
            
        if char == '\\':
            escape_next = True
            current_value += char
            continue
            
        if char == "'" and not escape_next:
            in_string = not in_string
            current_value += char
            continue
            
        if not in_string:
            if char == '(':
                if depth == 0:
                    # Start of new row
                    current_row = []
                    current_value = ""
                else:
                    current_value += char
                depth += 1
            elif char == ')':
                depth -= 1
                if depth == 0:
                    # End of row
                    if current_value:
                        current_row.append(current_value.strip())
                    rows.append(current_row)
                    current_value = ""
                else:
                    current_value += char
            elif char == ',' and depth == 1:
                # Field separator within row
                current_row.append(current_value.strip())
                current_value = ""
            else:
                current_value += char
        else:
            current_value += char
    
    print(f"✅ Parsed {len(rows)} rows from news_items SQL")
    return columns, rows

def generate_railway_sql(columns, rows):
    """Generate SQL for Railway's news_articles table"""
    # Map Supabase columns to Railway schema
    # Both use: id, title, summary, url, source, published_at, sentiment, created_at
    # Supabase has: updated_at, url_norm (we'll skip these)
    # Railway has: symbols (we'll set to NULL)
    
    railway_columns = ['id', 'title', 'summary', 'url', 'source', 'published_at', 'sentiment', 'created_at', 'symbols']
    
    # Find column indices in Supabase data
    col_map = {}
    for i, col in enumerate(columns):
        if col in ['id', 'title', 'summary', 'url', 'source', 'published_at', 'sentiment', 'created_at']:
            col_map[col] = i
    
    sql_lines = [f'INSERT INTO news_articles ({", ".join(railway_columns)}) VALUES']
    
    for i, row in enumerate(rows):
        values = []
        for col in railway_columns:
            if col == 'symbols':
                values.append('NULL')  # No symbols in Supabase data
            else:
                idx = col_map.get(col)
                if idx is not None and idx < len(row):
                    val = row[idx]
                    # Clean up value (already quoted from original SQL)
                    values.append(val if val else 'NULL')
                else:
                    values.append('NULL')
        
        line = f"({', '.join(values)})"
        if i < len(rows) - 1:
            line += ","
        else:
            line += ";"
        sql_lines.append(line)
    
    return '\n'.join(sql_lines)

def main():
    print("🚀 Supabase -> Railway SQL Import Generator")
    print(f"📁 Reading: {NEWS_SQL}")
    
    if not NEWS_SQL.exists():
        print(f"❌ File not found: {NEWS_SQL}")
        sys.exit(1)
    
    # Parse Supabase SQL
    columns, rows = parse_news_sql(NEWS_SQL)
    if not rows:
        print("❌ No data to import")
        sys.exit(1)
    
    print(f"📊 Columns: {', '.join(columns)}")
    print(f"📦 Total rows: {len(rows)}")
    
    # Generate Railway SQL
    print("\n🔄 Generating Railway-compatible SQL...")
    railway_sql = generate_railway_sql(columns, rows)
    
    # Save output
    output_file = Path(__file__).parent / "railway_import_news.sql"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(railway_sql)
    
    print(f"✅ Generated: {output_file}")
    print(f"📏 Size: {output_file.stat().st_size / 1024:.1f} KB")
    
    print("\n📋 Next steps:")
    print("1. Install psql: brew install postgresql")
    print("2. Connect to Railway: railway connect postgres")
    print(f"3. Import: \\i {output_file}")
    print("   OR: psql $DATABASE_URL < railway_import_news.sql")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
