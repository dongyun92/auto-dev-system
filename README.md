# Auto Development System

Claude Desktop + GitHub Actions + Claude Code를 활용한 자동 개발 시스템

## 📁 폴더 구조

```
.
├── spec/                    # 자동화 입력 (YAML 스펙)
│   ├── spec.yaml           # 프로젝트 메타 설정
│   └── modules/            # 모듈별 개발 스펙
│       ├── user-service.yaml
│       ├── auth-service.yaml
│       └── ...
├── docs/                   # 문서화 (읽기 전용)
│   ├── requirements/       # 요구사항 문서
│   ├── architecture/       # 아키텍처 다이어그램
│   └── adr/               # Architecture Decision Records
├── src/                    # 자동 생성될 소스 코드
└── .github/
    ├── workflows/          # GitHub Actions
    └── ISSUE_TEMPLATE/     # 이슈 템플릿
```

## 🚀 사용 방법

1. **설계**: Claude Desktop에서 요구사항 분석 및 설계
2. **스펙 생성**: `spec/modules/*.yaml` 파일 생성
3. **자동 실행**: GitHub에 push하면 자동으로 개발 시작
4. **결과 확인**: Claude Code가 순차적으로 모든 모듈 개발 완료

## 🔄 자동화 플로우

```
spec/ 변경 → 자동 이슈 생성 → Claude Code 개발 → PR → 테스트 → 머지 → 다음 모듈
```

## 📋 개발 단계

각 모듈은 다음 3단계로 자동 개발됩니다:

1. **Implementation**: 기본 기능 구현
2. **Testing**: 단위/통합 테스트 작성  
3. **Integration**: API 연동 및 통합 검증

## 🎯 프로젝트 상태

- [x] 기본 구조 생성
- [ ] GitHub Actions 워크플로우 설정
- [ ] Claude Code 연동 설정
- [ ] 테스트 실행
