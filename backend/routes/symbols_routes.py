"""
API routes for stock symbol search and validation.
"""

from flask import Blueprint, jsonify, request
from services.symbol_service import symbol_service

# Create Blueprint
symbols_bp = Blueprint('symbols', __name__, url_prefix='/api')


@symbols_bp.route('/symbols/search', methods=['GET'])
def search_symbols():
    """
    Search for stock symbols using fuzzy matching.
    
    Query Parameters:
        q: Search query (symbol or company name)
        limit: Maximum results (default: 10)
    
    Returns:
        JSON list of matching symbols
    """
    query = request.args.get('q', '')
    limit = int(request.args.get('limit', 10))
    
    try:
        results = symbol_service.search(query, limit=limit)
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@symbols_bp.route('/symbols/validate/<symbol>', methods=['GET'])
def validate_symbol(symbol):
    """
    Validate if a stock symbol exists.
    
    Args:
        symbol: Stock ticker symbol
    
    Returns:
        JSON with validation result
    """
    try:
        is_valid = symbol_service.validate(symbol)
        symbol_info = symbol_service.get_symbol_info(symbol) if is_valid else None
        
        return jsonify({
            'valid': is_valid,
            'symbol': symbol_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@symbols_bp.route('/symbols/<symbol>', methods=['GET'])
def get_symbol_info(symbol):
    """
    Get detailed information for a symbol.
    
    Args:
        symbol: Stock ticker symbol
    
    Returns:
        JSON with symbol metadata
    """
    try:
        info = symbol_service.get_symbol_info(symbol)
        
        if info:
            return jsonify(info)
        else:
            return jsonify({'error': 'Symbol not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
