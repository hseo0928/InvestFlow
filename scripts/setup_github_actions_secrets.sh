#!/usr/bin/env bash

# GitHub Actions Secrets 자동 등록 스크립트 (Enhanced Version)
# 사용법: ./scripts/setup_github_actions_secrets.sh [options]

set -e

# 색상 출력을 위한 함수들
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# GitHub CLI 설치 및 인증 확인
check_github_cli() {
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI(gh)가 설치되어 있지 않습니다."
        print_info "설치 방법: https://cli.github.com/"
        exit 1
    fi
    
    # GitHub CLI 인증 상태 확인
    if ! gh auth status &> /dev/null; then
        print_error "GitHub CLI 인증이 필요합니다."
        print_info "다음 명령어로 인증하세요: gh auth login"
        exit 1
    fi
    
    print_success "GitHub CLI 인증 확인 완료"
}

# .env 파일에서 환경변수 로드
load_env_variables() {
    local env_file="./backend/.env"
    
    if [[ -f "$env_file" ]]; then
        print_info "환경변수 로드: $env_file"
        
        # .env 파일에서 환경변수 읽기 (주석과 빈 줄 제외)
        while IFS='=' read -r key value; do
            # 주석과 빈 줄 건너뛰기
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z $key ]] && continue
            
            # 앞뒤 공백 제거
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)
            
            # 값이 있는 경우에만 export
            if [[ -n $value ]]; then
                export "$key=$value"
                print_info "  ✓ $key 로드됨"
            fi
        done < "$env_file"
        print_success ".env 파일 로드 완료"
    else
        print_warning ".env 파일이 존재하지 않습니다: $env_file"
    fi
}

# GitHub repository 정보 자동 감지
get_repo_info() {
    local repo_slug="${1:-}"
    
    if [[ -z "$repo_slug" ]]; then
        if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            local origin_url=$(git remote get-url origin 2>/dev/null || echo "")
            # Handle HTTPS and SSH remotes
            if [[ "$origin_url" =~ github.com[:/]+([^/]+/[^/.]+) ]]; then
                repo_slug="${BASH_REMATCH[1]}"
            fi
        fi
    fi
    
    if [[ -z "$repo_slug" ]]; then
        print_warning "저장소 정보를 자동으로 감지할 수 없습니다."
        echo -n "저장소 형식 (owner/repo): "
        read -r repo_slug
    fi
    
    if [[ -z "$repo_slug" ]]; then
        print_error "저장소 정보가 필요합니다."
        exit 1
    fi
    
    print_success "저장소 확인: $repo_slug"
    echo "$repo_slug"
}

