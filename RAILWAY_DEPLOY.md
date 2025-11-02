# Railway 배포 가이드

## 1단계: Railway 프로젝트 설정

### Railway CLI 설치
```bash
npm install -g @railway/cli
```

### Railway 로그인 및 프로젝트 연결
```bash
railway login
railway link
```

## 2단계: Railway 환경 변수 설정

Railway 대시보드에서 다음 환경 변수들을 설정하세요:

```bash
# KIS API (한국투자증권)
KIS_APP_KEY=PSvn1T8EtmxIiPItiuBqRR2QlqvdaQpkWrjh
KIS_APP_SECRET=iL4A/qIUGgn0rI45TnxneFtxWBvCcfndq7pdLOrgoS4YEzvtFo7BxRaXQsRxKIP/AQr+Gtv7NpRrUvwPpj499q1OLYJemahTP8tCppWC4shOAR876VCJz5PGrwtqUtzaQzvPNifN0FzdDCkhpiupb40iTJ52TNzi+SvAYZdtWwlKny8zc5s=

# Supabase
SUPABASE_URL=https://czjtlzbqljrhosdydwye.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6anRsemJxbGpyaG9zZHlkd3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDA4OTgsImV4cCI6MjA3NDA3Njg5OH0.rl3EAbGusnNNbSgPvRlNYDU9hQlgTZjSTk8pxxo9KB4

# DeepL Translation
DEEPL_API_KEY=5d04b2a8-eda7-4374-b024-3e44c75bf9c7:fx

# Configuration
NEWS_SCHEDULER_ENABLED=false
FLASK_DEBUG=false
FLASK_PORT=5002
```

## 3단계: 수동 배포 (첫 배포)

```bash
railway up
```

배포 후 Railway에서 제공하는 URL을 확인하세요 (예: `https://your-app.railway.app`)

## 4단계: GitHub Actions 자동 배포 설정

### Railway Token 발급
1. Railway 대시보드 → Settings → Tokens
2. "Create Token" 클릭
3. Token 복사

### GitHub Secret 설정
```bash
# GitHub CLI 사용
gh secret set RAILWAY_TOKEN --body "<your-railway-token>"

# 또는 GitHub 웹사이트에서:
# Settings → Secrets and variables → Actions → New repository secret
# Name: RAILWAY_TOKEN
# Value: <your-railway-token>
```

### 프론트엔드 환경 변수 설정

GitHub Secrets에 다음 변수들을 추가하세요:

```bash
gh secret set VITE_BACKEND_URL --body "https://your-app.railway.app"
gh secret set VITE_GEMINI_API_KEY --body "AIzaSyBRFiiB51lkcF4UjVeXGd3Ub_SCeQup5EI"
gh secret set VITE_OPENROUTER_API_KEY --body "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"
gh secret set VITE_DEEPL_API_KEY --body "5d04b2a8-eda7-4374-b024-3e44c75bf9c7:fx"
gh secret set VITE_TWELVEDATA_API_KEY --body "36b195db29624d43b3faca56334ac38d"
gh secret set VITE_KIS_APP_KEY --body "PSvn1T8EtmxIiPItiuBqRR2QlqvdaQpkWrjh"
gh secret set VITE_KIS_APP_SECRET --body "iL4A/qIUGgn0rI45TnxneFtxWBvCcfndq7pdLOrgoS4YEzvtFo7BxRaXQsRxKIP/AQr+Gtv7NpRrUvwPpj499q1OLYJemahTP8tCppWC4shOAR876VCJz5PGrwtqUtzaQzvPNifN0FzdDCkhpiupb40iTJ52TNzi+SvAYZdtWwlKny8zc5s="
gh secret set VITE_FINANCIAL_JUICE_RSS --body "https://www.financialjuice.com/feed.ashx?xy=rss"
gh secret set VITE_SAVETICKER_API --body "https://api.saveticker.com/api/news/list"
```

## 5단계: 배포 확인

### 백엔드 배포 확인
```bash
curl https://your-app.railway.app/api/health
```

예상 응답:
```json
{
  "status": "healthy",
  "service": "InvestFlow API",
  "version": "1.0.0"
}
```

### 프론트엔드 배포 확인
GitHub Pages: https://hseo0928.github.io/InvestFlow/

## 자동 배포 흐름

### 백엔드 (Railway)
`backend/` 폴더 변경 시 자동으로 Railway에 배포됩니다.

### 프론트엔드 (GitHub Pages)
`main` 브랜치에 push 시 자동으로 GitHub Pages에 배포됩니다.

## 문제 해결

### Railway 로그 확인
```bash
railway logs
```

### 환경 변수 확인
```bash
railway variables
```

### 서비스 재시작
```bash
railway restart
```
