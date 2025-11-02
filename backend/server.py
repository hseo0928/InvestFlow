"""Refactored Flask application entry point."""
from flask import Flask, jsonify
from flask_cors import CORS
from config.env import config
from routes import stock_bp, news_bp
from routes.symbols_routes import symbols_bp
from routes.translate_routes import translate_bp
from services.news_service import news_service


def create_app():
    """Create and configure Flask application."""
    app = Flask(__name__)
    
    # Configure CORS to allow GitHub Pages
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "https://hseo0928.github.io",
                "http://localhost:5173",
                "http://localhost:3000"
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # Register blueprints
    app.register_blueprint(stock_bp)
    app.register_blueprint(news_bp)
    app.register_blueprint(symbols_bp)
    app.register_blueprint(translate_bp)
    
    # TEMPORARY: Admin routes for data import (REMOVE AFTER USE)
    from routes.admin_routes import admin_bp
    app.register_blueprint(admin_bp)
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'InvestFlow API',
            'version': '1.0.0'
        })
    
    return app


def main():
    """Main entry point."""
    # Log configuration
    config.log_configuration()
    
    print("Flask 서버 시작 중...")
    
    # Start news scheduler if enabled
    if config.NEWS_SCHEDULER_ENABLED:
        if news_service.start_scheduler():
            print("뉴스 수집 스케줄러가 백그라운드에서 시작되었습니다.")
        else:
            print("뉴스 수집 스케줄러가 이미 실행 중입니다.")
    else:
        print("뉴스 수집 스케줄러 비활성화됨 (NEWS_SCHEDULER_ENABLED=false)")
    
    # Create and run app
    app = create_app()
    # Use PORT environment variable for Railway/production
    import os
    port = int(os.environ.get('PORT', config.FLASK_PORT))
    app.run(debug=config.FLASK_DEBUG, host='0.0.0.0', port=port)

if __name__ == '__main__':
    main()
else:
    # For gunicorn/production WSGI servers
    app = create_app()
    # Initialize services for production
    config.log_configuration()
    if config.NEWS_SCHEDULER_ENABLED:
        news_service.start_scheduler()
