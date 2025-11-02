import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVolume(volume: number | string): string {
  // 숫자로 변환하고 유효성 검사
  const numVolume = typeof volume === 'string' ? parseFloat(volume) : volume;
  
  // NaN이거나 유효하지 않은 숫자면 0으로 처리
  if (isNaN(numVolume) || !isFinite(numVolume) || numVolume < 0) {
    return '0';
  }
  
  if (numVolume >= 1000000) {
    return `${(numVolume / 1000000).toFixed(1)}M`;
  } else if (numVolume >= 1000) {
    return `${(numVolume / 1000).toFixed(1)}K`;
  } else {
    return Math.round(numVolume).toString();
  }
}

export function formatRSI(value: number | string): string {
  // 숫자로 변환하고 유효성 검사
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // NaN이거나 유효하지 않은 숫자면 '--'로 처리
  if (isNaN(numValue) || !isFinite(numValue) || numValue === null || numValue === undefined) {
    return '--';
  }
  
  // RSI 범위 유효성 검사 (0-100)
  if (numValue < 0 || numValue > 100) {
    return '--';
  }
  
  // 소수점 첫째자리까지 표시
  return numValue.toFixed(1);
}
