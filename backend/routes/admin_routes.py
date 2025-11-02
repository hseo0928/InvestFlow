"""
Temporary admin route for importing SQL data
⚠️ REMOVE THIS FILE AFTER IMPORT
"""
from flask import Blueprint, request, jsonify
from services.database import DatabaseService
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/import_sql', methods=['POST'])
def import_sql():
    """Execute SQL import - DANGEROUS, REMOVE AFTER USE"""
    try:
        # Get SQL from request body
        sql = request.get_data(as_text=True)
        
        if not sql or len(sql) < 100:
            return jsonify({"error": "No SQL provided"}), 400
        
        logger.info(f"Importing SQL ({len(sql)} bytes)")
        
        # Execute SQL
        engine = DatabaseService.get_engine()
        with engine.begin() as conn:
            conn.execute(text(sql))
        
        # Verify count
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM news_articles"))
            count = result.fetchone()[0]
        
        logger.info(f"Import successful: {count} rows")
        return jsonify({"success": True, "rows": count})
        
    except Exception as e:
        logger.error(f"Import failed: {e}")
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/verify', methods=['GET'])
def verify_import():
    """Check database counts"""
    try:
        engine = DatabaseService.get_engine()
        with engine.connect() as conn:
            news_count = conn.execute(text("SELECT COUNT(*) FROM news_articles")).fetchone()[0]
            fund_count = conn.execute(text("SELECT COUNT(*) FROM stock_fundamentals")).fetchone()[0]
            quote_count = conn.execute(text("SELECT COUNT(*) FROM stock_quotes")).fetchone()[0]
        
        return jsonify({
            "news_articles": news_count,
            "stock_fundamentals": fund_count,
            "stock_quotes": quote_count
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
