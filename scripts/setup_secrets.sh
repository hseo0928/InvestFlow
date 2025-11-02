#!/bin/bash

# GitHub Secrets 설정 스크립트
# 사용법: ./scripts/setup_github_secrets.sh <GITHUB_TOKEN>

GITHUB_TOKEN=$1
REPO="hseo0928/InvestFlow"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "사용법: $0 <GITHUB_TOKEN>"
  echo "GitHub Personal Access Token이 필요합니다."
  exit 1
fi

# Load environment variables from .env.local
source .env.local

# Frontend secrets
gh secret set VITE_BACKEND_URL --body "$VITE_BACKEND_URL" --repo "$REPO"
gh secret set VITE_GEMINI_API_KEY --body "$VITE_GEMINI_API_KEY" --repo "$REPO"
gh secret set VITE_OPENROUTER_API_KEY --body "$VITE_OPENROUTER_API_KEY" --repo "$REPO"
gh secret set VITE_DEEPL_API_KEY --body "$VITE_DEEPL_API_KEY" --repo "$REPO"
gh secret set VITE_TWELVEDATA_API_KEY --body "$VITE_TWELVEDATA_API_KEY" --repo "$REPO"
gh secret set VITE_KIS_APP_KEY --body "$VITE_KIS_APP_KEY" --repo "$REPO"
gh secret set VITE_KIS_APP_SECRET --body "$VITE_KIS_APP_SECRET" --repo "$REPO"
gh secret set VITE_FINANCIAL_JUICE_RSS --body "$VITE_FINANCIAL_JUICE_RSS" --repo "$REPO"
gh secret set VITE_SAVETICKER_API --body "$VITE_SAVETICKER_API" --repo "$REPO"

# Backend secrets (Railway will use these via Railway dashboard)
echo "✅ GitHub Secrets 설정 완료!"
echo ""
echo "⚠️  다음 단계:"
echo "1. Railway 대시보드에서 환경 변수 설정:"
echo "   - KIS_APP_KEY"
echo "   - KIS_APP_SECRET"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo "   - DEEPL_API_KEY"
echo "   - NEWS_SCHEDULER_ENABLED=false"
echo ""
echo "2. Railway CLI로 배포:"
echo "   railway login"
echo "   railway link"
echo "   railway up"
echo ""
echo "3. Railway에서 RAILWAY_TOKEN 발급 후 GitHub Secrets에 추가:"
echo "   gh secret set RAILWAY_TOKEN --body \"<your-token>\" --repo \"$REPO\""
