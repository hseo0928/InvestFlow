export type TimePrice = {
  time: number; // epoch ms
  price: number;
};

export type HitRegion = 'line' | 'handle' | null;

export interface StyleOptions {
  color?: string;
  width?: number;
  opacity?: number; // 0..1
}

// Minimal interface shape to satisfy series.attachPrimitive runtime
export interface IPrimitivePaneRendererLike {
  // Lightweight Charts will call this in plugin mode
  // We keep it as any-typed to avoid dependency on internal types
  draw: (target: any, utils?: any) => void;
}

export interface ISeriesPrimitiveLike {
  renderer: () => IPrimitivePaneRendererLike;
}

