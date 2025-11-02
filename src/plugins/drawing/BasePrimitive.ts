import { IPrimitivePaneRendererLike, ISeriesPrimitiveLike, StyleOptions } from './types';

// 데모 목적의 수평선 프리미티브 (정적 픽셀 Y 좌표 사용)
export class BaseHorizontalLinePrimitive implements ISeriesPrimitiveLike {
  private price: number;
  private style: Required<StyleOptions> = { color: '#64748b', width: 1, opacity: 0.6 };
  private computeY: (() => number | undefined) | undefined;
  private pixelY: number | undefined;

  constructor(price: number, style?: StyleOptions) {
    this.price = price;
    if (style) this.style = { ...this.style, ...style } as Required<StyleOptions>;
  }

  // 차트 시리즈에서 가격→좌표 변환함수를 주입받아 필요 시 픽셀 Y 계산
  setPriceToCoordinate(getY: () => number | undefined) {
    this.computeY = getY;
  }

  // 필요 시 외부에서 픽셀 Y를 고정값으로 지정 (줌/팬에 반응하지 않는 정적 라인)
  setPixelY(y: number) {
    this.pixelY = y;
  }

  setStyle(style: StyleOptions) {
    this.style = { ...this.style, ...style } as Required<StyleOptions>;
  }

  renderer(): IPrimitivePaneRendererLike {
    return {
      draw: (target: any) => {
        // 좌표 공간: 비트맵 좌표계를 사용하여 한 픽셀 정밀도로 선을 그림
        const y = this.pixelY ?? (this.computeY ? this.computeY() : undefined);
        if (y == null) return;

        target.useBitmapCoordinateSpace((scope: any) => {
          const ctx: CanvasRenderingContext2D = scope.context;
          const { width } = scope.bitmapSize;

          const alpha = Math.max(0, Math.min(1, this.style.opacity));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = this.style.color;
          ctx.lineWidth = this.style.width;
          ctx.beginPath();
          ctx.moveTo(0, Math.round(y));
          ctx.lineTo(width, Math.round(y));
          ctx.stroke();
          ctx.restore();
        });
      }
    };
  }
}

