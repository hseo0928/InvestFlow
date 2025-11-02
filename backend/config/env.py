"""
Configuration management and validation
"""
import os
from typing import Optional
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

@dataclass
class Config:
    """Application configuration"""
    
    # Flask Settings
    FLASK_ENV: str
    FLASK_DEBUG: bool
    FLASK_PORT: int
    
    # Supabase Configuration
    SUPABASE_URL: Optional[str]
    SUPABASE_ANON_KEY: Optional[str]
    
    # KIS API Configuration
    KIS_APP_KEY: Optional[str]
    KIS_APP_SECRET: Optional[str]
    
    # DeepL Translation API
    DEEPL_API_KEY: Optional[str]
    
    # News Scheduler Settings
    NEWS_SCHEDULER_ENABLED: bool
    NEWS_SCHEDULER_INTERVAL_SEC: int
    
    # Financial Juice RSS Settings
    FINANCIAL_JUICE_MIN_INTERVAL_SEC: int
    FINANCIAL_JUICE_JITTER_SEC: int
    FINANCIAL_JUICE_MAX_BACKOFF_SEC: int
    
    # Cache Settings
    NEWS_CACHE_DURATION: int
    MAX_NEWS_CACHE_SIZE: int
    NEWS_MAX_AGE_HOURS: int
    
    @staticmethod
    def from_env() -> 'Config':
        """Create configuration from environment variables"""
        return Config(
            # Flask Settings
            FLASK_ENV=os.getenv('FLASK_ENV', 'development'),
            FLASK_DEBUG=os.getenv('FLASK_DEBUG', 'true').lower() == 'true',
            FLASK_PORT=int(os.getenv('FLASK_PORT', '5002')),
            
            # Supabase Configuration
            SUPABASE_URL=os.getenv('SUPABASE_URL'),
            SUPABASE_ANON_KEY=os.getenv('SUPABASE_ANON_KEY'),
            
            # KIS API Configuration
            KIS_APP_KEY=os.getenv('KIS_APP_KEY'),
            KIS_APP_SECRET=os.getenv('KIS_APP_SECRET'),
            
            # DeepL Translation API
            DEEPL_API_KEY=os.getenv('DEEPL_API_KEY'),
            
            # News Scheduler Settings
            NEWS_SCHEDULER_ENABLED=os.getenv('NEWS_SCHEDULER_ENABLED', 'false').lower() == 'true',
            NEWS_SCHEDULER_INTERVAL_SEC=int(os.getenv('NEWS_SCHEDULER_INTERVAL_SEC', '120')),
            
            # Financial Juice RSS Settings
            FINANCIAL_JUICE_MIN_INTERVAL_SEC=int(os.getenv('FINANCIAL_JUICE_MIN_INTERVAL_SEC', '180')),
            FINANCIAL_JUICE_JITTER_SEC=int(os.getenv('FINANCIAL_JUICE_JITTER_SEC', '15')),
            FINANCIAL_JUICE_MAX_BACKOFF_SEC=int(os.getenv('FINANCIAL_JUICE_MAX_BACKOFF_SEC', '900')),
            
            # Cache Settings
            NEWS_CACHE_DURATION=int(os.getenv('NEWS_CACHE_DURATION', '30')),
            MAX_NEWS_CACHE_SIZE=int(os.getenv('MAX_NEWS_CACHE_SIZE', '100')),
            NEWS_MAX_AGE_HOURS=int(os.getenv('NEWS_MAX_AGE_HOURS', '24')),
        )
    
    def validate(self) -> list[str]:
        """Validate configuration and return list of warnings"""
        warnings = []
        
        # Check critical settings
        if not self.SUPABASE_URL:
            warnings.append('SUPABASE_URL not set - news features will not work')
        
        if not self.SUPABASE_ANON_KEY:
            warnings.append('SUPABASE_ANON_KEY not set - news features will not work')
        
        if not self.KIS_APP_KEY or not self.KIS_APP_SECRET:
            warnings.append('KIS API credentials not set - Korean stock features will be limited')
        
        # Validate ranges
        if self.FLASK_PORT < 1024 or self.FLASK_PORT > 65535:
            warnings.append(f'FLASK_PORT {self.FLASK_PORT} is outside valid range (1024-65535)')
        
        if self.NEWS_SCHEDULER_INTERVAL_SEC < 60:
            warnings.append('NEWS_SCHEDULER_INTERVAL_SEC should be at least 60 seconds')
        
        if self.FINANCIAL_JUICE_MIN_INTERVAL_SEC < 60:
            warnings.append('FINANCIAL_JUICE_MIN_INTERVAL_SEC should be at least 60 seconds')
        
        return warnings
    
    def log_configuration(self):
        """Log current configuration (without secrets)"""
        print("\n" + "="*50)
        print("Configuration Loaded")
        print("="*50)
        print(f"Environment: {self.FLASK_ENV}")
        print(f"Debug Mode: {self.FLASK_DEBUG}")
        print(f"Port: {self.FLASK_PORT}")
        print(f"Supabase: {'✓' if self.SUPABASE_URL else '✗'}")
        print(f"KIS API: {'✓' if self.KIS_APP_KEY else '✗'}")
        print(f"News Scheduler: {'Enabled' if self.NEWS_SCHEDULER_ENABLED else 'Disabled'}")
        print("="*50 + "\n")
        
        # Log warnings
        warnings = self.validate()
        if warnings:
            print("⚠️  Configuration Warnings:")
            for warning in warnings:
                print(f"  - {warning}")
            print()

# Global configuration instance
config = Config.from_env()
