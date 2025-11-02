/**
 * Number formatting utilities
 */

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatNumber(num: number | string, decimals: number = 1): string {
  const numValue = typeof num === 'string' ? parseFloat(num) : num;
  
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '0';
  }
  
  const absNum = Math.abs(numValue);
  const sign = numValue < 0 ? '-' : '';
  
  if (absNum >= 1e9) {
    return `${sign}${(absNum / 1e9).toFixed(decimals)}B`;
  } else if (absNum >= 1e6) {
    return `${sign}${(absNum / 1e6).toFixed(decimals)}M`;
  } else if (absNum >= 1e3) {
    return `${sign}${(absNum / 1e3).toFixed(decimals)}K`;
  }
  
  return `${sign}${absNum.toFixed(decimals)}`;
}

/**
 * Format volume numbers
 */
export function formatVolume(volume: number | string): string {
  const numVolume = typeof volume === 'string' ? parseFloat(volume) : volume;
  
  if (isNaN(numVolume) || !isFinite(numVolume) || numVolume < 0) {
    return '0';
  }
  
  if (numVolume >= 1000000) {
    return `${(numVolume / 1000000).toFixed(1)}M`;
  } else if (numVolume >= 1000) {
    return `${(numVolume / 1000).toFixed(1)}K`;
  }
  
  return Math.round(numVolume).toString();
}

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number | string, currency: string = '$', decimals: number = 2): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numPrice) || !isFinite(numPrice)) {
    return `${currency}0.00`;
  }
  
  return `${currency}${numPrice.toFixed(decimals)}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number | string, decimals: number = 2, includeSign: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '0.00%';
  }
  
  const sign = includeSign && numValue > 0 ? '+' : '';
  return `${sign}${numValue.toFixed(decimals)}%`;
}

/**
 * Format RSI value (0-100 range)
 */
export function formatRSI(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '--';
  }
  
  if (numValue < 0 || numValue > 100) {
    return '--';
  }
  
  return numValue.toFixed(1);
}

/**
 * Format market cap
 */
export function formatMarketCap(marketCap: number | string): string {
  const numValue = typeof marketCap === 'string' ? parseFloat(marketCap) : marketCap;
  
  if (isNaN(numValue) || !isFinite(numValue) || numValue <= 0) {
    return 'N/A';
  }
  
  return formatNumber(numValue, 2);
}
