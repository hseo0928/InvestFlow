"""
PostgreSQL Database Service using SQLAlchemy
Replaces Supabase with Railway PostgreSQL
"""
import os
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from datetime import datetime
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

class NewsArticle(Base):
    """News articles table"""
    __tablename__ = 'news_articles'
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    summary = Column(Text)
    url = Column(String, nullable=False)
    source = Column(String)
    published_at = Column(DateTime)
    symbols = Column(JSON)  # List of stock symbols
    sentiment = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class StockFundamentals(Base):
    """Stock fundamentals cache table"""
    __tablename__ = 'stock_fundamentals'
    
    symbol = Column(String, primary_key=True)
    market_cap = Column(Float)
    pe_ratio = Column(Float)
    eps = Column(Float)
    dividend_yield = Column(Float)
    beta = Column(Float)
    fifty_two_week_high = Column(Float)
    fifty_two_week_low = Column(Float)
    data = Column(JSON)  # Full fundamentals data
    updated_at = Column(DateTime, default=datetime.utcnow)

class AIAnalysis(Base):
    """AI analysis cache table"""
    __tablename__ = 'ai_analysis'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String, nullable=False)
    analysis = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class StockQuote(Base):
    """Stock quote cache table"""
    __tablename__ = 'stock_quotes'
    
    symbol = Column(String, primary_key=True)
    price = Column(Float)
    change = Column(Float)
    change_percent = Column(Float)
    volume = Column(Float)
    market_cap = Column(Float)
    open_price = Column(Float)
    high = Column(Float)
    low = Column(Float)
    previous_close = Column(Float)
    data = Column(JSON)  # Full quote data
    updated_at = Column(DateTime, default=datetime.utcnow)

