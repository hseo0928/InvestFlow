# 🚀 InvestFlow 배포 가이드

## 📦 프론트엔드 배포 (Vercel/Netlify)

### Vercel 배포
```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel
```

**환경 변수 설정 (Vercel Dashboard):**
- `VITE_BACKEND_URL`: 백엔드 API URL
- `VITE_GEMINI_API_KEY`: Gemini API 키 (선택)
- `VITE_OPENROUTER_API_KEY`: OpenRouter API 키 (선택)
- `VITE_TWELVEDATA_API_KEY`: TwelveData API 키 (선택)

### Netlify 배포
```bash
# Netlify CLI 설치
npm install -g netlify-cli

# 배포
netlify deploy --prod
```

**Build 설정:**
- Build command: `npm run build`
- Publish directory: `dist`

---

## 🐍 백엔드 배포 (Railway/Render/Fly.io)

### Railway 배포

1. **Railway CLI 설치**
```bash
npm install -g @railway/cli
```

2. **프로젝트 초기화**
```bash
cd backend
railway init
```

3. **환경 변수 설정**
```bash
railway variables set SUPABASE_URL=your_url
railway variables set SUPABASE_ANON_KEY=your_key
railway variables set KIS_APP_KEY=your_key
railway variables set KIS_APP_SECRET=your_secret
```

4. **배포**
```bash
railway up
```

### Render 배포

1. **Render 대시보드에서 새 Web Service 생성**
2. **Build Command:** `cd backend && pip install -r requirements.txt`
3. **Start Command:** `cd backend && python server.py`
4. **환경 변수 추가** (Dashboard에서)

### Fly.io 배포

1. **Fly CLI 설치**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **앱 초기화**
```bash
cd backend
fly launch
```

3. **환경 변수 설정**
```bash
fly secrets set SUPABASE_URL=your_url
fly secrets set SUPABASE_ANON_KEY=your_key
```

4. **배포**
```bash
fly deploy
```

---

## 🔒 환경 변수 필수 설정

### 프론트엔드 (필수)
- `VITE_BACKEND_URL`: 백엔드 API URL

### 백엔드 (필수)
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY`: Supabase 익명 키

### 선택 (기능 확장 시)
- `KIS_APP_KEY`, `KIS_APP_SECRET`: 한국투자증권 API
- `VITE_GEMINI_API_KEY`: Google Gemini AI
- `VITE_OPENROUTER_API_KEY`: OpenRouter AI
- `VITE_TWELVEDATA_API_KEY`: TwelveData 시장 데이터

---

## 📝 배포 체크리스트

- [ ] `.env.example` 파일 확인 및 업데이트
- [ ] `.gitignore`에 민감한 파일들 추가 확인
- [ ] 프론트엔드 빌드 테스트 (`npm run build`)
- [ ] 백엔드 의존성 설치 테스트 (`pip install -r requirements.txt`)
- [ ] CORS 설정 확인 (백엔드에서 프론트엔드 도메인 허용)
- [ ] 환경 변수 모두 설정
- [ ] API 키들이 올바르게 작동하는지 확인
- [ ] 프로덕션 모드에서 테스트

---

## 🌐 권장 호스팅 조합

### 무료 옵션
- **프론트엔드:** Vercel (무료, 자동 HTTPS, CDN)
- **백엔드:** Railway (무료 500시간/월) 또는 Render (무료, 슬립 모드)
- **데이터베이스:** Supabase (이미 사용 중)

### 유료 옵션 (확장 시)
- **프론트엔드:** Vercel Pro ($20/월)
- **백엔드:** Railway Pro ($5/월~) 또는 Fly.io
- **데이터베이스:** Supabase Pro ($25/월)

---

## 🔧 CORS 설정 확인

백엔드 `server.py`에서 CORS 설정이 프로덕션 도메인을 허용하는지 확인:

```python
# 현재는 모든 도메인 허용 (개발용)
CORS(app)

# 프로덕션에서는 특정 도메인만 허용
CORS(app, origins=[
    "https://your-frontend-domain.vercel.app",
    "http://localhost:5173"  # 로컬 개발용
])
```

---

## 📊 모니터링

배포 후 확인 사항:
- 프론트엔드가 백엔드 API를 정상적으로 호출하는가?
- 환경 변수가 올바르게 로드되는가?
- 에러 로그 확인
- API 응답 시간 모니터링
