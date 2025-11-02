"""News-related API routes."""
from flask import Blueprint, jsonify, request
from services.news_service import news_service
from services.database import DatabaseService
from config.env import config

news_bp = Blueprint('news', __name__, url_prefix='/api')


@news_bp.route('/news', methods=['GET'])
def get_all_news():
    """Get all news from database."""
    try:
        limit = request.args.get('limit', '100')
        items = DatabaseService.get_news(limit=int(limit))
        
        return jsonify({
            'success': True,
            'data': items,
            'cached': False,
            'count': len(items)
        })
    except Exception as e:
        print(f"뉴스 조회 API 에러: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@news_bp.route('/news/latest', methods=['GET'])
def get_latest_news():
    """Get latest news with incremental updates from database."""
    try:
        limit = request.args.get('limit', '100')
        items = DatabaseService.get_news(limit=int(limit))

        return jsonify({
            'success': True,
            'data': items,
            'count': len(items)
        })
    except Exception as e:
        print(f"최신 뉴스 조회 API 에러: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@news_bp.route('/financialjuice/latest', methods=['GET'])
def get_financial_juice_latest():
    """Get latest Financial Juice news from database."""
    try:
        limit = request.args.get('limit', '50')
        items = DatabaseService.get_news(limit=int(limit))
        
        import time
        return jsonify({
            'items': items,
            'cached': False,
            'fetched_at': int(time.time())
        })
    except Exception as e:
        print(f"Error fetching FinancialJuice: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
