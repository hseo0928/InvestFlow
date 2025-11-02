"""Stock-related API routes."""
from flask import Blueprint, jsonify, request
from services.stock_service import get_quote, get_history
from services.kis_service import kis_service
from services.fundamentals_service import get_income_statement, get_balance_sheet

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


@stock_bp.route('/fundamentals/<symbol>/income', methods=['GET'])
def get_income(symbol):
    """Get income statement (annual + quarterly) for a stock."""
    try:
        data = get_income_statement(symbol)
        return jsonify(data)
    except Exception as e:
        print(f"Error fetching income for {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@stock_bp.route('/fundamentals/<symbol>/balance', methods=['GET'])
def get_balance(symbol):
    """Get balance sheet (annual + quarterly) for a stock."""
    try:
        data = get_balance_sheet(symbol)
        return jsonify(data)
    except Exception as e:
        print(f"Error fetching balance for {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

