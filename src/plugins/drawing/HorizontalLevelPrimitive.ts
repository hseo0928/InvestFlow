import { BaseHorizontalLinePrimitive } from './BasePrimitive';
import { IPrimitivePaneRendererLike, StyleOptions } from './types';

// 수평선(가격 레벨) 프리미티브 – 가격을 상태로 보유하고, 시리즈의 priceToCoordinate를 사용해 Y 좌표를 계산합니다.
export class HorizontalLevelPrimitive extends BaseHorizontalLinePrimitive {
  private priceRef: { price: number };
  private getYFromSeries: ((price: number) => number | undefined) | undefined;

  constructor(price: number, style?: StyleOptions) {
    super(price, style);
    this.priceRef = { price };
  }

  setConverters(converters: { priceToCoordinate?: (p: number) => number | undefined }) {
    this.getYFromSeries = converters.priceToCoordinate;
    // computeY가 priceRef를 참조하도록 주입
    this.setPriceToCoordinate(() => {
      if (!this.getYFromSeries) return undefined;
      return this.getYFromSeries(this.priceRef.price);
    });
  }

  setPrice(price: number) {
    this.priceRef.price = price;
  }

  getPrice() {
    return this.priceRef.price;
  }

  renderer(): IPrimitivePaneRendererLike {
    return super.renderer();
  }
}

