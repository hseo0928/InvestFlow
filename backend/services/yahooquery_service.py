"""Yahoo Finance data service using yahooquery."""
from yahooquery import Ticker
from typing import Dict, List, Optional
from datetime import datetime
import pandas as pd

class YahooQueryService:
    """Service for fetching financial data using yahooquery."""
    
    def get_income_statement(self, symbol: str, frequency: str = 'a') -> Dict:
        """
        Get income statement data.
        
        Args:
            symbol: Stock symbol
            frequency: 'a' for annual, 'q' for quarterly
            
        Returns:
            Dict with annual and quarterly data
        """
        try:
            ticker = Ticker(symbol)
            
            # Get both annual and quarterly
            annual_df = ticker.income_statement(frequency='a')
            quarterly_df = ticker.income_statement(frequency='q')
            
            # Convert to dict format
            annual_data = []
            quarterly_data = []
            
            if isinstance(annual_df, pd.DataFrame) and not annual_df.empty:
                # Reset index to get dates as column
                annual_df_reset = annual_df.reset_index()
                annual_data = annual_df_reset.to_dict('records')
            
            if isinstance(quarterly_df, pd.DataFrame) and not quarterly_df.empty:
                quarterly_df_reset = quarterly_df.reset_index()
                quarterly_data = quarterly_df_reset.to_dict('records')
            
            return {
                'symbol': symbol.upper(),
                'annual': annual_data,
                'quarterly': quarterly_data,
                'updated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ yahooquery income_statement error for {symbol}: {e}")
            return {
                'symbol': symbol.upper(),
                'annual': [],
                'quarterly': [],
                'updated_at': datetime.now().isoformat(),
                'error': str(e)
            }
    
    def get_balance_sheet(self, symbol: str) -> Dict:
        """Get balance sheet data."""
        try:
            ticker = Ticker(symbol)
            
            annual_df = ticker.balance_sheet(frequency='a')
            quarterly_df = ticker.balance_sheet(frequency='q')
            
            annual_data = []
            quarterly_data = []
            
            if isinstance(annual_df, pd.DataFrame) and not annual_df.empty:
                annual_df_reset = annual_df.reset_index()
                annual_data = annual_df_reset.to_dict('records')
            
            if isinstance(quarterly_df, pd.DataFrame) and not quarterly_df.empty:
                quarterly_df_reset = quarterly_df.reset_index()
                quarterly_data = quarterly_df_reset.to_dict('records')
            
            return {
                'symbol': symbol.upper(),
                'annual': annual_data,
                'quarterly': quarterly_data,
                'updated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ yahooquery balance_sheet error for {symbol}: {e}")
            return {
                'symbol': symbol.upper(),
                'annual': [],
                'quarterly': [],
                'updated_at': datetime.now().isoformat(),
                'error': str(e)
            }
    
    def get_cash_flow(self, symbol: str) -> Dict:
        """Get cash flow statement data."""
        try:
            ticker = Ticker(symbol)
            
            annual_df = ticker.cash_flow(frequency='a')
            quarterly_df = ticker.cash_flow(frequency='q')
            
            annual_data = []
            quarterly_data = []
            
            if isinstance(annual_df, pd.DataFrame) and not annual_df.empty:
                annual_df_reset = annual_df.reset_index()
                annual_data = annual_df_reset.to_dict('records')
            
            if isinstance(quarterly_df, pd.DataFrame) and not quarterly_df.empty:
                quarterly_df_reset = quarterly_df.reset_index()
                quarterly_data = quarterly_df_reset.to_dict('records')
            
            return {
                'symbol': symbol.upper(),
                'annual': annual_data,
                'quarterly': quarterly_data,
                'updated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ yahooquery cash_flow error for {symbol}: {e}")
            return {
                'symbol': symbol.upper(),
                'annual': [],
                'quarterly': [],
                'updated_at': datetime.now().isoformat(),
                'error': str(e)
            }

# Create singleton instance
yahooquery_service = YahooQueryService()
