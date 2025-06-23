# GitHub Actions 워크플로우

이 폴더에는 자동화 시스템의 핵심인 GitHub Actions 워크플로우가 위치합니다.

## 주요 워크플로우

### `orchestrator.yml`
- spec/ 폴더 변경 감지
- YAML 파싱 및 검증
- 순차적 개발 이슈 생성

### `auto-merge.yml`
- PR 자동 머지
- CI 통과 확인
- 품질 게이트 검증

### `monitor.yml`
- 시스템 상태 모니터링
- 실패 감지 및 알림
- 진행상황 대시보드

## 설정 요구사항

다음 GitHub Secrets이 필요합니다:
- `CLAUDE_API_KEY`: Claude API 접근키
- `PAT_TOKEN`: Personal Access Token (repo 권한)

## 트리거 조건

- `spec/**` 경로 파일 변경시 자동 실행
- Issue 코멘트 기반 수동 트리거
- 정기 실행 (모니터링용)