# 대화형 환경변수 입력
prompt_for_variables() {
    if [[ -z "${SUPABASE_URL:-}" ]]; then
        echo -n "SUPABASE_URL (예: https://xxxx.supabase.co): "
        read -r SUPABASE_URL
    fi
    
    if [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
        echo -n "SUPABASE_ANON_KEY (anon key 입력): "
        read -r SUPABASE_ANON_KEY
    fi
    
    # 필수 변수 확인
    if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" ]]; then
        print_error "SUPABASE_URL과 SUPABASE_ANON_KEY는 필수입니다."
        exit 1
    fi
}

# GitHub Secrets 설정
set_github_secrets() {
    local repo_slug="$1"
    
    print_info "GitHub Actions Secrets 설정 중: $repo_slug"
    
    # Supabase secrets 설정
    echo -n "$SUPABASE_URL" | gh secret set SUPABASE_URL --repo "$repo_slug" --app actions --body - >/dev/null
    print_success "  ✓ SUPABASE_URL 설정 완료"
    
    echo -n "$SUPABASE_ANON_KEY" | gh secret set SUPABASE_ANON_KEY --repo "$repo_slug" --app actions --body - >/dev/null
    print_success "  ✓ SUPABASE_ANON_KEY 설정 완료"
    
    # KIS API secrets 설정 (선택사항)
    if [[ -n "${KIS_APP_KEY:-}" && -n "${KIS_APP_SECRET:-}" ]]; then
        echo -n "$KIS_APP_KEY" | gh secret set KIS_APP_KEY --repo "$repo_slug" --app actions --body - >/dev/null
        print_success "  ✓ KIS_APP_KEY 설정 완료"
        
        echo -n "$KIS_APP_SECRET" | gh secret set KIS_APP_SECRET --repo "$repo_slug" --app actions --body - >/dev/null
        print_success "  ✓ KIS_APP_SECRET 설정 완료"
    fi
}

# Secrets 확인
verify_secrets() {
    local repo_slug="$1"
    
    print_info "설정된 Secrets 확인 중..."
    
    if command -v jq &> /dev/null; then
        local secrets_list=$(gh secret list --repo="$repo_slug" --json name 2>/dev/null || echo "[]")
        local secret_names=$(echo "$secrets_list" | jq -r '.[].name' 2>/dev/null || echo "")
        
        if [[ -n "$secret_names" ]]; then
            print_success "현재 설정된 Secrets:"
            while IFS= read -r secret_name; do
                if [[ -n "$secret_name" ]]; then
                    print_info "  ✓ $secret_name"
                fi
            done <<< "$secret_names"
        fi
    else
        print_warning "jq가 설치되지 않아 Secrets 목록을 확인할 수 없습니다."
        print_info "수동으로 확인: gh secret list --repo=$repo_slug"
    fi
}

# 워크플로우 수동 실행
trigger_workflow() {
    local repo_slug="$1"
    
    echo
    echo -n "GitHub Actions 워크플로우를 지금 실행하시겠습니까? (y/N): "
    read -r response
    
    case "$response" in
        [yY]|[yY][eE][sS])
            print_info "워크플로우 실행 중..."
            if gh workflow run fetch_financial_news.yml --repo "$repo_slug"; then
                print_success "워크플로우 실행 요청 완료!"
                print_info "실행 상태 확인: https://github.com/$repo_slug/actions"
            else
                print_error "워크플로우 실행 실패"
            fi
            ;;
        *)
            print_info "워크플로우 실행을 건너뜁니다."
            ;;
    esac
}

# 도움말
show_usage() {
    echo "GitHub Actions Secrets 자동 등록 스크립트"
    echo
    echo "사용법:"
    echo "  $0 [owner/repo] [옵션]"
    echo
    echo "옵션:"
    echo "  -h, --help       이 도움말 표시"
    echo "  --verify-only    Secrets 설정 없이 확인만 수행"
    echo "  --no-trigger     워크플로우 수동 실행 건너뛰기"
    echo
    echo "예시:"
    echo "  $0                           # 자동 감지로 실행"
    echo "  $0 username/repo             # 특정 저장소 지정"
    echo "  $0 --verify-only             # 설정 확인만"
    echo
}

# 메인 함수
main() {
    local repo_slug=""
    local verify_only=false
    local no_trigger=false
    
    # 명령행 인자 처리
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            --verify-only)
                verify_only=true
                shift
                ;;
            --no-trigger)
                no_trigger=true
                shift
                ;;
            *)
                if [[ -z "$repo_slug" && "$1" =~ ^[^-] ]]; then
                    repo_slug="$1"
                else
                    print_error "알 수 없는 옵션: $1"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    echo "🚀 GitHub Actions Secrets 자동 설정 스크립트"
    echo "=============================================="
    echo
    
    # 사전 확인
    check_github_cli
    
    # 저장소 정보 확인
    repo_slug=$(get_repo_info "$repo_slug")
    
    # 환경변수 로드
    load_env_variables
    
    # Secrets 설정 (verify-only 모드가 아닌 경우)
    if [[ "$verify_only" != true ]]; then
        prompt_for_variables
        set_github_secrets "$repo_slug"
    fi
    
    # 설정 확인
    verify_secrets "$repo_slug"
    
    # 워크플로우 수동 실행 (no-trigger 모드가 아닌 경우)
    if [[ "$no_trigger" != true && "$verify_only" != true ]]; then
        trigger_workflow "$repo_slug"
    fi
    
    echo
    print_success "설정 완료!"
    print_info "GitHub Actions이 5분마다 자동으로 뉴스를 수집합니다."
    print_info "워크플로우 상태: https://github.com/$repo_slug/actions"
}

# 스크립트 시작점
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

