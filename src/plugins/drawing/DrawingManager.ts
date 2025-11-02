import { HorizontalLevelPrimitive } from './HorizontalLevelPrimitive';

type Mode = 'select' | 'create-horizontal' | 'erase' | 'idle';

export interface DrawingRecord {
  id: string;
  type: 'horizontal';
  primitive: HorizontalLevelPrimitive;
  price: number;
  locked?: boolean;
  visible?: boolean;
  priceLine?: any;
}

export class DrawingManager {
  private chart: any;
  private series: any;
  private container: HTMLElement;
  private key: string; // drawings:<SYMBOL>:<TF>
  private drawings: DrawingRecord[] = [];
  private mode: Mode = 'idle';
  private draggingId: string | null = null;
  private disposed = false;

  constructor(chart: any, series: any, container: HTMLElement, key: string) {
    this.chart = chart;
    this.series = series;
    this.container = container;
    this.key = key;
  }

  attach() {
    // 복원
    this.restore();
    // 이벤트 바인딩 (간단한 마우스 드래그/클릭)
    this.container.addEventListener('mousedown', this.onPointerDown);
    window.addEventListener('mousemove', this.onPointerMove);
    window.addEventListener('mouseup', this.onPointerUp);
  }

  detach() {
    this.disposed = true;
    this.container.removeEventListener('mousedown', this.onPointerDown);
    window.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('mouseup', this.onPointerUp);
    // 프리미티브 제거
    for (const d of this.drawings) {
      try {
        if (typeof this.series.detachPrimitive === 'function') {
          this.series.detachPrimitive(d.primitive);
        }
      } catch {}
    }
    this.drawings = [];
  }

  setMode(mode: Mode) {
    this.mode = mode;
  }

  list(): DrawingRecord[] {
    return [...this.drawings];
  }

  addHorizontal(price: number, opts?: { locked?: boolean; visible?: boolean; style?: any }) {
    const p = new HorizontalLevelPrimitive(price, opts?.style);
    // 가격→좌표 변환은 시리즈 또는 우측 가격축을 우선 사용
    p.setConverters({ priceToCoordinate: (pr) => {
      const yFromSeries = this.series.priceToCoordinate?.(pr);
      if (typeof yFromSeries === 'number') return yFromSeries;
      const yFromScale = this.chart.priceScale?.('right')?.priceToCoordinate?.(pr);
      return typeof yFromScale === 'number' ? yFromScale : undefined;
    }});
    let priceLine: any | undefined;
    if (typeof this.series.attachPrimitive === 'function') {
      this.series.attachPrimitive(p);
    } else if (typeof this.series.createPriceLine === 'function') {
      priceLine = this.series.createPriceLine({ price, color: '#94a3b8', lineWidth: 1, lineStyle: 0, axisLabelVisible: true });
    }
    const rec: DrawingRecord = {
      id: cryptoRandomId(),
      type: 'horizontal',
      primitive: p,
      price,
      locked: opts?.locked ?? false,
      visible: opts?.visible ?? true,
      priceLine,
    };
    this.drawings.push(rec);
    this.persist();
    return rec.id;
  }

  remove(id: string) {
    const idx = this.drawings.findIndex(d => d.id === id);
    if (idx === -1) return;
    const [rec] = this.drawings.splice(idx, 1);
    try {
      if (typeof this.series.detachPrimitive === 'function') {
        this.series.detachPrimitive(rec.primitive);
      }
      if (rec.priceLine && typeof this.series.removePriceLine === 'function') {
        this.series.removePriceLine(rec.priceLine);
      }
    } catch {}
    this.persist();
  }

  private persist() {
    const payload = this.drawings.map(d => ({ id: d.id, type: d.type, price: d.price, locked: d.locked, visible: d.visible }));
    try {
      localStorage.setItem(this.key, JSON.stringify({ v: 1, items: payload }));
    } catch {}
  }

  private restore() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        for (const it of parsed.items) {
          const id = this.addHorizontal(it.price, { locked: it.locked, visible: it.visible });
          // 기존 ID 유지
          const d = this.drawings.find(x => x.id === id);
          if (d) d.id = it.id;
        }
      }
    } catch {}
  }

  private hitTestIdAt(y: number): string | null {
    // y: 컨테이너 기준 CSS 픽셀 좌표
    let best: { id: string; dist: number } | null = null;
    for (const d of this.drawings) {
      const lineY = this.series.priceToCoordinate?.(d.price);
      if (typeof lineY !== 'number') continue;
      const dist = Math.abs(lineY - y);
      if (dist <= 6) {
        if (!best || dist < best.dist) best = { id: d.id, dist };
      }
    }
    return best?.id ?? null;
  }

  private onPointerDown = (ev: MouseEvent) => {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const y = ev.clientY - rect.top;

    if (this.mode === 'create-horizontal') {
      // 우측 가격축 기준으로 좌표→가격 변환 (시리즈가 null을 반환할 수 있음)
      let price: any = this.series.coordinateToPrice?.(y);
      if (price == null && this.chart.priceScale) {
        price = this.chart.priceScale('right')?.coordinateToPrice?.(y);
      }
      if (typeof price === 'number') this.addHorizontal(price);
      return;
    }

    if (this.mode === 'erase') {
      const id = this.hitTestIdAt(y);
      if (id) this.remove(id);
      return;
    }

    if (this.mode === 'select') {
      const id = this.hitTestIdAt(y);
      if (id) {
        const d = this.drawings.find(x => x.id === id);
        if (d && !d.locked) this.draggingId = id;
      }
    }
  };

  private onPointerMove = (ev: MouseEvent) => {
    if (this.disposed) return;
    if (!this.draggingId) return;
    const rect = this.container.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    let price: any = this.series.coordinateToPrice?.(y);
    if (price == null && this.chart.priceScale) {
      price = this.chart.priceScale('right')?.coordinateToPrice?.(y);
    }
    if (typeof price !== 'number') return;
    const d = this.drawings.find(x => x.id === this.draggingId);
    if (!d) return;
    d.price = price;
    d.primitive.setPrice(price);
    // PriceLine 폴백 업데이트: remove 후 재생성
    if (!this.series.attachPrimitive && d.priceLine && typeof this.series.removePriceLine === 'function') {
      try { this.series.removePriceLine(d.priceLine); } catch {}
      if (typeof this.series.createPriceLine === 'function') {
        d.priceLine = this.series.createPriceLine({ price, color: '#94a3b8', lineWidth: 1, lineStyle: 0, axisLabelVisible: true });
      }
    }
    this.persist();
  };

  private onPointerUp = (_ev: MouseEvent) => {
    if (this.disposed) return;
    this.draggingId = null;
  };
}

function cryptoRandomId() {
  try {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(36).slice(2);
  }
}
