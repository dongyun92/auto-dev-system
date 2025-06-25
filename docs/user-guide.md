# 🚀 Auto-Dev System 완전 사용자 가이드

## 🎯 시스템 개요

**Auto-Dev System**은 Claude Desktop과 Claude Code를 활용한 완전 자동화 개발 시스템입니다.

### ✨ 핵심 장점
- 📝 **설계만 하면 끝**: Claude Desktop에서 설계 → 나머지는 완전 자동
- 🤖 **AI 협업**: 설계 AI + 개발 AI의 완벽한 분업
- 🛡️ **안전 보장**: 종합적인 에러 처리 및 모니터링
- 📊 **실시간 추적**: 진행상황과 품질을 실시간으로 확인

### 🔄 전체 워크플로우
```
[Claude Desktop] 설계 → [YAML 생성] → [GitHub 업로드]
    ↓
[자동 이슈 생성] → [Claude Code 개발] → [자동 PR] → [CI/CD]
    ↓
[Auto-merge] → [다음 모듈] → ... → [완성된 프로젝트] 🎉
```

---

## 🚀 빠른 시작 가이드

### 1️⃣ 필수 준비사항

#### Claude Code 설치
```bash
# Node.js 설치 확인
node --version
npm --version

# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude --version
```

#### 리포지토리 클론
```bash
git clone https://github.com/dongyun92/auto-dev-system.git
cd auto-dev-system

# 헬스체크 실행
chmod +x scripts/health-check.sh
./scripts/health-check.sh --fix
```

### 2️⃣ 첫 번째 프로젝트 생성

#### Step 1: Claude Desktop에서 설계
```
Claude Desktop에 다음과 같이 요청:

"온라인 서점 시스템을 설계해줘. 다음 기능들이 필요해:
1. 사용자 인증 (로그인/회원가입)
2. 도서 조회 및 검색
3. 장바구니 및 주문
4. 관리자 페이지

각 모듈을 YAML 스펙으로 만들어줘. Auto-Dev System의 템플릿을 참고해서."
```

#### Step 2: YAML 파일 생성
Claude Desktop이 생성한 YAML 파일들을 다음 위치에 저장:
```
spec/
├── spec.yaml          # 프로젝트 메타 정보
└── modules/
    ├── database-setup.yaml
    ├── auth-service.yaml
    ├── book-service.yaml
    ├── cart-service.yaml
    └── admin-service.yaml
```

#### Step 3: 자동화 시작
```bash
# YAML 파일들 커밋
git add spec/
git commit -m "Add bookstore project specifications"
git push

# 자동으로 이슈들이 생성됨 (2-3분 대기)
gh issue list

# 첫 번째 이슈에 Claude 멘션
gh issue comment 1 --body "@claude 이 이슈를 시작해주세요!"
```

#### Step 4: 진행상황 모니터링
```bash
# 대시보드 확인
open docs/dashboard.md

# 실시간 상태
gh issue list --label "claude-task"
gh pr list
```

---

## 📖 상세 사용법

### 🎨 프로젝트 설계하기

#### 효과적인 Claude Desktop 프롬프트
```
다음 형식으로 요청하세요:

"[프로젝트명] 시스템을 설계해줘.

**요구사항:**
- 기능 1: 상세 설명
- 기능 2: 상세 설명
- ...

**기술 스택:**
- 백엔드: Spring Boot / Node.js / Python
- 데이터베이스: PostgreSQL / MySQL
- 프론트엔드: React / Vue.js (선택사항)

**모듈 구성:**
각 주요 기능을 독립적인 모듈로 분리하고,
Auto-Dev System의 YAML 템플릿 형식으로 만들어줘.
의존성 관계도 명확히 해줘."
```

