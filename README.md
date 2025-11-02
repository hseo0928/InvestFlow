# InvestFlow 📈

AI 기반 실시간 주식 분석 플랫폼입니다. 기술적 지표, 뉴스 분석, AI 인사이트를 통합하여 투자 의사결정을 지원합니다.

## 주요 기능

- 📊 **실시간 차트**: Lightweight Charts 기반의 인터랙티브 차트
- 🎨 **드로잉 도구**: 수평선, 추세선 등 기술적 분석 도구
- 📰 **뉴스 분석**: AI 기반 뉴스 감성 분석 및 영향도 평가
- 🤖 **AI 인사이트**: 종합적인 매수/매도/보류 추천
- 📈 **기술적 지표**: RSI, MACD, 볼린저 밴드 등
- 🔍 **주식 검색**: 실시간 종목 검색 및 정보 조회

## 기술 스택

### Frontend
- **React** 18 + **TypeScript**
- **Vite** - 빠른 개발 환경
- **TailwindCSS** - 유틸리티 CSS 프레임워크
- **Lightweight Charts** - 금융 차트 라이브러리
- **Shadcn/ui** - 컴포넌트 라이브러리

### Backend
- **Flask** - Python 웹 프레임워크
- **yfinance** - 주가 데이터 수집
- **KIS API** - 한국투자증권 API
- **Supabase** - 뉴스 데이터 저장
- **Gemini AI** - AI 분석

## 시작하기

### 사전 요구사항

- Node.js 18+ 
- Python 3.11+
- npm 또는 yarn

### 설치 및 실행

1. **저장소 클론**
```bash
git clone <repository-url>
cd InvestFlow
```

2. **환경변수 설정**
```bash
# 루트 디렉토리에 .env 파일 생성
cp .env.example .env
# 필요한 API 키 입력
```

3. **Frontend 설치 및 실행**
```bash
npm install
npm run dev
```

4. **Backend 설치 및 실행**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

5. **브라우저 접속**
```
http://localhost:5173
```

## 환경변수

필수 환경변수는 `.env.example` 파일을 참고하세요.

### Frontend (.env)
```env
VITE_BACKEND_URL=http://localhost:5002
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Backend (backend/.env)
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_key

# KIS API
KIS_APP_KEY=your_kis_app_key
KIS_APP_SECRET=your_kis_app_secret
KIS_ACCOUNT_NUMBER=your_account_number
KIS_MOCK_MODE=true

# TwelveData API
TWELVE_DATA_API_KEY=your_twelvedata_key

# News API
NEWS_API_KEY=your_news_api_key
```

## 프로젝트 구조

```
InvestFlow/
├── src/                    # Frontend 소스
│   ├── components/         # React 컴포넌트
│   │   ├── chart/         # 차트 관련 컴포넌트
│   │   └── ui/            # UI 컴포넌트
│   ├── hooks/             # Custom React Hooks
│   ├── services/          # API 서비스
│   ├── types/             # TypeScript 타입 정의
│   ├── utils/             # 유틸리티 함수
│   └── config/            # 설정 파일
├── backend/               # Backend 소스
│   ├── routes/           # API 라우트
│   ├── services/         # 비즈니스 로직
│   ├── utils/            # 유틸리티
│   └── config/           # 설정
└── supabase/             # Supabase 설정
    ├── functions/        # Edge Functions
    └── migrations/       # DB 마이그레이션
```

## 배포

배포 방법은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

### 추천 플랫폼
- **Frontend**: Vercel, Netlify
- **Backend**: Railway, Render, Fly.io

## API 문서

### Stock API
- `GET /api/stock/search?query={symbol}` - 종목 검색
- `GET /api/stock/{symbol}` - 종목 상세 정보
- `GET /api/stock/{symbol}/chart?period={period}` - 차트 데이터

### News API
- `GET /api/news/{symbol}` - 종목 관련 뉴스

### AI API
- `POST /api/ai/analyze` - AI 분석 (종합 추천)
- `POST /api/ai/analyze-news` - 뉴스 감성 분석

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 문의

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.

## 감사의 말

- [Lightweight Charts](https://github.com/tradingview/lightweight-charts)
- [yfinance](https://github.com/ranaroussi/yfinance)
- [Shadcn/ui](https://ui.shadcn.com)
- [TailwindCSS](https://tailwindcss.com)

Edge Function 수동 호출(초기 적재 확인):

```
curl -i "$SUPABASE_URL/functions/v1/fetch_financial_news" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### 스케줄링 & 시크릿(Secrets)

- Edge Function이 사용하는 환경변수(Secrets):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (서비스 롤 키)
  - 선택: `FJ_RSS_URL`, `FJ_MIN_INTERVAL_SEC`, `FJ_JITTER_SEC`, `FJ_MAX_BACKOFF_SEC`, `FJ_LIMIT`, `FJ_USER_AGENT`
- Supabase Dashboard → Edge Functions → 해당 함수 → Secrets에서 설정 후 Cron 스케줄을 추가하세요.
- 서버(`backend/server.py`)는 내부 스케줄러를 기본 비활성화합니다. 필요시 `.env`에 `NEWS_SCHEDULER_ENABLED=true`로 변경하여 사용할 수 있습니다.
  
