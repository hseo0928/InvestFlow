/**
 * Application constants
 */

export const APP_CONSTANTS = {
  // App Information
  APP_NAME: 'AI Stock Insights',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'AI가 분석하는 실시간 주식 정보',
  
  // API Endpoints
  API_TIMEOUT: 30000, // 30 seconds
  API_RETRY_ATTEMPTS: 3,
  API_RETRY_DELAY: 1000, // 1 second
  
  // Cache Settings
  CACHE_DURATION: 60000, // 1 minute
  CHART_CACHE_DURATION: 300000, // 5 minutes
  NEWS_CACHE_DURATION: 180000, // 3 minutes
  
  // UI Settings
  DEFAULT_CHART_PERIOD: '1mo' as const,
  DEFAULT_NEWS_LIMIT: 20,
  SEARCH_DEBOUNCE_MS: 300,
  
  // Chart Settings
  CHART_HEIGHT: 500,
  RSI_CHART_HEIGHT: 150,
  RSI_OVERBOUGHT_LEVEL: 70,
  RSI_OVERSOLD_LEVEL: 30,
  
  // Popular Stocks
  POPULAR_STOCKS: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META'],
  
  // Time Periods
  TIME_PERIODS: ['1d', '1w', '1mo', '3mo', '1y', '5y'] as const,
  
  // Error Messages
  ERROR_MESSAGES: {
    NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
    API_ERROR: 'API 요청에 실패했습니다.',
    INVALID_SYMBOL: '유효하지 않은 주식 심볼입니다.',
    NO_DATA: '데이터를 불러올 수 없습니다.',
    UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
  },
} as const;

export type TimePeriod = typeof APP_CONSTANTS.TIME_PERIODS[number];
