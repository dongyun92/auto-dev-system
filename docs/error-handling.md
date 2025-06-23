# 🚨 에러 핸들링 및 문제 해결 가이드

자동화 시스템 운영 중 발생할 수 있는 문제들과 해결 방법을 안내합니다.

## 🔍 빠른 문제 진단

시스템에 문제가 있다고 생각되면 먼저 헬스 체크를 실행하세요:

```bash
# 기본 상태 확인
./scripts/health-check.sh

# 자세한 로그와 함께 확인
./scripts/health-check.sh --verbose

# 자동 수정 시도
./scripts/health-check.sh --fix
```

## 🚫 자동화 차단 (Automation Blocked)

### 증상
- 새로운 이슈가 생성되지 않음
- Claude Code가 응답하지 않음
- `.automation-blocked` 파일이 존재함

### 원인별 해결법

#### 1. CI 3회 연속 실패
```bash
# 실패 원인 확인
gh workflow view --repo dongyun92/auto-dev-system

# 수동으로 문제 해결 후
rm .automation-blocked
git add .automation-blocked
git commit -m "Fix: Remove automation block after manual fix"
git push
```

#### 2. 무한루프 감지
```bash
# 중복 이슈 확인
gh issue list --label "loop-detected"

# 중복 이슈 정리 후
gh issue edit [ISSUE_NUMBER] --remove-label "loop-detected"
rm .automation-blocked
```

#### 3. 높은 리소스 사용량
```bash
# 워크플로우 실행 상태 확인
gh run list --limit 50

# 필요시 실행 중인 워크플로우 취소
gh run cancel [RUN_ID]
```

## 🔄 무한루프 문제

### 감지 신호
- 동일한 제목의 이슈가 6시간 내 5개 이상 생성
- Claude Code가 같은 작업을 반복 수행
- `loop-detected` 라벨이 붙은 이슈들

### 해결 단계

1. **즉시 중단**
   ```bash
   # 자동화 즉시 중단
   echo '{"reason":"manual_stop","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .automation-blocked
   git add .automation-blocked && git commit -m "Emergency stop" && git push
   ```

2. **원인 분석**
   ```bash
   # 최근 이슈 패턴 확인
   gh issue list --limit 20 --state all
   
   # YAML 스펙 검토
   find spec/ -name "*.yaml" -exec echo "=== {} ===" \; -exec cat {} \;
   ```

3. **정리 작업**
   ```bash
   # 중복 이슈 닫기
   gh issue close [ISSUE_NUMBERS] --comment "Duplicate due to loop detection"
   
   # 중복 PR 닫기  
   gh pr close [PR_NUMBERS] --comment "Duplicate due to system loop"
   ```

4. **재시작**
   ```bash
   # 문제 해결 후 재시작
   rm .automation-blocked
   git add . && git commit -m "Restart: Fixed loop issue" && git push
   ```

## 🐛 CI/CD 실패 처리

### 일반적인 CI 실패

#### 1. 테스트 실패
```bash
# 로컬에서 테스트 실행
npm test  # 또는 해당 프로젝트의 테스트 명령어

# 실패한 테스트 수정 후
git add . && git commit -m "Fix: Resolve test failures" && git push
```

#### 2. 빌드 실패
```bash
# 의존성 문제 확인
npm install  # 또는 해당 프로젝트의 설치 명령어

# 빌드 실행
npm run build  # 또는 해당 프로젝트의 빌드 명령어
```

#### 3. 린트/포맷 오류
```bash
# 자동 수정 시도
npm run lint:fix  # 또는 해당 프로젝트의 린트 명령어
npm run format    # 또는 해당 프로젝트의 포맷 명령어
```

### 3회 연속 실패시 (human-fix-needed)

이 상황에서는 자동화가 완전히 중단됩니다.

```bash
# 1. 실패 로그 분석
gh run view [FAILED_RUN_ID] --log

# 2. 해당 브랜치에서 수동 수정
git checkout [FAILED_BRANCH]
# 문제 수정...
git add . && git commit -m "Manual fix for CI failures"
git push

# 3. human-fix-needed 라벨 제거
gh issue edit [ISSUE_NUMBER] --remove-label "human-fix-needed"

# 4. 자동화 재개
rm .automation-blocked 2>/dev/null || true
git add . && git commit -m "Resume automation after manual fix" && git push
```

