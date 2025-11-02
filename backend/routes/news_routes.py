"""News-related API routes."""
from flask import Blueprint, jsonify, request
from services.news_service import news_service
from services.supabase_service import fetch_news
from config.env import config

news_bp = Blueprint('news', __name__, url_prefix='/api')


@news_bp.route('/news', methods=['GET'])
def get_all_news():
    """Get all news from Supabase."""
    try:
        if not config.SUPABASE_URL or not config.SUPABASE_ANON_KEY:
            return jsonify({
                'success': False,
                'error': 'Supabase configuration missing: set SUPABASE_URL and SUPABASE_ANON_KEY'
            }), 500

        limit = request.args.get('limit', '100')
        items = fetch_news(limit=int(limit))
        
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
    """Get latest news with incremental updates from Supabase."""
    try:
        if not config.SUPABASE_URL or not config.SUPABASE_ANON_KEY:
            return jsonify({
                'success': False,
                'error': 'Supabase configuration missing: set SUPABASE_URL and SUPABASE_ANON_KEY'
            }), 500

        limit = request.args.get('limit', '100')
        last_update = request.args.get('last_update')

        # Base list for total count
        base_items = fetch_news(limit=int(limit))

        # Apply incremental filter if provided
        if last_update:
            newer_items = fetch_news(limit=int(limit), last_update_iso=last_update)
            return jsonify({
                'success': True,
                'data': newer_items,
                'new_count': len(newer_items),
                'total_count': len(base_items)
            })

        # Return all if no last_update
        return jsonify({
            'success': True,
            'data': base_items,
            'count': len(base_items)
        })
    except Exception as e:
        print(f"최신 뉴스 조회 API 에러: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@news_bp.route('/financialjuice/latest', methods=['GET'])
def get_financial_juice_latest():
    """Get latest Financial Juice news from Supabase."""
    try:
        if not config.SUPABASE_URL or not config.SUPABASE_ANON_KEY:
            return jsonify({
                'error': 'Supabase configuration missing: set SUPABASE_URL and SUPABASE_ANON_KEY'
            }), 500

        limit = request.args.get('limit', '50')
        items = fetch_news(limit=int(limit))
        
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