class StockHistory(Base):
    """Stock price history table"""
    __tablename__ = 'stock_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String, nullable=False)
    date = Column(DateTime, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class DatabaseService:
    """PostgreSQL database service"""
    _engine = None
    _session_factory = None
    
    @classmethod
    def get_engine(cls):
        """Get or create database engine"""
        if cls._engine is None:
            database_url = os.getenv('DATABASE_URL')
            if not database_url:
                raise Exception('DATABASE_URL environment variable not set')
            
            # Railway provides postgres:// but SQLAlchemy needs postgresql://
            if database_url.startswith('postgres://'):
                database_url = database_url.replace('postgres://', 'postgresql://', 1)
            
            cls._engine = create_engine(
                database_url,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,
                echo=False
            )
            
            # Create tables if they don't exist
            try:
                Base.metadata.create_all(cls._engine, checkfirst=True)
                logger.info("Database tables created/verified")
            except Exception as e:
                logger.warning(f"Table creation skipped (may already exist): {e}")
        
        return cls._engine
    
    @classmethod
    def get_session(cls):
        """Get database session"""
        if cls._session_factory is None:
            engine = cls.get_engine()
            cls._session_factory = scoped_session(sessionmaker(bind=engine))
        
        return cls._session_factory()
    
    @classmethod
    def save_news(cls, news_items: List[Dict[str, Any]]) -> int:
        """Save news articles to database"""
        session = cls.get_session()
        saved_count = 0
        
        try:
            for item in news_items:
                news = NewsArticle(
                    id=item.get('id', item['url']),
                    title=item['title'],
                    summary=item.get('summary', ''),
                    url=item['url'],
                    source=item.get('source', ''),
                    published_at=item.get('publishedAt'),
                    symbols=item.get('symbols', []),
                    sentiment=item.get('sentiment')
                )
                session.merge(news)  # Insert or update
                saved_count += 1
            
            session.commit()
            logger.info(f"Saved {saved_count} news articles")
            return saved_count
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving news: {e}")
            raise
        finally:
            session.close()
    
    @classmethod
    def get_news(cls, symbol: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get news articles from database"""
        session = cls.get_session()
        
        try:
            query = session.query(NewsArticle)
            
            if symbol:
                query = query.filter(NewsArticle.symbols.contains([symbol]))
            
            query = query.order_by(NewsArticle.published_at.desc()).limit(limit)
            
            articles = query.all()
            
            return [{
                'id': a.id,
                'title': a.title,
                'summary': a.summary,
                'url': a.url,
                'source': a.source,
                'publishedAt': a.published_at.isoformat() if a.published_at else None,
                'symbols': a.symbols,
                'sentiment': a.sentiment
            } for a in articles]
            
        except Exception as e:
            logger.error(f"Error getting news: {e}")
            return []
        finally:
            session.close()
    
    @classmethod
    def save_fundamentals(cls, symbol: str, fundamentals: Dict[str, Any]) -> bool:
        """Save stock fundamentals to database"""
        session = cls.get_session()
        
        try:
            fund = StockFundamentals(
                symbol=symbol,
                market_cap=fundamentals.get('marketCap'),
                pe_ratio=fundamentals.get('peRatio'),
                eps=fundamentals.get('eps'),
                dividend_yield=fundamentals.get('dividendYield'),
                beta=fundamentals.get('beta'),
                fifty_two_week_high=fundamentals.get('fiftyTwoWeekHigh'),
                fifty_two_week_low=fundamentals.get('fiftyTwoWeekLow'),
                data=fundamentals,
                updated_at=datetime.utcnow()
            )
            session.merge(fund)
            session.commit()
            logger.info(f"Saved fundamentals for {symbol}")
            return True
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving fundamentals: {e}")
            return False
        finally:
            session.close()
    
    @classmethod
    def get_fundamentals(cls, symbol: str) -> Optional[Dict[str, Any]]:
        """Get stock fundamentals from database"""
        session = cls.get_session()
        
        try:
            fund = session.query(StockFundamentals).filter_by(symbol=symbol).first()
            
            if fund:
                return fund.data
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting fundamentals: {e}")
            return None
        finally:
            session.close()
    
    @classmethod
    def save_ai_analysis(cls, symbol: str, analysis: Dict[str, Any]) -> bool:
        """Save AI analysis to database"""
        session = cls.get_session()
        
        try:
            ai = AIAnalysis(
                symbol=symbol,
                analysis=analysis,
                created_at=datetime.utcnow()
            )
            session.add(ai)
            session.commit()
            logger.info(f"Saved AI analysis for {symbol}")
            return True
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving AI analysis: {e}")
            return False
        finally:
            session.close()
    
    @classmethod
    def save_quote(cls, symbol: str, quote: Dict[str, Any]) -> bool:
        """Save stock quote to database"""
        session = cls.get_session()
        
        try:
            stock_quote = StockQuote(
                symbol=symbol,
                price=quote.get('price'),
                change=quote.get('change'),
                change_percent=quote.get('changePercent'),
                volume=quote.get('volume'),
                market_cap=quote.get('marketCap'),
                open_price=quote.get('open'),
                high=quote.get('high'),
                low=quote.get('low'),
                previous_close=quote.get('previousClose'),
                data=quote,
                updated_at=datetime.utcnow()
            )
            session.merge(stock_quote)
            session.commit()
            logger.info(f"Saved quote for {symbol}")
            return True
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving quote: {e}")
            return False
        finally:
            session.close()
    
    @classmethod
    def get_quote(cls, symbol: str, max_age_minutes: int = 5) -> Optional[Dict[str, Any]]:
        """Get stock quote from database if not expired"""
        from datetime import timedelta
        session = cls.get_session()
        
        try:
            quote = session.query(StockQuote).filter_by(symbol=symbol).first()
            
            if quote:
                age = datetime.utcnow() - quote.updated_at
                if age < timedelta(minutes=max_age_minutes):
                    logger.info(f"Cache hit for {symbol} quote (age: {age.seconds}s)")
                    return quote.data
                else:
                    logger.info(f"Cache expired for {symbol} quote (age: {age.seconds}s)")
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting quote: {e}")
            return None
        finally:
            session.close()
    
    @classmethod
    def save_history(cls, symbol: str, history: List[Dict[str, Any]]) -> int:
        """Save stock price history to database"""
        session = cls.get_session()
        saved_count = 0
        
        try:
            for item in history:
                hist = StockHistory(
                    symbol=symbol,
                    date=item.get('date'),
                    open=item.get('open'),
                    high=item.get('high'),
                    low=item.get('low'),
                    close=item.get('close'),
                    volume=item.get('volume'),
                    created_at=datetime.utcnow()
                )
                session.add(hist)
                saved_count += 1
            
            session.commit()
            logger.info(f"Saved {saved_count} history records for {symbol}")
            return saved_count
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving history: {e}")
            return 0
        finally:
            session.close()
    
    @classmethod
    def get_history(cls, symbol: str, days: int = 365) -> List[Dict[str, Any]]:
        """Get stock price history from database"""
        from datetime import timedelta
        session = cls.get_session()
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            history = session.query(StockHistory).filter(
                StockHistory.symbol == symbol,
                StockHistory.date >= cutoff_date
            ).order_by(StockHistory.date.desc()).all()
            
            return [{
                'date': h.date.isoformat() if h.date else None,
                'open': h.open,
                'high': h.high,
                'low': h.low,
                'close': h.close,
                'volume': h.volume
            } for h in history]
            
        except Exception as e:
            logger.error(f"Error getting history: {e}")
            return []
        finally:
            session.close()

# Initialize database on import
try:
    DatabaseService.get_engine()
except Exception as e:
    logger.warning(f"Database not initialized: {e}")