## 🤖 Claude Code 연동 문제

### Claude Code가 응답하지 않음

1. **Claude Code 상태 확인**
   ```bash
   # Claude Code 설치 확인
   claude --version
   
   # 로그인 상태 확인
   claude --status
   ```

2. **재인증**
   ```bash
   # 로그아웃 후 재로그인
   claude logout
   claude login
   ```

3. **수동 트리거**
   ```bash
   # 해당 이슈에 직접 댓글 추가
   gh issue comment [ISSUE_NUMBER] --body "@claude 이 이슈를 처리해주세요"
   ```

### Claude Code 설치 문제

```bash
# 기존 설치 제거
npm uninstall -g @anthropic-ai/claude-code

# 권한 문제 해결
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 재설치
npm install -g @anthropic-ai/claude-code
```

## 📊 대시보드 관련 문제

### 대시보드가 업데이트되지 않음

```bash
# 수동으로 대시보드 업데이트 트리거
gh workflow run dashboard-update.yml
```

### 진행률이 잘못 표시됨

```bash
# 라벨 확인 및 수정
gh issue list --label "claude-task" --state all

# 잘못된 라벨 수정
gh issue edit [ISSUE_NUMBER] --add-label "correct-label" --remove-label "wrong-label"
```

## 🔧 YAML 스펙 문제

### YAML 문법 오류

```bash
# YAML 문법 검증 (yq 설치 필요)
yq eval . spec/spec.yaml
yq eval . spec/modules/*.yaml

# 문법 오류 수정 후
git add spec/ && git commit -m "Fix YAML syntax errors" && git push
```

### 의존성 순환 참조

```bash
# 의존성 그래프 확인
grep -r "depends_on:" spec/modules/

# 순환 참조 제거 후 업데이트
git add spec/ && git commit -m "Fix circular dependency" && git push
```

## 🆘 긴급 복구 절차

시스템이 완전히 망가진 경우:

### 1. 긴급 중단
```bash
# 모든 자동화 즉시 중단
echo '{"reason":"emergency_stop","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","manual_intervention_required":true}' > .automation-blocked

# 실행 중인 워크플로우 모두 취소
gh run list --status in_progress --json databaseId --jq '.[].databaseId' | xargs -I {} gh run cancel {}

git add . && git commit -m "EMERGENCY: System shutdown" && git push
```

### 2. 상태 백업
```bash
# 현재 상태 백업
mkdir -p backup/$(date +%Y%m%d_%H%M%S)
cp -r spec/ backup/$(date +%Y%m%d_%H%M%S)/
gh issue list --state all --json number,title,state,labels > backup/$(date +%Y%m%d_%H%M%S)/issues.json
gh pr list --state all --json number,title,state > backup/$(date +%Y%m%d_%H%M%S)/prs.json
```

### 3. 선택적 복구
```bash
# 문제있는 이슈들 일괄 닫기
gh issue list --label "auto-generated" --state open --json number --jq '.[].number' | xargs -I {} gh issue close {}

# 깨끗한 상태에서 재시작
rm .automation-blocked
git add . && git commit -m "Clean restart after emergency recovery" && git push
```

## 📞 지원 요청

복구가 어려운 경우:

1. **GitHub 이슈 생성**
   - 제목: `[URGENT] System Recovery Needed`
   - 라벨: `system-alert`, `urgent`, `help-wanted`
   - 상황 설명과 시도한 해결책 포함

2. **로그 수집**
   ```bash
   # 시스템 상태 전체 로그
   ./scripts/health-check.sh --verbose > system-status.log 2>&1
   
   # 최근 워크플로우 실행 로그
   gh run list --limit 10 > recent-runs.log
   ```

3. **필수 정보**
   - 문제 발생 시간
   - 에러 메시지
   - 마지막 성공한 작업
   - 시도한 해결 방법

---

**💡 팁**: 정기적으로 `./scripts/health-check.sh`를 실행하여 시스템 상태를 모니터링하세요!