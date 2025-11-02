/**
 * Custom hook for managing drawing tools on charts
 */

import { useState, useCallback, useRef } from 'react';

export type DrawingMode = 'select' | 'create-horizontal' | 'erase';

interface PriceLine {
  id: string;
  price: number;
  line: any;
  color?: string;
  source?: 'user' | 'ai';
  title?: string;
}

interface UseDrawingResult {
  mode: DrawingMode;
  setMode: (mode: DrawingMode) => void;
  priceLines: PriceLine[];
  addPriceLine: (line: PriceLine) => void;
  removePriceLine: (id: string) => void;
  clearAllLines: () => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}

export function useDrawing(): UseDrawingResult {
  const [mode, setMode] = useState<DrawingMode>('select');
  const [priceLines, setPriceLines] = useState<PriceLine[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const addPriceLine = useCallback((line: PriceLine) => {
    setPriceLines((prev) => [...prev, line]);
  }, []);

  const removePriceLine = useCallback((id: string) => {
    setPriceLines((prev) => {
      const line = prev.find((l) => l.id === id);
      if (line?.line) {
        // Remove the line from the chart
        try {
          line.line.remove();
        } catch (error) {
          console.warn('Failed to remove price line:', error);
        }
      }
      return prev.filter((l) => l.id !== id);
    });
  }, []);

  const clearAllLines = useCallback(() => {
    priceLines.forEach((line) => {
      try {
        line.line?.remove();
      } catch (error) {
        console.warn('Failed to remove price line:', error);
      }
    });
    setPriceLines([]);
  }, [priceLines]);

  return {
    mode,
    setMode,
    priceLines,
    addPriceLine,
    removePriceLine,
    clearAllLines,
    draggingId,
    setDraggingId,
  };
}
