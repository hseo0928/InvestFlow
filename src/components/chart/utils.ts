/**
 * Utility functions for chart data transformation
 */

import { ChartDataPoint } from '../../types';
import { ChartData } from './types';

export function formatChartData(data: ChartDataPoint[], period: string): ChartData[] {
  return data.map(point => ({
    date: point.date || new Date(point.timestamp).toISOString().split('T')[0],
    timestamp: point.timestamp,
    value: point.close, // backward compatibility
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume,
  }));
}

export function generateMockStockData(symbol: string): ChartData[] {
  const data: ChartData[] = [];
  const basePrice = 150;
  const days = 90;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    const randomChange = (Math.random() - 0.5) * 10;
    const open = i === 0 ? basePrice : data[i - 1].close;
    const close = open + randomChange;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    const volume = Math.floor(Math.random() * 10000000) + 5000000;
    
    data.push({
      date: date.toISOString().split('T')[0],
      timestamp: date.getTime(),
      value: close,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  
  return data;
}

export function generateMockPortfolioData(): ChartData[] {
  const data: ChartData[] = [];
  const baseValue = 10000;
  const days = 90;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    const growth = 1 + (Math.random() * 0.02 - 0.005);
    const value = i === 0 ? baseValue : data[i - 1].value * growth;
    
    data.push({
      date: date.toISOString().split('T')[0],
      timestamp: date.getTime(),
      value,
      open: value * 0.99,
      high: value * 1.01,
      low: value * 0.98,
      close: value,
      volume: 0,
    });
  }
  
  return data;
}
