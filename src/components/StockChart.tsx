import { useState, useEffect, useRef, useMemo } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, AreaSeries, LineSeries, LineStyle, BaselineSeries, createSeriesMarkers } from 'lightweight-charts';
import { StockDataService } from "../lib/stock-service";
import { StockCacheService } from "../lib/stock-cache";
import { ChartDataPoint } from "../lib/api-config";
import { Loader2, AlertCircle } from "lucide-react";
import { formatVolume } from "./ui/utils";
import { calculateRSI, calculateRSIData } from "../lib/indicators/rsi";

interface ChartData {
  date: string;
  timestamp: number;
  value: number; // 하위 호환성을 위해 유지, close 가격을 매핑
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockChartProps {
  showPortfolio?: boolean;
  stockSymbol?: string;
  period?: '1d' | '1w' | '1mo';
  drawingMode?: 'select' | 'create-horizontal' | 'erase';
  showRSI?: boolean;
}

export function StockChart({ showPortfolio = false, stockSymbol = "AAPL", period = "1mo", drawingMode, showRSI: showRSIProp }: StockChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRSI, setShowRSI] = useState(showRSIProp || false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const seriesMarkersRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const rsiSignalSeriesRef = useRef<any>(null);
  const level30Ref = useRef<any>(null);
  const level70Ref = useRef<any>(null);
  const rsiOversoldAreaRef = useRef<any>(null);
  const rsiOverboughtAreaRef = useRef<any>(null);
  // 1단계: 오버레이 없이 키보드로 모드 전환하고 클릭으로 생성/삭제만 지원
  const drawModeRef = useRef<'none' | 'create' | 'erase' | 'select'>('none');
  const draggingIdRef = useRef<string | null>(null);
  const priceLinesRef = useRef<Array<{ id: string; price: number; line: any; color?: string; source?: 'user'|'ai'; title?: string }>>([]);

  useEffect(() => {
    if (showPortfolio) {
      // 포트폴리오 데이터 로드
      const portfolioData = generateMockPortfolioData();
      setChartData(portfolioData);
      setIsLoading(false);
      return;
    }

    // 주식 데이터 로드 (2년치 데이터를 봉 단위로 처리)
    const loadStockData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 1. 캐시에서 봉차트 데이터 시도
        const cachedData = StockCacheService.getFilteredData(stockSymbol, period);
        if (cachedData && cachedData.length > 0) {
          console.log(`📦 Using cached data for ${stockSymbol} (${cachedData.length} ${period} candles)`);
          const formattedData = formatChartData(cachedData, period);
          setChartData(formattedData);
          setIsLoading(false);
          // 백그라운드에서 최신 데이터 append 시도 후 갱신
          StockCacheService.refreshCacheWithLatest(stockSymbol).then((updated) => {
            if (updated) {
              const updatedCandles = StockCacheService.getFilteredData(stockSymbol, period);
              if (updatedCandles) {
                setChartData(formatChartData(updatedCandles, period));
              }
            }
          });
          return;
        }
        
        // 2. 캐시에 없으면 2년치 데이터 로드 후 봉차트로 변환
        console.log(`🌐 Fetching 2-year data for ${stockSymbol}...`);
        const rawData = await StockDataService.getChartData(stockSymbol, '1mo'); // 2년치 데이터 로드
        if (rawData && rawData.length > 0) {
          // 캐시에 저장
          StockCacheService.setCachedData(stockSymbol, rawData);
          
          // 선택된 봉 단위로 변환
          const candleData = StockCacheService.getFilteredData(stockSymbol, period);
          if (candleData) {
            const formattedData = formatChartData(candleData, period);
            setChartData(formattedData);
          }
        } else {
          // 데이터가 없으면 mock 데이터 사용
          const mockData = generateMockStockData(stockSymbol);
          setChartData(mockData);
        }
      } catch (err) {
        console.warn('Failed to load stock data, using mock data:', err);
        const mockData = generateMockStockData(stockSymbol);
        setChartData(mockData);
      } finally {
        setIsLoading(false);
      }
    };

    loadStockData();
  }, [stockSymbol, period, showPortfolio]);

  // RSI 데이터 계산 (useMemo로 성능 최적화)
  const rsiData = useMemo(() => {
    if (chartData.length < 15) return null;
    
    const closePrices = chartData.map(d => d.close);
    const rsiDataResult = calculateRSIData(closePrices);
    
    if (!rsiDataResult || rsiDataResult.rsi.length === 0) return null;
    
    // TradingView 형식으로 변환 - RSI 라인용
    const rsiLineData = chartData.slice(-rsiDataResult.rsi.length).map((item, index) => ({
      time: Math.floor(item.timestamp / 1000) as any,
      value: rsiDataResult.rsi[index]
    }));

    // Signal 라인용 데이터 (Signal은 RSI보다 8개 적음)
    const signalLineData = rsiDataResult.signal.length > 0 ? 
      chartData.slice(-rsiDataResult.signal.length).map((item, index) => ({
        time: Math.floor(item.timestamp / 1000) as any,
        value: rsiDataResult.signal[index]
      })) : [];

    return { rsi: rsiLineData, signal: signalLineData, crossovers: rsiDataResult.crossovers || [] };
  }, [chartData]);

  // Lightweight Charts 초기화 및 업데이트
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    // 데이터 검증
    console.log('Chart data:', chartData.slice(0, 3)); // 처음 3개 데이터만 로그

    // 기존 차트 정리 (안전하게)
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (error) {
        console.warn('Chart removal error:', error);
      }
      chartRef.current = null;
    }

    // 새 차트 생성 (다중 패널 지원)
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: 'black',
      },
      width: chartContainerRef.current.clientWidth,
      height: 700, // 400 → 700으로 증가 (보조지표 대비)
      timeScale: {
        timeVisible: period === '1d',
        secondsVisible: false,
      },
      grid: {
        vertLines: {
          color: '#e2e8f0',
        },
        horzLines: {
          color: '#e2e8f0',
        },
      },
    });

    chartRef.current = chart;

    // 핸들러를 외부 스코프로 선언하여 cleanup에서 접근 가능하게 함
    let clickHandler: any;
    let moveHandler: any;
    let upHandler: any;
    let onKey: any;
    let aiHandler: any;
    let onClearAiEvent: any;
    let downHandler: any;

    if (showPortfolio) {
      // 포트폴리오용 영역 차트
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: 'rgba(16, 185, 129, 0.4)',
        bottomColor: 'rgba(16, 185, 129, 0.1)',
        lineColor: '#10b981',
        lineWidth: 2,
      });

      const areaData = chartData.map(item => {
        const timeValue = Math.floor(item.timestamp / 1000);
        // 유효한 timestamp인지 확인
        if (isNaN(timeValue) || !item.timestamp) {
          console.error('Invalid timestamp found:', item);
          return null;
        }
        return {
          time: timeValue as any,
          value: item.value,
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null); // TypeScript 타입 가드

      // 시간 순서대로 정렬 (Lightweight Charts 요구사항)
      areaData.sort((a, b) => a.time - b.time);

      areaSeries.setData(areaData);
      
      // 시간 축을 전체 영역에 맞춰 표시
      chart.timeScale().fitContent();
    } else {
      // 주식용 캔들스틱 + 볼륨 차트 (다중 패널 구조)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        // 기본 마지막 가격선(Last Price Line) 비활성화해 사용자 수평선과 혼동 방지
        lastValueVisible: false,
        priceLineVisible: false,
      }, 0); // 메인 패널(인덱스 0)에 캔들스틱 배치

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: {
          type: 'volume',
        },
        color: 'rgba(148, 163, 184, 0.3)', // 투명도 70%로 설정 (더 투명하게)
        base: 0, // 0부터 시작
        // 볼륨 시리즈의 가격선도 비활성화
        priceLineVisible: false,
        lastValueVisible: false,
      }, 1); // 서브 패널(인덱스 1)에 볼륨 배치

      const candleData = chartData.map(item => {
        const timeValue = Math.floor(item.timestamp / 1000);
        // 유효한 timestamp인지 확인
        if (isNaN(timeValue) || !item.timestamp) {
          console.error('Invalid timestamp found:', item);
          return null;
        }
        return {
          time: timeValue as any,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null); // TypeScript 타입 가드

      const volumeData = chartData.map(item => {
        const timeValue = Math.floor(item.timestamp / 1000);
        // 유효한 timestamp인지 확인
        if (isNaN(timeValue) || !item.timestamp) {
          console.error('Invalid timestamp found:', item);
          return null;
        }
        return {
          time: timeValue as any,
          value: Math.abs(item.volume || 0), // 항상 양수로 보장
          color: 'rgba(148, 163, 184, 0.2)', // 투명도 80%로 설정 (더 투명하게)
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null); // TypeScript 타입 가드

      // 시간 순서대로 정렬 (Lightweight Charts 요구사항)
      candleData.sort((a, b) => a.time - b.time);
      volumeData.sort((a, b) => a.time - b.time);

      candleSeries.setData(candleData);
      volumeSeries.setData(volumeData);

      // 기본 패널 높이 설정 (RSI는 별도 useEffect에서 처리)
      chart.panes()[0].setHeight(450); // 메인 패널 (300 → 450)
      chart.panes()[1].setHeight(150); // 볼륨 패널 (100 → 150)

      // 시간 축을 전체 영역에 맞춰 표시
      chart.timeScale().fitContent();

      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      // 1단계 드로잉: 클릭으로 생성/삭제 (attachPrimitive가 없어도 PriceLine 활용)
      const storageKey = `drawings:${stockSymbol}:${period}`;

      const persist = () => {
        try {
          const payload = priceLinesRef.current.map(l => ({ id: l.id, price: l.price, color: l.color, source: l.source }));
          localStorage.setItem(storageKey, JSON.stringify({ v: 1, items: payload }));
        } catch {}
      };

      const addLine = (price: number, opts?: { color?: string; source?: 'user'|'ai'; title?: string }) => {
        try {
          const color = opts?.color ?? '#64748b';
          const title = opts?.title;
          const line = (candleSeries as any).createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title,
          });
          const id = Math.random().toString(36).slice(2);
          priceLinesRef.current.push({ id, price, line, color, source: opts?.source ?? 'user', title });
          persist();
          return id;
        } catch (e) {
          console.warn('addLine failed', e);
        }
      };

      const NEAR_PX = 10; // 히트 범위 확장
      const nearestIndexAtY = (y: number) => {
        const lines = priceLinesRef.current;
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < lines.length; i++) {
          const py = (candleSeries as any).priceToCoordinate?.(lines[i].price);
          if (typeof py !== 'number') continue;
          const d = Math.abs(py - y);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        return { index: bestIdx, dist: bestDist };
      };

      const removeNearest = (y: number) => {
        try {
          const { index, dist } = nearestIndexAtY(y);
          if (index >= 0 && dist <= NEAR_PX) {
            const [rec] = priceLinesRef.current.splice(index, 1);
            try { (candleSeries as any).removePriceLine(rec.line); } catch {}
            persist();
          }
        } catch (e) {
          console.warn('removeNearest failed', e);
        }
      };

      const updateAtIndex = (idx: number, newPrice: number) => {
        try {
          const rec: any = priceLinesRef.current[idx];
          if (!rec) return;
          try { (candleSeries as any).removePriceLine(rec.line); } catch {}
          const line = (candleSeries as any).createPriceLine({
            price: newPrice,
            color: rec.color ?? '#64748b',
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: rec.source === 'ai' ? (rec.title ?? undefined) : undefined,
          });
          priceLinesRef.current[idx] = { ...rec, price: newPrice, line };
          persist();
        } catch (e) {
          console.warn('updateAtIndex failed', e);
        }
      };

      // 복원(임시 비활성화)
      // try {
      //   const raw = localStorage.getItem(storageKey);
      //   const parsed = raw ? JSON.parse(raw) : null;
      //   if (parsed && Array.isArray(parsed.items)) {
      //     for (const it of parsed.items) addLine(Number(it.price));
      //   }
      // } catch {}

      clickHandler = (param: any) => {
        try {
          const pt = param?.point;
          if (!pt || typeof pt.y !== 'number') return;
          if (drawModeRef.current === 'create') {
            const p = (candleSeries as any).coordinateToPrice?.(pt.y);
            if (typeof p === 'number') addLine(p);
          } else if (drawModeRef.current === 'erase') {
            removeNearest(pt.y);
          }
        } catch (e) {
          console.warn('click handler error', e);
        }
      };
      chart.subscribeClick(clickHandler);

      // AI S/R 제안 이벤트 수신 → 가시영역 기준으로 보정 후 수평선 일괄 추가
      aiHandler = (ev: Event) => {
        try {
          const detail = (ev as CustomEvent).detail as { symbol: string; period: '1d'|'1w'|'1mo'; levels: Array<{ price: number; type: 'support'|'resistance'; confidence?: number }> };
          if (!detail) return;
          if (detail.symbol !== stockSymbol || detail.period !== period) return;
          // 1) 가시영역 계산
          const vr = chart.timeScale().getVisibleRange();
          let fromMs = -Infinity, toMs = Infinity;
          if (vr && typeof (vr as any).from === 'number' && typeof (vr as any).to === 'number') {
            fromMs = (vr as any).from * 1000;
            toMs = (vr as any).to * 1000;
          }
          const visible = chartData.filter(d => d.timestamp >= fromMs && d.timestamp <= toMs);
          const minLow = visible.length ? Math.min(...visible.map(d => d.low)) : Math.min(...chartData.map(d => d.low));
          const maxHigh = visible.length ? Math.max(...visible.map(d => d.high)) : Math.max(...chartData.map(d => d.high));
          const lastClose = visible.length ? visible[visible.length - 1].close : chartData[chartData.length - 1].close;

          // 2) 레벨 가시영역으로 필터링 및 타입 유지
          let levels = (detail.levels || []).filter(l => l.price >= minLow && l.price <= maxHigh);

          // 3) 저항/지지 최소 1개 보장
          const hasRes = levels.some(l => l.type === 'resistance');
          const hasSup = levels.some(l => l.type === 'support');
          const ensureResistance = () => {
            // 가시영역이 비어도 전체 차트 기준으로 보강
            const scan = visible.length ? visible : chartData;
            const highs: number[] = [];
            for (let i = 1; i < scan.length - 1; i++) {
              const p = scan[i];
              const prev = scan[i-1];
              const next = scan[i+1];
              if (p.high > prev.high && p.high > next.high) highs.push(p.high);
            }
            const candidates = highs.filter(h => h >= lastClose).sort((a,b)=>Math.abs(a-lastClose)-Math.abs(b-lastClose));
            if (candidates.length) {
              levels.push({ price: candidates[0], type: 'resistance', confidence: 0.5 });
            } else {
              levels.push({ price: maxHigh, type: 'resistance', confidence: 0.4 });
            }
          };
          const ensureSupport = () => {
            const scan = visible.length ? visible : chartData;
            const lows: number[] = [];
            for (let i = 1; i < scan.length - 1; i++) {
              const p = scan[i];
              const prev = scan[i-1];
              const next = scan[i+1];
              if (p.low < prev.low && p.low < next.low) lows.push(p.low);
            }
            const candidates = lows.filter(l => l <= lastClose).sort((a,b)=>Math.abs(a-lastClose)-Math.abs(b-lastClose));
            if (candidates.length) {
              levels.push({ price: candidates[0], type: 'support', confidence: 0.5 });
            } else {
              levels.push({ price: minLow, type: 'support', confidence: 0.4 });
            }
          };
          if (!hasRes) ensureResistance();
          if (!hasSup) ensureSupport();

          // 4) 타입별 중복 제거(±0.1%) 및 최대 6개 제한
          const tol = 0.001;
          const sup: typeof levels = [];
          const res: typeof levels = [];
          for (const l of levels) {
            const bucket = l.type === 'support' ? sup : res;
            if (!bucket.some(x => Math.abs(x.price - l.price) / l.price <= tol)) bucket.push(l);
          }
          // 부족 시 보강 (타입별 독립적으로 판단)
          if (res.length === 0) {
            // 보강용 저항 가격
            const scan = visible.length ? visible : chartData;
            const highs: number[] = [];
            for (let i = 1; i < scan.length - 1; i++) {
              const p = scan[i];
              const prev = scan[i-1];
              const next = scan[i+1];
              if (p.high > prev.high && p.high > next.high) highs.push(p.high);
            }
            const candidates = highs.filter(h => h >= lastClose).sort((a,b)=>Math.abs(a-lastClose)-Math.abs(b-lastClose));
            const price = candidates.length ? candidates[0] : maxHigh;
            res.push({ price, type: 'resistance', confidence: 0.4 });
          }
          if (sup.length === 0) {
            const scan = visible.length ? visible : chartData;
            const lows: number[] = [];
            for (let i = 1; i < scan.length - 1; i++) {
              const p = scan[i];
              const prev = scan[i-1];
              const next = scan[i+1];
              if (p.low < prev.low && p.low < next.low) lows.push(p.low);
            }
            const candidates = lows.filter(l => l <= lastClose).sort((a,b)=>Math.abs(a-lastClose)-Math.abs(b-lastClose));
            const price = candidates.length ? candidates[0] : minLow;
            sup.push({ price, type: 'support', confidence: 0.4 });
          }
          levels = [...sup, ...res].slice(0, 6);

          // 5) 기존 AI 라인 제거 후 생성
          clearAiLines();
          for (const lvl of levels) {
            const color = lvl.type === 'support' ? '#10b981' : '#ef4444';
            const title = `${lvl.type === 'support' ? 'S' : 'R'}${lvl.confidence ? ' ' + (Number(lvl.confidence).toFixed(2)) : ''}`;
            addLine(lvl.price, { color, source: 'ai', title });
          }
          persist();
        } catch (e) {
          console.warn('AI levels handler error', e);
        }
      };
      window.addEventListener('aisr-levels', aiHandler as any);

      // AI 라인만 정리
      const clearAiLines = () => {
        try {
          const next: any[] = [];
          for (const rec of priceLinesRef.current as any[]) {
            if (rec.source === 'ai') {
              try { (candleSeries as any).removePriceLine(rec.line); } catch {}
            } else {
              next.push(rec);
            }
          }
          priceLinesRef.current = next as any;
          persist();
        } catch (e) {
          console.warn('clearAiLines failed', e);
        }
      };

      onClearAiEvent = (ev: Event) => {
        try {
          const detail = (ev as CustomEvent).detail as { symbol: string; period: '1d'|'1w'|'1mo' };
          if (detail && (detail.symbol !== stockSymbol || detail.period !== period)) return;
          clearAiLines();
        } catch {}
      };
      window.addEventListener('clear-ai-levels', onClearAiEvent as any);

      // mousedown에서 드래그 시작 판정(선택 모드)
      downHandler = (ev: MouseEvent) => {
        try {
          if (drawModeRef.current !== 'select') return;
          const container = chartContainerRef.current;
          if (!container) return;
          const rect = container.getBoundingClientRect();
          const y = ev.clientY - rect.top;
          const { index, dist } = nearestIndexAtY(y);
          if (index >= 0 && dist <= NEAR_PX) {
            draggingIdRef.current = priceLinesRef.current[index].id;
            ev.preventDefault();
          }
        } catch (e) {
          console.warn('down handler error', e);
        }
      };
      chartContainerRef.current.addEventListener('mousedown', downHandler);

      // 이동: 크로스헤어 이동으로 좌표 추적
      // 드래그 이동은 윈도우 mousemove로 처리(차트 밖으로 나가도 추적)
      const rafPendingRef = { current: false } as { current: boolean };
      let lastY: number | null = null;
      moveHandler = (ev: MouseEvent) => {
        try {
          if (!draggingIdRef.current) return;
          const container = chartContainerRef.current;
          if (!container) return;
          const rect = container.getBoundingClientRect();
          lastY = ev.clientY - rect.top;
          if (rafPendingRef.current) return;
          rafPendingRef.current = true;
          requestAnimationFrame(() => {
            try {
              if (!draggingIdRef.current || lastY == null) return;
              const price = (candleSeries as any).coordinateToPrice?.(lastY);
              if (typeof price !== 'number') return;
              const idx = priceLinesRef.current.findIndex(l => l.id === draggingIdRef.current);
              if (idx >= 0) updateAtIndex(idx, price);
            } finally {
              rafPendingRef.current = false;
            }
          });
        } catch (e) {
          console.warn('move handler error', e);
          rafPendingRef.current = false;
        }
      };
      window.addEventListener('mousemove', moveHandler as any);

      upHandler = () => { draggingIdRef.current = null; };
      window.addEventListener('mouseup', upHandler);

      // 키보드 모드 전환(H/S/E)
      onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'h' || ev.key === 'H') drawModeRef.current = 'create';
        if (ev.key === 's' || ev.key === 'S') drawModeRef.current = 'select';
        if (ev.key === 'e' || ev.key === 'E') drawModeRef.current = 'erase';
        if (ev.key === 'Escape') draggingIdRef.current = null;
      };
      window.addEventListener('keydown', onKey);
    }

    // 리사이즈 핸들러
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      // cleanup에서 차트 제거 (안전하게)
      try { if (clickHandler) chart.unsubscribeClick(clickHandler); } catch {}
      if (moveHandler) window.removeEventListener('mousemove', moveHandler as any);
      if (upHandler) window.removeEventListener('mouseup', upHandler);
      if (onKey) window.removeEventListener('keydown', onKey);
      if (aiHandler) window.removeEventListener('aisr-levels', aiHandler as any);
      window.removeEventListener('clear-ai-levels', onClearAiEvent as any);
      try { chartContainerRef.current?.removeEventListener('mousedown', downHandler); } catch {}
      // 생성된 PriceLine 정리
      try {
        const lines = priceLinesRef.current;
        for (const rec of lines) {
          try { (candleSeriesRef.current as any)?.removePriceLine?.(rec.line); } catch {}
        }
        priceLinesRef.current.length = 0;
      } catch {}
      // 마커 플러그인 정리
      try {
        if (seriesMarkersRef.current && seriesMarkersRef.current.detach) {
          seriesMarkersRef.current.detach();
        }
      } catch {}
      
      // RSI 시리즈 정리
      try {
        if (rsiSeriesRef.current) {
          rsiSeriesRef.current = null;
        }
        if (level30Ref.current) {
          level30Ref.current = null;
        }
        if (level70Ref.current) {
          level70Ref.current = null;
        }
        if (rsiOversoldAreaRef.current) {
          rsiOversoldAreaRef.current = null;
        }
        if (rsiOverboughtAreaRef.current) {
          rsiOverboughtAreaRef.current = null;
        }
      } catch (error) {
        console.warn('RSI series cleanup error:', error);
      }
      
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (error) {
          console.warn('Chart cleanup error:', error);
        }
        chartRef.current = null;
      }
    };
  }, [chartData, showPortfolio, period]);

  // 외부 툴바에서 들어온 모드를 내부 drawModeRef에 동기화
  useEffect(() => {
    if (!drawingMode) return;
    if (drawingMode === 'select') drawModeRef.current = 'select';
    if (drawingMode === 'create-horizontal') drawModeRef.current = 'create';
    if (drawingMode === 'erase') drawModeRef.current = 'erase';
  }, [drawingMode]);

  // RSI 토글 전용 useEffect
  useEffect(() => {
    console.log('RSI useEffect triggered:', { showRSI, hasChart: !!chartRef.current, hasData: !!rsiData, rsiDataLength: rsiData?.rsi?.length });
    
    if (!chartRef.current || chartData.length === 0) {
      console.log('Early return: no chart or data');
      return;
    }

    const chart = chartRef.current;

    if (showRSI && rsiData && rsiData.rsi && rsiData.rsi.length > 0) {
      console.log('Adding RSI series...');
      
      // RSI 시리즈가 이미 있다면 제거
      if (rsiSeriesRef.current) {
        try {
          chart.removeSeries(rsiSeriesRef.current);
          if (rsiSignalSeriesRef.current) {
            chart.removeSeries(rsiSignalSeriesRef.current);
          }
          chart.removeSeries(level30Ref.current);
          chart.removeSeries(level70Ref.current);
          chart.removeSeries(rsiOversoldAreaRef.current);
          chart.removeSeries(rsiOverboughtAreaRef.current);
          console.log('Removed existing RSI series');
        } catch (e) {
          console.warn('Failed to remove existing RSI series:', e);
        }
      }

      // 새로운 RSI 시리즈 추가
      try {
        // 1. 과매도 영역 (RSI와 30선 사이만 채움) - BaselineSeries 사용
        const oversoldArea = chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: 30 },
          // 아래 영역(30 이하)만 색상 표시
          bottomFillColor1: 'rgba(59, 130, 246, 0.10)',
          bottomFillColor2: 'rgba(59, 130, 246, 0.05)',
          bottomLineColor: 'transparent',
          // 위 영역(30 이상)은 투명 처리
          topFillColor1: 'rgba(0,0,0,0)',
          topFillColor2: 'rgba(0,0,0,0)',
          topLineColor: 'transparent',
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        }, 2);

        // 2. 과매수 영역 (RSI와 70선 사이만 채움) - BaselineSeries 사용
        const overboughtArea = chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: 70 },
          // 위 영역(70 이상)만 색상 표시
          topFillColor1: 'rgba(239, 68, 68, 0.10)',
          topFillColor2: 'rgba(239, 68, 68, 0.05)',
          topLineColor: 'transparent',
          // 아래 영역(70 이하)은 투명 처리
          bottomFillColor1: 'rgba(0,0,0,0)',
          bottomFillColor2: 'rgba(0,0,0,0)',
          bottomLineColor: 'transparent',
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        }, 2);

        // 3. RSI 라인
        const rsiSeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        }, 2);

        // 4. RSI Signal 라인 (RSI의 9기간 단순이동평균) - 주황색
        const rsiSignalSeries = chart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        }, 2);

        // 5. 30선 (과매도 기준선) - 파란색
        const level30 = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        }, 2);

        // 6. 70선 (과매수 기준선) - 빨간색  
        const level70 = chart.addSeries(LineSeries, {
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        }, 2);

        // 데이터 설정
        rsiSeries.setData(rsiData.rsi);

        // Signal 라인 데이터 설정 (Signal 데이터가 있을 때만)
        if (rsiData.signal && rsiData.signal.length > 0) {
          rsiSignalSeries.setData(rsiData.signal);
        }

        // 기준선 데이터 설정
        const level30Data = rsiData.rsi.map(item => ({ time: item.time as any, value: 30 }));
        const level70Data = rsiData.rsi.map(item => ({ time: item.time as any, value: 70 }));
        level30.setData(level30Data);
        level70.setData(level70Data);

        // Baseline 영역 데이터는 RSI 전체 시퀀스를 그대로 사용 (기준값과의 사이만 자동 채움)
        oversoldArea.setData(rsiData.rsi);
        overboughtArea.setData(rsiData.rsi);

        // RSI 시리즈 참조 저장
        rsiSeriesRef.current = rsiSeries;
        rsiSignalSeriesRef.current = rsiSignalSeries;
        level30Ref.current = level30;
        level70Ref.current = level70;
        rsiOversoldAreaRef.current = oversoldArea;
        rsiOverboughtAreaRef.current = overboughtArea;

        // 패널 높이 재조정 - RSI 활성화 시
        chart.panes()[0].setHeight(350); // 메인 패널 (300 → 350)
        chart.panes()[1].setHeight(120); // 볼륨 패널 (80 → 120)
        if (chart.panes()[2]) {
          chart.panes()[2].setHeight(200); // RSI 패널 (120 → 200, 더 넉넉하게)
        }
        
        // RSI 교차 기반 매매 신호 마커 표시 (RSI가 Signal을 상/하향 돌파할 때) - RSI 시리즈에 표시
        try {
          if (
            rsiData &&
            Array.isArray(rsiData.rsi) && rsiData.rsi.length > 0 &&
            Array.isArray(rsiData.crossovers)
          ) {
            // RSI 배열 인덱스(co.time)를 그대로 사용해 RSI 시리즈에 가격 기준 마커를 찍는다
            // position: atPriceTop/Bottom 를 사용하려면 price 지정 필요
            const markers = (rsiData.crossovers || []).map((co: any) => {
              const idx = co?.time ?? -1;
              if (idx < 0 || idx >= rsiData.rsi.length) return null;
              const point = rsiData.rsi[idx];
              const time = point.time as any;
              if (co.type === 'bullish') {
                return { time, position: 'belowBar' as const, color: '#10b981', shape: 'arrowUp' as const, text: 'Buy', size: 2 };
              } else {
                return { time, position: 'aboveBar' as const, color: '#ef4444', shape: 'arrowDown' as const, text: 'Sell', size: 2 };
              }
            }).filter((m: any) => m !== null);

            // RSI 시리즈에 마커 플러그인 부착 후 세팅
            try {
              // @ts-ignore plugin api at runtime
              seriesMarkersRef.current = createSeriesMarkers(rsiSeries, []);
            } catch (e) {
              console.warn('Failed to create markers on RSI series; will try setMarkers fallback.', e);
              seriesMarkersRef.current = null;
            }
            if (seriesMarkersRef.current && seriesMarkersRef.current.setMarkers) {
              seriesMarkersRef.current.setMarkers(markers);
            } else {
              // fallback: 일부 구버전 호환
              (rsiSeriesRef.current as any)?.setMarkers?.(markers);
            }
          }
        } catch (e) {
          console.warn('RSI markers error:', e);
        }

        console.log('RSI series added successfully');
      } catch (e) {
        console.warn('Failed to add RSI series:', e);
      }
    } else if (!showRSI && rsiSeriesRef.current) {
      console.log('Removing RSI series...');
      
      // RSI 시리즈 제거
      try {
        chart.removeSeries(rsiSeriesRef.current);
        if (rsiSignalSeriesRef.current) {
          chart.removeSeries(rsiSignalSeriesRef.current);
        }
        chart.removeSeries(level30Ref.current);
        chart.removeSeries(level70Ref.current);
        chart.removeSeries(rsiOversoldAreaRef.current);
        chart.removeSeries(rsiOverboughtAreaRef.current);
        
        rsiSeriesRef.current = null;
        rsiSignalSeriesRef.current = null;
        level30Ref.current = null;
        level70Ref.current = null;
        rsiOversoldAreaRef.current = null;
        rsiOverboughtAreaRef.current = null;

        // RSI가 꺼지면 마커도 제거
        try {
          if (seriesMarkersRef.current && seriesMarkersRef.current.setMarkers) {
            seriesMarkersRef.current.setMarkers([]);
            if (seriesMarkersRef.current.detach) seriesMarkersRef.current.detach();
          } else {
            (rsiSeriesRef.current as any)?.setMarkers?.([]);
          }
        } catch {}

        // 패널 높이 재조정 (RSI 없음) - 더 큰 공간 활용
        chart.panes()[0].setHeight(450); // 메인 패널 (300 → 450)
        chart.panes()[1].setHeight(150); // 볼륨 패널 (100 → 150)
        
        console.log('RSI series removed successfully');
      } catch (e) {
        console.warn('Failed to remove RSI series:', e);
      }
    } else {
      console.log('No action taken:', { showRSI, hasRsiSeries: !!rsiSeriesRef.current, hasRsiData: !!rsiData });
    }
  }, [showRSI, rsiData, chartData]);

  // 드로잉 모드는 롤백되어 반영하지 않습니다.

  const formatChartData = (data: ChartDataPoint[], period: '1d' | '1w' | '1mo'): ChartData[] => {
    return data.map(point => {
      const date = new Date(point.timestamp);
      let dateString: string;

      // Format date based on period
      if (period === '1d') {
        dateString = date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
      } else if (period === '1w') {
        dateString = `${date.getMonth() + 1}/${date.getDate()}`;
      } else {
        // 1mo (월봉)
        dateString = `${date.getFullYear().toString().slice(-2)}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      return {
        date: dateString,
        value: point.close || point.price, // 하위 호환성: close가 있으면 사용, 없으면 price 사용
        timestamp: point.timestamp,
        open: point.open || point.price,
        high: point.high || point.price,
        low: point.low || point.price,
        close: point.close || point.price,
        volume: Math.abs(point.volume || 0), // 항상 양수 보장
      };
    });
  };

  // Mock data generators (fallback)
  const generateMockPortfolioData = (): ChartData[] => {
    const data = [];
    const today = new Date();
    let baseValue = 14000000;

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const prevValue = baseValue;
      baseValue = baseValue + (Math.random() - 0.48) * 300000;
      
      // 포트폴리오 데이터는 OHLC가 아니므로 모든 값을 동일하게 설정
      const roundedValue = Math.round(baseValue);
      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        value: roundedValue,
        timestamp: date.getTime(),
        open: Math.round(prevValue),
        high: Math.round(Math.max(prevValue, baseValue) * 1.01),
        low: Math.round(Math.min(prevValue, baseValue) * 0.99),
        close: roundedValue,
        volume: Math.abs(Math.round(Math.random() * 1000000)), // 항상 양수 보장
      });
    }
    
    return data;
  };

  const generateMockStockData = (symbol: string): ChartData[] => {
    const data = [];
    const today = new Date();
    
    // Different base prices for different stocks
    const basePrices: Record<string, number> = {
      'AAPL': 175,
      'GOOGL': 135,
      'MSFT': 340,
      'AMZN': 145,
      'TSLA': 240,
      'META': 320,
      'NVDA': 520,
    };
    
    let basePrice = basePrices[symbol] || 100;

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const prevPrice = basePrice;
      basePrice = basePrice + (Math.random() - 0.48) * (basePrice * 0.02);
      
      // 실제 OHLC 데이터 시뮬레이션
      const close = Math.round(basePrice * 100) / 100;
      const open = Math.round(prevPrice * 100) / 100;
      const high = Math.round(Math.max(open, close) * (1 + Math.random() * 0.02) * 100) / 100;
      const low = Math.round(Math.min(open, close) * (1 - Math.random() * 0.02) * 100) / 100;
      const volume = Math.abs(Math.round(Math.random() * 100000000)); // 1억 이하 거래량, 항상 양수 보장
      
      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        value: close,
        timestamp: date.getTime(),
        open,
        high,
        low,
        close,
        volume,
      });
    }
    
    return data;
  };

  return (
    <div className="w-full">
      {/* RSI Toggle - 항상 표시 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              console.log('RSI Button clicked:', !showRSI);
              setShowRSI(!showRSI);
            }}
            disabled={isLoading || !!error || chartData.length === 0}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              showRSI 
                ? 'bg-blue-100 text-blue-900 border border-blue-200' 
                : 'hover:bg-slate-50 text-slate-600 border border-slate-200'
            } ${(isLoading || !!error || chartData.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            RSI
          </button>
        </div>
      </div>
      
      {/* Chart Container */}
      <div className="w-full h-[500px]">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>차트 데이터 로딩 중...</span>
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-slate-500">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-slate-500">차트 데이터가 없습니다</div>
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
