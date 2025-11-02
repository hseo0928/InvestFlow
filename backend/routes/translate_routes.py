"""Translation routes using DeepL."""
from flask import Blueprint, request, jsonify
from services.deepl_service import deepl_service


translate_bp = Blueprint('translate', __name__, url_prefix='/api/translate')


@translate_bp.route('/news', methods=['POST'])
def translate_news():
    """
    Translate news items to Korean.
    
    Request body:
    {
        "news": [
            {"title": "...", "summary": "...", ...},
            ...
        ]
    }
    
    Response:
    {
        "translated": [...translated news items...]
    }
    """
    try:
        data = request.get_json()
        news_items = data.get('news', [])
        
        if not news_items:
            return jsonify({'error': 'No news items provided'}), 400
        
        translated = deepl_service.translate_news(news_items)
        
        return jsonify({'translated': translated})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@translate_bp.route('/analysis', methods=['POST'])
def translate_analysis():
    """
    Translate AI analysis to Korean.
    
    Request body:
    {
        "analysis": {
            "summary": "...",
            "recommendation": "...",
            "keyPoints": [...],
            "riskFactors": [...],
            ...
        }
    }
    
    Response:
    {
        "translated": {...translated analysis...}
    }
    """
    try:
        data = request.get_json()
        analysis = data.get('analysis', {})
        
        if not analysis:
            return jsonify({'error': 'No analysis provided'}), 400
        
        translated = deepl_service.translate_ai_analysis(analysis)
        
        return jsonify({'translated': translated})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@translate_bp.route('/text', methods=['POST'])
def translate_text():
    """
    Translate arbitrary texts to Korean.
    
    Request body:
    {
        "texts": ["text1", "text2", ...]
    }
    
    Response:
    {
        "translated": ["번역1", "번역2", ...]
    }
    """
    try:
        data = request.get_json()
        texts = data.get('texts', [])
        
        if not texts:
            return jsonify({'error': 'No texts provided'}), 400
        
        translated = deepl_service.translate_to_korean(texts)
        
        return jsonify({'translated': translated})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
