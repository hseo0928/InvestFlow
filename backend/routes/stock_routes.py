"""Stock-related API routes."""
from flask import Blueprint, jsonify, request
from services.stock_service import get_quote, get_history
from services.kis_service import kis_service
from services.fundamentals_service import get_income_statement, get_balance_sheet, calculate_ratios, calculate_dcf

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


@stock_bp.route('/fundamentals/<symbol>/ratios', methods=['GET'])
def get_ratios(symbol):
    """Get financial ratios (profitability, health, valuation) for a stock."""
    try:
        data = calculate_ratios(symbol)
        return jsonify(data)
    except Exception as e:
        print(f"Error calculating ratios for {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@stock_bp.route('/fundamentals/<symbol>/dcf', methods=['GET'])
def get_dcf(symbol):
    """Get DCF (Discounted Cash Flow) valuation for a stock.
    
    Query parameters:
        growth_rate: Expected FCF growth rate (default: 0.05 = 5%)
        discount_rate: WACC / discount rate (default: 0.10 = 10%)
        years: Projection period (default: 5)
    """
    try:
        # Get user-adjustable parameters
        growth_rate = float(request.args.get('growth_rate', 0.05))
        discount_rate = float(request.args.get('discount_rate', 0.10))
        years = int(request.args.get('years', 5))
        
        # Validate parameters
        if not (0 < growth_rate < 1):
            return jsonify({'error': 'growth_rate must be between 0 and 1'}), 400
        if not (0 < discount_rate < 1):
            return jsonify({'error': 'discount_rate must be between 0 and 1'}), 400
        if not (1 <= years <= 20):
            return jsonify({'error': 'years must be between 1 and 20'}), 400
        if discount_rate <= growth_rate:
            return jsonify({'error': 'discount_rate must be greater than growth_rate'}), 400
        
        data = calculate_dcf(symbol, growth_rate, discount_rate, years)
        return jsonify(data)
    except Exception as e:
        print(f"Error calculating DCF for {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@stock_bp.route('/analysis/<symbol>', methods=['GET'])
def get_stock_analysis(symbol):
    """Get AI-powered stock analysis."""
    try:
        # Gather data for AI
        from services.stock_service import get_quote
        from services.fundamentals_service import calculate_ratios
        from services.news_service import news_service
        from services.ai_service import ai_service
        
        # 1. Get Price
        try:
            quote = get_quote(symbol)
        except:
            quote = {}
            
        # 2. Get Fundamentals
        try:
            fundamentals = calculate_ratios(symbol)
        except:
            fundamentals = {}
            
        # 3. Get News
        news, _ = news_service.get_cached_news()
        if not news:
            news = []
            
        # 4. Generate Analysis
        analysis = ai_service.generate_stock_analysis(symbol, fundamentals, news, quote)
        
        return jsonify(analysis)
        
    except Exception as e:
        print(f"Error generating analysis for {symbol}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



