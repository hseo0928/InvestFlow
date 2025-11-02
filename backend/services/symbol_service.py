"""
Symbol search and validation service using US-Stock-Symbols data.
Provides fuzzy search capabilities for stock ticker symbols.
"""

import json
from pathlib import Path
from fuzzywuzzy import fuzz
from typing import List, Dict, Optional


class SymbolService:
    """Service for searching and validating stock symbols."""
    
    def __init__(self):
        """Initialize symbol service with US stock symbols data."""
        data_path = Path(__file__).parent.parent / 'data' / 'us_stock_symbols.json'
        
        try:
            with open(data_path, 'r') as f:
                self.symbols = json.load(f)
            
            # Create index for O(1) validation
            self.symbol_index = {s['symbol']: s for s in self.symbols}
            
            print(f"✅ Loaded {len(self.symbols)} stock symbols")
            
        except FileNotFoundError:
            print(f"⚠️ Warning: Symbol data file not found at {data_path}")
            self.symbols = []
            self.symbol_index = {}
    
    def search(self, query: str, limit: int = 10) -> List[Dict]:
        """
        Search for stock symbols using fuzzy matching.
        
        Args:
            query: Search query (partial symbol or company name)
            limit: Maximum number of results to return
            
        Returns:
            List of matching symbols with their metadata
        """
        if not query:
            # Return popular stocks if no query
            popular = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'WMT']
            return [self.symbol_index[s] for s in popular if s in self.symbol_index]
        
        query_upper = query.upper()
        matches = []
        
        for symbol_data in self.symbols:
            symbol = symbol_data['symbol']
            name = symbol_data.get('name', '').upper()
            
            # Exact symbol match gets highest priority
            if symbol == query_upper:
                score = 1000
            # Symbol starts with query
            elif symbol.startswith(query_upper):
                score = 900
            # Query is in symbol
            elif query_upper in symbol:
                score = 800
            # Company name contains query (for "tesla" → TSLA)
            elif query_upper in name:
                score = 700
            # Fuzzy match on symbol
            else:
                symbol_score = fuzz.partial_ratio(query_upper, symbol)
                name_score = fuzz.partial_ratio(query_upper, name) if name else 0
                score = max(symbol_score, name_score)
            
            # Only include if score is reasonable
            if score > 60:
                matches.append((score, symbol_data))
        
        # Sort by score descending
        matches.sort(key=lambda x: x[0], reverse=True)
        
        return [m[1] for m in matches[:limit]]
    
    def validate(self, symbol: str) -> bool:
        """
        Validate if a symbol exists in the database.
        
        Args:
            symbol: Stock ticker symbol
            
        Returns:
            True if symbol exists, False otherwise
        """
        return symbol.upper() in self.symbol_index
    
    def get_symbol_info(self, symbol: str) -> Optional[Dict]:
        """
        Get full information for a symbol.
        
        Args:
            symbol: Stock ticker symbol
            
        Returns:
            Symbol metadata or None if not found
        """
        return self.symbol_index.get(symbol.upper())


# Singleton instance
symbol_service = SymbolService()
