# 🛡️ 안전장치 및 모니터링 시스템 개요

자동화 시스템의 안정적 운영을 위한 종합적인 안전장치와 모니터링 시스템입니다.

## 🎯 구축된 시스템 구성요소

### 1. 🚨 CI 실패 감지 및 대응
- **파일**: `.github/workflows/ci-failure-handler.yml`
- **기능**: 
  - 3회 연속 실패시 자동화 차단
  - 실패 횟수 추적 및 라벨링
  - 자동 복구 메커니즘
- **트리거**: CI 워크플로우 완료시

### 2. 📊 실시간 진행상황 대시보드
- **파일**: `.github/workflows/dashboard-update.yml`
- **기능**:
  - 모듈별 진행상황 추적
  - 실시간 배지 업데이트
  - 이슈/PR 상태 모니터링
- **트리거**: 이슈/PR 변경시, 30분마다

### 3. 🔄 무한루프 방지 시스템
- **파일**: `.github/workflows/loop-prevention.yml`
- **기능**:
  - 중복 이슈 생성 감지
  - 리소스 사용량 모니터링
  - 자동 정리 및 차단
- **트리거**: 6시간마다, 이슈/PR 생성시

### 4. 🏥 시스템 헬스체크 도구
- **파일**: `scripts/health-check.sh`
- **기능**:
  - 전체 시스템 상태 점검
  - 자동 수정 기능
  - 상세 진단 리포트
- **사용법**: `./scripts/health-check.sh [--fix] [--verbose]`

### 5. 📖 종합 에러 처리 가이드
- **파일**: `docs/error-handling.md`
- **내용**:
  - 문제별 해결 방법
  - 긴급 복구 절차
  - 트러블슈팅 가이드

### 6. 📈 지속적 모니터링 시스템
- **파일**: `.github/workflows/monitoring-alerts.yml`
- **기능**:
  - 15분마다 시스템 상태 체크
  - 상태 점수 계산 (0-100%)
  - 자동 알림 생성
  - 히스토리 추적

## 🎛️ 상태 지표 및 임계값

### 시스템 상태 점수 (0-100%)
- **90-100%**: ✅ 정상 (Healthy)
- **70-89%**: ⚠️ 주의 (Warning)  
- **0-69%**: 🚨 심각 (Critical)

### 자동 차단 조건
- CI 3회 연속 실패
- 6시간 내 동일 이슈 5개 이상 생성
- 1시간 내 워크플로우 50회 이상 실행

### 알림 레벨
- **INFO**: 정상 상태 변경
- **WARNING**: 주의 필요한 상황
- **CRITICAL**: 즉시 개입 필요

## 🔧 주요 명령어

### 헬스체크
```bash
# 기본 상태 확인
./scripts/health-check.sh

# 자동 수정 포함
./scripts/health-check.sh --fix --verbose
```

### 긴급 차단
```bash
# 시스템 즉시 중단
echo '{"reason":"manual_stop","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .automation-blocked
git add . && git commit -m "Emergency stop" && git push
```

### 차단 해제
```bash
# 문제 해결 후 재개
rm .automation-blocked
git add . && git commit -m "Resume automation" && git push
```

### 상태 확인
```bash
# GitHub CLI를 통한 빠른 확인
gh issue list --label "system-alert,urgent"
gh workflow list --all
```

## 📊 모니터링 대시보드

### 실시간 상태
- **README.md**: 시스템 상태 배지
- **docs/dashboard.md**: 상세 진행상황
- **docs/monitoring-report.md**: 실시간 모니터링 데이터

### 히스토리 데이터
- **docs/monitoring-history.json**: 7일간 상태 데이터
- **docs/health-check-*.md**: 정기 헬스체크 리포트

## 🚨 알림 유형

### 자동 생성 이슈
- **🚨 CRITICAL**: 시스템 심각 문제
- **⚠️ Loop Detection**: 무한루프 감지
- **🔧 CI Failures**: 연속 실패 감지

### 라벨 시스템
- `system-alert`: 시스템 관련 알림
- `critical-alert`: 즉시 조치 필요
- `human-fix-needed`: 수동 개입 필요
- `loop-detected`: 무한루프 감지됨
- `automation-blocked`: 자동화 차단됨

## ⚡ 빠른 대응 체크리스트

### 시스템이 멈췄을 때
1. ✅ `.automation-blocked` 파일 확인
2. ✅ 최근 에러 이슈 확인 (`gh issue list --label urgent`)
3. ✅ 헬스체크 실행 (`./scripts/health-check.sh`)
4. ✅ 에러 가이드 참조 (`docs/error-handling.md`)

### 무한루프 감지시
1. ✅ 중복 이슈들 확인 및 정리
2. ✅ YAML 스펙 검토
3. ✅ `loop-detected` 라벨 제거
4. ✅ 자동화 재시작

### CI 연속 실패시
1. ✅ 실패 로그 분석
2. ✅ 수동으로 문제 수정
3. ✅ `human-fix-needed` 라벨 제거
4. ✅ 차단 해제

## 🎯 성공 지표

### 가용성 목표
- **시스템 가동률**: >95%
- **평균 복구 시간**: <30분
- **자동 복구율**: >80%

### 품질 지표
- **거짓 양성**: <5%
- **미감지 오류**: <1%
- **알림 응답시간**: <15분

---

**💡 일일 체크**: 매일 `docs/dashboard.md`와 `docs/monitoring-report.md`를 확인하여 시스템 상태를 모니터링하세요!