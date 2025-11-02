"""Make routes package importable."""
from .stock_routes import stock_bp
from .news_routes import news_bp

__all__ = ['stock_bp', 'news_bp']
