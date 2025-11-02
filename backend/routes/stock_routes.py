"""Stock-related API routes."""
from flask import Blueprint, jsonify, request
from services.stock_service import get_quote, get_history, search_stocks
from services.kis_service import kis_service

stock_bp = Blueprint('stock', __name__, url_prefix='/api')


@stock_bp.route('/quote/<symbol>', methods=['GET'])
def get_stock_quote(symbol):
    """Get stock quote using yfinance."""
    try:
        result = get_quote(symbol)
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@stock_bp.route('/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """Get historical stock data using yfinance."""
    try:
        period = request.args.get('period', '1mo')
        interval = request.args.get('interval', '1d')
        
        data = get_history(symbol, period, interval)
        return jsonify(data)
    except Exception as e:
        print(f"Error fetching history for {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@stock_bp.route('/search', methods=['GET'])
def search():
    """Search for stocks."""
    try:
        query = request.args.get('q', '').upper()
        results = search_stocks(query)
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stock_bp.route('/kis/quote/<symbol>', methods=['GET'])
def get_kis_stock_quote(symbol):
    """Get stock quote using KIS API."""
    try:
        result = kis_service.get_quote(symbol)
        return jsonify(result)
    except Exception as e:
        error_message = str(e)
        
        if 'not configured' in error_message:
            return jsonify({
                'error': 'KIS API credentials not configured',
                'symbol': symbol,
                'fallback_available': True
            }), 400
        
        print(f"Error fetching KIS quote for {symbol}: {error_message}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': error_message}), 500


@stock_bp.route('/kis/history/<symbol>', methods=['GET'])
def get_kis_stock_history(symbol):
    """Get historical stock data using KIS API."""
    try:
        period = request.args.get('period', 'D')
        count = int(request.args.get('count', 30))
        
        result = kis_service.get_history(symbol, period, count)
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching KIS history for {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
