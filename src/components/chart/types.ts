/**
 * Chart type definitions for lightweight-charts integration
 */

export interface ChartData {
  date: string;
  timestamp: number;
  value: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceLine {
  id: string;
  price: number;
  line: any;
  color?: string;
  source?: 'user' | 'ai';
  title?: string;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  layout?: {
    background?: { color: string };
    textColor?: string;
  };
  grid?: {
    vertLines?: { color: string };
    horzLines?: { color: string };
  };
  crosshair?: {
    mode?: number;
  };
  rightPriceScale?: {
    borderColor?: string;
  };
  timeScale?: {
    borderColor?: string;
    timeVisible?: boolean;
    secondsVisible?: boolean;
  };
}

export interface RSIData {
  time: number;
  value: number;
}

export type DrawMode = 'none' | 'create' | 'erase' | 'select';
