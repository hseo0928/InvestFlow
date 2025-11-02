/**
 * 주가 데이터 캐싱 시스템
 * 2년치 데이터를 미리 받아서 localStorage에 저장하고 필요할 때 불러오기
 */

import { ChartDataPoint } from './api-config';
import { StockDataService } from './stock-service';

export interface CachedStockData {
  symbol: string;
  data: ChartDataPoint[];
  lastUpdated: number;
  dataRange: {
    from: string;
    to: string;
  };
}

export class StockCacheService {
  private static readonly CACHE_PREFIX = 'stock_cache_';
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간
  private static readonly DATA_RANGE_YEARS = 2; // 2년치 데이터

  /**
   * 캐시된 데이터 가져오기
   */
  static getCachedData(symbol: string): CachedStockData | null {
    try {
      const cacheKey = this.CACHE_PREFIX + symbol.toUpperCase();
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const data: CachedStockData = JSON.parse(cached);
      
      // 캐시 만료 확인
      if (Date.now() - data.lastUpdated > this.CACHE_EXPIRY) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  }

  /**
   * 데이터 캐시에 저장
   */
  static setCachedData(symbol: string, data: ChartDataPoint[]): void {
    try {
      const now = new Date();
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(now.getFullYear() - this.DATA_RANGE_YEARS);

      const cachedData: CachedStockData = {
        symbol: symbol.toUpperCase(),
        data: data,
        lastUpdated: Date.now(),
        dataRange: {
          from: twoYearsAgo.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
        }
      };

      const cacheKey = this.CACHE_PREFIX + symbol.toUpperCase();
      localStorage.setItem(cacheKey, JSON.stringify(cachedData));
      
      console.log(`✅ Cached ${data.length} data points for ${symbol}`);
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  /**
   * 봉차트 데이터로 변환 (2년치 데이터를 봉 단위로 그룹핑)
   */
  static getFilteredData(
    symbol: string, 
    timeRange: '1d' | '1w' | '1mo'
  ): ChartDataPoint[] | null {
    const cached = this.getCachedData(symbol);
    if (!cached) return null;

    // 2년치 모든 데이터를 봉 단위로 그룹핑
    return this.groupDataByTimeframe(cached.data, timeRange);
  }

  /**
   * 데이터를 봉 단위로 그룹핑
   */
  private static groupDataByTimeframe(
    data: ChartDataPoint[], 
    timeframe: '1d' | '1w' | '1mo'
  ): ChartDataPoint[] {
    if (!data || data.length === 0) return [];

    // 데이터를 시간순으로 정렬
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    switch (timeframe) {
      case '1d':
        return this.groupByDays(sortedData);
      case '1w':
        return this.groupByWeeks(sortedData);
      case '1mo':
        return this.groupByMonths(sortedData);
      default:
        return this.groupByDays(sortedData);
    }
  }

  // 1시간/3시간 봉은 더 이상 지원하지 않음

  /**
   * 일 단위로 그룹핑
   */
  private static groupByDays(data: ChartDataPoint[]): ChartDataPoint[] {
    const grouped: { [key: string]: ChartDataPoint[] } = {};

    data.forEach(point => {
      const date = new Date(point.timestamp);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(point);
    });

    return this.createCandlesticks(grouped);
  }

  /**
   * 주 단위로 그룹핑
   */
  private static groupByWeeks(data: ChartDataPoint[]): ChartDataPoint[] {
    const grouped: { [key: string]: ChartDataPoint[] } = {};

    data.forEach(point => {
      const date = new Date(point.timestamp);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // 주의 시작 (일요일)
      const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
      
      if (!grouped[weekKey]) grouped[weekKey] = [];
      grouped[weekKey].push(point);
    });

    return this.createCandlesticks(grouped);
  }

  /**
   * 월 단위로 그룹핑
   */
  private static groupByMonths(data: ChartDataPoint[]): ChartDataPoint[] {
    const grouped: { [key: string]: ChartDataPoint[] } = {};

    data.forEach(point => {
      const date = new Date(point.timestamp);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(point);
    });

    return this.createCandlesticks(grouped);
  }

  /**
   * 그룹핑된 데이터를 캔들스틱으로 변환
   */
  private static createCandlesticks(grouped: { [key: string]: ChartDataPoint[] }): ChartDataPoint[] {
    const candlesticks: ChartDataPoint[] = [];

    Object.keys(grouped).forEach(key => {
      const group = grouped[key].sort((a, b) => a.timestamp - b.timestamp);
      if (group.length === 0) return;

      // 안전한 값 추출 (undefined 체크)
      const validPoints = group.filter(p => 
        p.open !== undefined && 
        p.high !== undefined && 
        p.low !== undefined && 
        p.close !== undefined && 
        p.volume !== undefined
      );

      if (validPoints.length === 0) return;

      const open = validPoints[0].open!;
      const close = validPoints[validPoints.length - 1].close!;
      const high = Math.max(...validPoints.map(p => p.high!));
      const low = Math.min(...validPoints.map(p => p.low!));
      const volume = validPoints.reduce((sum, p) => sum + (p.volume || 0), 0);
      const timestamp = validPoints[0].timestamp;

      candlesticks.push({
        date: validPoints[0].date || new Date(timestamp).toISOString().split('T')[0],
        timestamp,
        price: close, // ChartDataPoint에서 price는 필수
        open,
        high,
        low,
        close,
        volume
      });
    });

    return candlesticks.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 2년치 데이터 미리 로드
   */
  static async preloadData(symbol: string): Promise<boolean> {
    try {
      console.log(`🔄 Preloading data for ${symbol}...`);
      
      // 2년치 원시 일봉 데이터 요청
      const data = await StockDataService.getChartData(symbol, '1mo');
      
      if (data && data.length > 0) {
        this.setCachedData(symbol, data);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to preload data for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * 최신 원시 일봉 데이터를 받아 캐시에 병합(append)합니다.
   * 반환값: 실제로 새로운 포인트가 추가되었는지 여부
   */
  static async refreshCacheWithLatest(symbol: string): Promise<boolean> {
    try {
      const cached = this.getCachedData(symbol);
      const latest = await StockDataService.getChartData(symbol, '1mo');
      if (!latest || latest.length === 0) return false;

      if (!cached) {
        this.setCachedData(symbol, latest);
        return true;
      }

      const existingSet = new Set<number>(cached.data.map(d => d.timestamp));
      const toAppend = latest.filter(d => !existingSet.has(d.timestamp));

      if (toAppend.length === 0) {
        return false;
      }

      const merged = [...cached.data, ...toAppend].sort((a, b) => a.timestamp - b.timestamp);

      // 업데이트된 범위 계산
      const now = new Date();
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(now.getFullYear() - this.DATA_RANGE_YEARS);

      const updated: CachedStockData = {
        symbol: cached.symbol,
        data: merged,
        lastUpdated: Date.now(),
        dataRange: {
          from: twoYearsAgo.toISOString().split('T')[0],
          to: now.toISOString().split('T')[0],
        }
      };

      const cacheKey = this.CACHE_PREFIX + symbol.toUpperCase();
      localStorage.setItem(cacheKey, JSON.stringify(updated));
      console.log(`📈 Appended ${toAppend.length} new data points for ${symbol}`);
      return true;
    } catch (error) {
      console.warn('Cache refresh error:', error);
      return false;
    }
  }

  /**
   * 인기 종목들 데이터 일괄 미리 로드
   */
  static async preloadPopularStocks(): Promise<void> {
    const popularStocks = [
      'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 
      'META', 'NVDA', 'NFLX', 'DIS', 'BABA'
    ];

    console.log('🚀 Preloading popular stocks data...');
    
    const promises = popularStocks.map(symbol => this.preloadData(symbol));
    await Promise.allSettled(promises);
    
    console.log('✅ Popular stocks preloading completed');
  }

  /**
   * 캐시 상태 확인
   */
  static getCacheStatus(): { [symbol: string]: CachedStockData } {
    const status: { [symbol: string]: CachedStockData } = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        try {
          const symbol = key.replace(this.CACHE_PREFIX, '');
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          status[symbol] = data;
        } catch (error) {
          console.warn('Cache status error:', error);
        }
      }
    }
    
    return status;
  }

  /**
   * 캐시 정리
   */
  static clearCache(symbol?: string): void {
    if (symbol) {
      const cacheKey = this.CACHE_PREFIX + symbol.toUpperCase();
      localStorage.removeItem(cacheKey);
      console.log(`🗑️ Cleared cache for ${symbol}`);
    } else {
      // 모든 주가 캐시 삭제
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
      console.log('🗑️ Cleared all stock cache');
    }
  }
}