#### YAML 스펙 작성 팁
```yaml
# 좋은 예시
name: user-authentication
description: "JWT 기반 사용자 인증 및 권한 관리 시스템"
type: api_service
priority: high
estimated_hours: 4

dependencies:
  depends_on: ["database-setup"]

# 구체적인 API 명세
api_endpoints:
  - method: POST
    path: /auth/login
    description: "사용자 로그인"
    request_body:
      email: string
      password: string
    responses:
      200: "로그인 성공 (JWT 토큰 반환)"
      401: "인증 실패"

# 명확한 완료 기준
completion_criteria:
  - "모든 API 엔드포인트가 정상 작동"
  - "JWT 토큰 생성 및 검증 구현"
  - "단위 테스트 80% 이상 커버리지"
```

### 🔧 Claude Code 연동

#### 자동 연동 (권장)
시스템이 자동으로 이슈를 생성하고 Claude Code를 트리거합니다.

#### 수동 연동
```bash
# 프로젝트 디렉토리에서
claude

# Claude Code 내에서
> 이 GitHub 이슈를 처리해줘: 
> https://github.com/[USERNAME]/[REPO]/issues/[NUMBER]
>
> 새 브랜치 만들고 개발 완료 후 PR 올려줘.
```

### 📊 진행상황 추적

#### 실시간 대시보드
- **docs/dashboard.md**: 모듈별 진행상황
- **docs/monitoring-report.md**: 시스템 상태
- **README.md**: 전체 진행률 배지

#### 명령어로 확인
```bash
# 현재 상태 요약
./scripts/health-check.sh

# 이슈 상태
gh issue list --label "claude-task"

# PR 상태  
gh pr list --state open

# 워크플로우 상태
gh workflow list
```

---

## 🛠️ 고급 사용법

### 🎛️ 커스터마이징

#### 새로운 모듈 타입 추가
1. `spec/schema/module-schema.json`에 타입 정의 추가
2. `spec/templates/`에 새 템플릿 추가
3. `docs/template-guide.md` 업데이트

#### 워크플로우 수정
```bash
# Orchestrator 로직 수정
vim .github/workflows/orchestrator.yml

# 라벨 시스템 변경
vim .github/workflows/setup-labels.yml
```

### 🔀 다중 프로젝트 관리

#### 브랜치 전략
```bash
# 새 프로젝트용 브랜치
git checkout -b project/ecommerce-site
git checkout -b project/blog-platform

# 각 브랜치에서 독립적으로 개발
```

#### 워크스페이스 분리
```bash
# Git worktree 활용
git worktree add ../ecommerce-project project/ecommerce-site
git worktree add ../blog-project project/blog-platform

# 각 디렉토리에서 독립적으로 Claude Code 실행
```

### 🚀 성능 최적화

#### 병렬 개발
```yaml
# spec/spec.yaml에서 설정
orchestrator:
  max_parallel_tasks: 3  # 동시 처리할 모듈 수
  dependency_optimization: true
```

#### 캐싱 활용
```yaml
# .github/workflows/에서 의존성 캐싱
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

---

## 🚨 문제 해결

### 자주 발생하는 문제들

#### 1. Claude Code가 응답하지 않음
```bash
# 해결책
claude logout
claude login

# 수동 트리거
gh issue comment [ISSUE_NUMBER] --body "@claude 시작해주세요"
```

#### 2. 자동화가 멈춤
```bash
# 원인 확인
cat .automation-blocked 2>/dev/null || echo "차단되지 않음"

# 해결 후 재시작
rm .automation-blocked
git add . && git commit -m "Resume automation" && git push
```

#### 3. CI가 계속 실패
```bash
# 실패 로그 확인
gh run list --limit 5
gh run view [RUN_ID] --log

# 수동 수정 후
gh issue edit [ISSUE_NUMBER] --remove-label "human-fix-needed"
```

### 🆘 긴급 상황 대응

#### 시스템 완전 중단
```bash
# 모든 자동화 즉시 중단
echo '{"reason":"emergency_stop"}' > .automation-blocked
git add . && git commit -m "EMERGENCY STOP" && git push

# 실행 중인 워크플로우 취소
gh run list --status in_progress --json databaseId --jq '.[].databaseId' | xargs -I {} gh run cancel {}
```

#### 복구 절차
```bash
# 1. 상태 백업
mkdir backup-$(date +%Y%m%d)
cp -r spec/ backup-$(date +%Y%m%d)/

