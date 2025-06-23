# Documentation

이 폴더는 프로젝트 문서화를 위한 공간입니다.

## 📁 폴더 별 용도

### `requirements/`
- 비즈니스 요구사항
- 기능 명세서
- 사용자 스토리

### `architecture/`
- 시스템 아키텍처 다이어그램
- 데이터베이스 스키마
- API 설계서

### `adr/` (Architecture Decision Records)
- 아키텍처 결정 기록
- 기술 선택 이유
- 설계 변경 히스토리

## ⚠️ 중요사항

**docs/ 폴더의 파일들은 자동화 시스템에 직접적으로 영향을 주지 않습니다.**

자동 개발에 영향을 주려면 반드시 `spec/` 폴더의 YAML 파일을 수정하세요.

## 📝 작성 가이드

1. **Markdown 포맷** 사용
2. **이미지는 `images/` 서브폴더**에 저장
3. **다이어그램은 Mermaid** 형식 권장
4. **파일명은 날짜 포함** (예: `2024-06-23-user-requirements.md`)
