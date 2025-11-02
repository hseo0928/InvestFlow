/**
 * Chart configuration constants
 */

import { ChartOptions } from './types';

export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  layout: {
    background: { color: '#ffffff' },
    textColor: '#333',
  },
  grid: {
    vertLines: { color: '#f0f0f0' },
    horzLines: { color: '#f0f0f0' },
  },
  crosshair: {
    mode: 1,
  },
  rightPriceScale: {
    borderColor: '#e0e0e0',
  },
  timeScale: {
    borderColor: '#e0e0e0',
    timeVisible: true,
    secondsVisible: false,
  },
};

export const RSI_CHART_OPTIONS: ChartOptions = {
  height: 150,
  layout: {
    background: { color: '#ffffff' },
    textColor: '#333',
  },
  grid: {
    vertLines: { color: '#f0f0f0' },
    horzLines: { color: '#f0f0f0' },
  },
  rightPriceScale: {
    borderColor: '#e0e0e0',
  },
  timeScale: {
    borderColor: '#e0e0e0',
    timeVisible: false,
  },
};

export const CANDLESTICK_COLORS = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  borderUpColor: '#22c55e',
  borderDownColor: '#ef4444',
  wickUpColor: '#22c55e',
  wickDownColor: '#ef4444',
};

export const VOLUME_COLORS = {
  upColor: 'rgba(34, 197, 94, 0.5)',
  downColor: 'rgba(239, 68, 68, 0.5)',
};

export const RSI_COLORS = {
  lineColor: '#3b82f6',
  signalColor: '#8b5cf6',
  overboughtColor: 'rgba(239, 68, 68, 0.1)',
  oversoldColor: 'rgba(34, 197, 94, 0.1)',
  level30Color: '#22c55e',
  level70Color: '#ef4444',
};