# 2. 문제 해결
# ... 수정 작업 ...

# 3. 재시작
rm .automation-blocked
git add . && git commit -m "Recover and restart" && git push
```

---

## 📈 모니터링 및 최적화

### 📊 성능 지표

#### 자동화 성공률
- **목표**: >95%
- **확인**: `docs/monitoring-report.md`

#### 평균 개발 시간
- **단순 CRUD**: 1-2시간
- **복잡한 로직**: 4-6시간
- **통합 작업**: 2-3시간

#### 품질 지표
- **테스트 커버리지**: >80%
- **코드 리뷰 통과율**: >90%
- **보안 스캔 통과율**: 100%

### 🔧 지속적 개선

#### 정기 점검 (주간)
```bash
# 전체 시스템 점검
./scripts/health-check.sh --verbose > weekly-report.txt

# 성능 분석
gh api repos/{owner}/{repo}/actions/runs --paginate | jq '.workflow_runs[].run_started_at' | head -20
```

#### 피드백 수집
```bash
# 성공/실패 패턴 분석
gh issue list --label "claude-task" --state closed --limit 50 | grep -E "(success|failure)"

# 사용자 만족도 추적
gh issue list --label "feedback" --state all
```

---

## 🎓 베스트 프랙티스

### 📝 설계 단계
1. **명확한 요구사항**: 구체적이고 측정 가능한 기준
2. **적절한 모듈 분할**: 한 모듈당 1-2개 주요 기능
3. **의존성 최소화**: 순환 참조 방지
4. **테스트 가능성**: 각 기능별 테스트 시나리오 포함

### 🤖 개발 단계
1. **점진적 개발**: 작은 단위로 나누어 진행
2. **지속적 검증**: 각 단계마다 테스트 확인
3. **문서화**: API 문서 자동 생성 활용
4. **코드 품질**: 린트, 포맷터 자동 적용

### 🔄 운영 단계
1. **정기 모니터링**: 일일 대시보드 확인
2. **예방적 관리**: 경고 신호 조기 대응
3. **백업 관리**: 중요 시점마다 백업
4. **업데이트**: 정기적인 시스템 업데이트

---

## 📞 지원 및 커뮤니티

### 🔗 유용한 링크
- **GitHub 리포지토리**: https://github.com/dongyun92/auto-dev-system
- **이슈 트래커**: GitHub Issues
- **문서**: `docs/` 폴더
- **템플릿**: `spec/templates/` 폴더

### 💬 도움 받기
1. **문서 먼저 확인**: `docs/error-handling.md`
2. **이슈 생성**: GitHub Issues에 `help-wanted` 라벨
3. **상세 정보 포함**: 에러 메시지, 실행 환경, 시도한 해결책

### 🤝 기여하기
1. **버그 리포트**: 재현 가능한 상세 정보
2. **기능 제안**: 구체적인 사용 사례와 함께
3. **문서 개선**: 오타 수정, 예시 추가
4. **템플릿 추가**: 새로운 프로젝트 타입

---

## 🎉 성공 사례

### 📱 Todo API (테스트 프로젝트)
- **소요 시간**: 설계 30분 + 자동 개발 2시간
- **모듈 수**: 3개 (Database, Auth, Todo)
- **성공률**: 100% 자동화

### 🛒 E-commerce 플랫폼
- **소요 시간**: 설계 2시간 + 자동 개발 1일
- **모듈 수**: 8개 (User, Product, Cart, Order, Payment, Admin, Notification, Analytics)
- **성공률**: 95% 자동화 (결제 모듈만 수동 검토)

### 📝 블로그 플랫폼
- **소요 시간**: 설계 1시간 + 자동 개발 4시간
- **모듈 수**: 5개 (Auth, Post, Comment, Media, Admin)
- **성공률**: 100% 자동화

---

**🎯 결론: 이제 당신도 "설계만 하면 끝"인 개발자가 되셨습니다!** 🚀

*Happy Coding with AI! 🤖✨*