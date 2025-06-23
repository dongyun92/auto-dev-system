# 🧠 Claude Code 연동 가이드

## 📋 개요

이 문서는 Auto Development System과 Claude Code의 연동 방법을 설명합니다. 설정이 완료되면 자동 생성된 이슈를 Claude Code가 자동으로 인식하고 개발을 시작합니다.

## 🛠️ 연동 구성 요소

### 1. 🎯 핵심 설정 파일

| 파일 | 역할 | 설명 |
|------|------|------|
| `.github/claude-code.yml` | Claude Code 설정 | 트리거 조건, 개발 표준, 품질 게이트 등 |
| `.github/pull_request_template.md` | PR 템플릿 | 자동 생성된 PR의 표준 형식 |
| `.github/ISSUE_TEMPLATE/auto-dev-task.yml` | 이슈 템플릿 | Claude 작업용 이슈 구조 |

### 2. 🔄 자동화 워크플로우

| 워크플로우 | 트리거 | 기능 |
|------------|--------|------|
| `claude-trigger.yml` | 이슈 생성/라벨링 | Claude Code 자동 트리거 |
| `auto-labeling.yml` | 이슈/PR 생성 | 스마트 라벨 자동 할당 |
| `setup-labels.yml` | 수동/자동 | 필요한 라벨 생성/관리 |

## 🎯 Claude Code 트리거 방식

### 1. ✨ 자동 트리거 (권장)

```mermaid
graph TD
    A[Orchestrator가 이슈 생성] --> B[auto-generated + claude-task 라벨 확인]
    B --> C[의존성 검사]
    C --> D[Claude 트리거 워크플로우 실행]
    D --> E[in-progress 라벨 추가]
    E --> F[@claude 멘션 코멘트 생성]
    F --> G[Claude Code 작업 시작]
```

**조건:**
- ✅ 이슈에 `auto-generated` + `claude-task` 라벨
- ✅ `blocked` 또는 `human-intervention` 라벨 없음
- ✅ 의존성 조건 충족

### 2. 🖱️ 수동 트리거

이슈 코멘트에서 다음 중 하나 입력:
- `@claude`
- `@claude begin`
- `@claude start`
- `@claude please begin work`

## 📝 Claude Code 설정 세부사항

### 🎯 개발 표준

```yaml
# .github/claude-code.yml 주요 설정
development_standards:
  code_style:
    - "Follow Google Java Style Guide"
    - "Use meaningful variable and method names"
    - "Add comprehensive Javadoc comments"
  testing:
    - "Minimum 80% code coverage"
    - "Unit tests for all public methods"
    - "Integration tests for API endpoints"
  documentation:
    - "Update API documentation"
    - "Add README for each module"
```

### 🏷️ 라벨 시스템

#### 자동화 라벨
- `auto-generated`: 자동 생성된 컨텐츠
- `claude-task`: Claude Code 처리 대상
- `orchestrator`: Orchestrator 시스템 관련

#### 개발 단계 라벨  
- `dev`, `implementation`: 구현 단계
- `test`, `quality`: 테스트 단계
- `integration`, `api`: 통합 단계

#### 상태 라벨
- `in-progress`: 작업 진행 중
- `review-needed`: 리뷰 필요
- `blocked`: 의존성으로 인한 블록
- `completed`: 작업 완료

#### 에러/이슈 라벨
- `ci-failed`: CI 검사 실패
- `human-intervention`: 사람 개입 필요
- `retry-needed`: 재시도 필요

## 🔧 설정 단계

### 1. 📋 필수 라벨 생성

라벨 자동 생성 워크플로우 실행:
```bash
# GitHub Actions에서 수동 실행
Actions > Label Management - Setup Required Labels > Run workflow
```

### 2. 🔑 권한 설정

Repository Settings에서 다음 확인:
- ✅ Actions: Read and write permissions
- ✅ Allow GitHub Actions to create and approve pull requests
- ✅ Issues: Write permissions

### 3. 🧪 연동 테스트

#### Step 1: 테스트 이슈 생성
```markdown
제목: [IMPLEMENTATION] test-module - Basic API Implementation
라벨: auto-generated, claude-task, implementation
```

#### Step 2: 자동 트리거 확인
- 이슈 생성 후 1-2분 내에 `in-progress` 라벨 추가됨
- Claude 멘션 코멘트 자동 생성됨

#### Step 3: Claude Code 응답 확인
- Claude Code가 이슈에 응답
- 브랜치 생성 및 작업 시작

## 🚨 문제 해결

### 문제 1: Claude Code가 트리거되지 않음

**원인 분석:**
1. 라벨 확인: `auto-generated` + `claude-task` 있는지
2. 블로킹 라벨: `blocked`, `human-intervention` 없는지  
3. 권한 확인: Repository Actions 권한 설정
4. Claude Code 활성화: Repository에서 Claude Code 사용 설정

**해결방법:**
```bash
# 수동 트리거 시도
# 이슈 코멘트에 입력:
@claude please begin work on this task
```

### 문제 2: 라벨이 자동으로 생성되지 않음

**해결방법:**
```bash
# 라벨 설정 워크플로우 수동 실행
Actions > Label Management > Run workflow
```

### 문제 3: PR이 자동 머지되지 않음

**원인 및 해결:**
1. CI 실패: 테스트/빌드 오류 수정
2. 브랜치 보호: Settings > Branches에서 규칙 확인
3. Auto-merge 비활성화: PR에서 Enable auto-merge 확인

## 📊 모니터링 대시보드

### GitHub Actions 로그에서 확인 가능한 항목:
- ✅ Orchestrator 실행 상태
- ✅ 이슈 생성 현황  
- ✅ Claude 트리거 성공/실패
- ✅ 라벨링 작업 상태
- ✅ Auto-merge 진행 상황

### Issues/PRs에서 추적:
- 🏷️ 라벨별 작업 상태
- 📊 완료된 모듈 수
- ⏱️ 평균 개발 시간
- 🔄 파이프라인 진행률

## 🎯 성공 지표

### 완전 자동화 달성시:
- ✅ spec/ YAML 업로드 → 자동 이슈 생성
- ✅ 이슈 생성 → Claude Code 자동 트리거  
- ✅ 개발 완료 → PR 자동 생성
- ✅ CI 통과 → 자동 머지
- ✅ 머지 완료 → 다음 태스크 자동 트리거

**결과**: 🎉 **설계만 하고 나머지는 완전 자동!**

---

## 🆘 지원

문제 발생시:
1. 📋 GitHub Actions 로그 확인
2. 🏷️ 이슈/PR 라벨 상태 점검  
3. 🔧 `.github/claude-code.yml` 설정 검토
4. 🤖 수동 `@claude` 멘션으로 트리거 시도

**Happy Coding! 🚀**
