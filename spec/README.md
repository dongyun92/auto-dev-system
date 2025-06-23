# 📋 YAML 템플릿 시스템

## 🎯 개요

이 폴더는 Auto Development System에서 사용하는 모듈 명세서 YAML 템플릿들을 포함합니다. Claude Desktop에서 설계한 내용을 표준화된 YAML 스펙으로 변환할 때 이 템플릿들을 참조하여 일관되고 완전한 명세서를 생성할 수 있습니다.

## 📁 폴더 구조

```
spec/
├── schema/                          # 스키마 정의
│   └── module-schema.json          # JSON Schema 스펙
├── templates/                       # 템플릿 모음
│   ├── api-service-template.yaml   # REST API 서비스
│   ├── database-setup-template.yaml # 데이터베이스 설정
│   ├── auth-service-template.yaml  # 인증/보안 서비스
│   ├── frontend-component-template.yaml # 프론트엔드 컴포넌트
│   ├── integration-service-template.yaml # 외부 통합 서비스
│   └── utility-library-template.yaml # 공통 유틸리티
├── modules/                         # 실제 프로젝트 스펙 (사용자 생성)
│   └── README.md                   # 모듈 작성 가이드
└── TEMPLATE_USAGE_GUIDE.md        # 템플릿 사용법 상세 가이드
```

## 🛠️ 템플릿 종류

### 📊 **템플릿 선택 매트릭스**

| 구현하려는 기능 | 사용할 템플릿 | 주요 특징 |
|----------------|---------------|----------|
| **REST API 서비스** | `api-service-template.yaml` | CRUD, 비즈니스 로직, 데이터베이스 연동 |
| **데이터베이스 스키마** | `database-setup-template.yaml` | 테이블 정의, 마이그레이션, 인덱스 |
| **로그인/인증 시스템** | `auth-service-template.yaml` | JWT, OAuth, 세션 관리, 보안 |
| **웹 UI/컴포넌트** | `frontend-component-template.yaml` | React/Vue, 컴포넌트, 라우팅 |
| **외부 API 연동** | `integration-service-template.yaml` | 이메일, 결제, 알림, 써드파티 |
| **공통 기능/헬퍼** | `utility-library-template.yaml` | 유틸리티, 상수, 공통 함수 |

## 🚀 빠른 시작

### **1단계: 요구사항 분석**
Claude Desktop에서 프로젝트 요구사항을 분석하고 필요한 모듈들을 식별합니다.

### **2단계: 템플릿 선택**
각 모듈의 성격에 맞는 템플릿을 선택합니다.

### **3단계: YAML 생성**
```
사용자: "api-service-template.yaml을 참조해서 사용자 관리 API 서비스 YAML을 생성해주세요."

Claude Desktop: [템플릿 기반 맞춤형 YAML 생성]
```

### **4단계: 파일 업로드**
생성된 YAML 파일을 `spec/modules/` 폴더에 업로드합니다.

### **5단계: 자동화 시작**
커밋/푸시하면 Orchestrator가 자동으로 이슈를 생성하고 Claude Code가 개발을 시작합니다.

## 📋 템플릿 상세 정보

### 🌐 **API Service Template**
```yaml
# 적용 사례
- 사용자 관리 API
- 제품 카탈로그 API  
- 주문 처리 API
- 블로그/CMS API

# 주요 섹션
- endpoints: REST API 엔드포인트 정의
- database: 테이블 스키마
- tests: 테스트 요구사항
- security: 인증/권한 설정
```

### 🗄️ **Database Setup Template**
```yaml
# 적용 사례
- 초기 데이터베이스 스키마
- 마이그레이션 스크립트
- 인덱스 최적화
- 감사 로그 테이블

# 주요 섹션
- database.tables: 테이블 정의
- database.migrations: 마이그레이션 파일
- performance: 쿼리 성능 요구사항
```

### 🔐 **Auth Service Template**
```yaml
# 적용 사례
- JWT 기반 인증
- OAuth 연동
- 비밀번호 관리
- 세션 관리

# 주요 섹션
- endpoints: 인증 관련 API
- security: 보안 설정
- external_integrations: OAuth 제공자
```

### 🎨 **Frontend Component Template**
```yaml
# 적용 사례
- React 대시보드
- Vue.js 컴포넌트
- 관리자 패널
- 사용자 인터페이스

# 주요 섹션
- components: 컴포넌트 구조
- routes: 페이지 라우팅
- ui_requirements: UI/UX 요구사항
```

### 🔗 **Integration Service Template**
```yaml
# 적용 사례
- 이메일 발송 시스템
- 결제 처리 연동
- 푸시 알림 서비스
- 외부 API 통합

# 주요 섹션
- external_integrations: 외부 서비스 설정
- reliability: 신뢰성 요구사항
- monitoring: 통합 모니터링
```

### ⚙️ **Utility Library Template**
```yaml
# 적용 사례
- 공통 헬퍼 함수
- 데이터 검증 유틸
- 암호화/보안 함수
- 날짜/시간 처리

# 주요 섹션
- utility_functions: 함수 목록
- constants: 상수 정의
- performance: 성능 요구사항
```

## 🎨 커스터마이징 가이드

### **기본 수정 패턴**
```yaml
# 1. 프로젝트 정보 수정
name: "your-module-name"
description: "모듈 설명"
version: "1.0.0"

# 2. 의존성 설정
depends_on:
  - "database-setup"
  - "auth-service"

# 3. 기술 스택 선택
tech_stack:
  - "spring-boot"  # Java
  - "fastapi"      # Python
  - "express"      # Node.js
```

### **섹션별 주의사항**

#### **✅ 필수 섹션 (모든 템플릿)**
- `name`: 모듈명 (kebab-case)
- `description`: 모듈 설명
- `version`: 시맨틱 버전
- `module_type`: 모듈 타입

#### **⚠️ 선택적 섹션**
- `endpoints`: API 모듈만
- `database`: 데이터베이스 관련 모듈만
- `components`: 프론트엔드 모듈만
- `external_integrations`: 통합 서비스만

## 📏 JSON Schema 검증

### **스키마 파일 위치**
```
spec/schema/module-schema.json
```

### **검증 도구 사용**
```bash
# Online JSON Schema Validator 사용
# 또는 VS Code의 YAML extension에서 자동 검증
```

### **자주 발생하는 검증 오류**
```yaml
# ❌ 잘못된 예시
name: "User Service"  # 공백 포함 불가
version: "v1.0"       # 시맨틱 버전 아님
method: "get"         # 대문자 필요

# ✅ 올바른 예시  
name: "user-service"
version: "1.0.0"
method: "GET"
```

## 🔄 워크플로우 통합

### **Orchestrator 연동**
```yaml
# spec/ 폴더의 YAML 파일 변경시 자동 트리거
# 1. YAML 파싱
# 2. 의존성 해결
# 3. 순차적 이슈 생성
```

### **Claude Code 연동**
```yaml
# 생성된 이슈에서 템플릿 정보 참조
# 1. 모듈 타입에 따른 코드 생성 전략
# 2. 테스트 요구사항 반영
# 3. 품질 게이트 적용
```

## 📚 추가 리소스

### **문서 링크**
- 📖 [상세 사용법 가이드](./TEMPLATE_USAGE_GUIDE.md)
- 🔧 [Claude Code 연동 가이드](../.github/CLAUDE_CODE_GUIDE.md)
- 📋 [GitHub Actions 워크플로우](../.github/WORKFLOWS.md)

### **예시 프로젝트**
- 🏪 온라인 서점 시스템
- 📝 블로그 플랫폼
- 👥 사용자 관리 시스템
- 💳 결제 처리 시스템

## 🆘 문제 해결

### **자주 묻는 질문**

#### **Q: 새로운 모듈 타입 템플릿이 필요한가요?**
A: 기존 템플릿을 조합하거나 가장 유사한 템플릿을 커스터마이징하세요. 필요시 새 템플릿 제안 가능합니다.

#### **Q: 의존성 순서가 중요한가요?**
A: 네, Orchestrator가 의존성 순서대로 이슈를 생성합니다. 순환 의존성은 피해야 합니다.

#### **Q: 템플릿을 수정해도 되나요?**
A: 프로젝트별 필요에 따라 자유롭게 수정 가능합니다. 단, JSON Schema는 준수해야 합니다.

### **지원 채널**
- 🐛 버그 리포트: GitHub Issues
- 💡 기능 제안: GitHub Discussions  
- 📚 문서 개선: Pull Request

---

## 🎉 시작하기

1. **요구사항 정의** → Claude Desktop에서 프로젝트 분석
2. **템플릿 선택** → 위 매트릭스 참조
3. **YAML 생성** → Claude Desktop으로 템플릿 기반 생성
4. **파일 업로드** → `spec/modules/`에 저장
5. **자동화 시작** → 커밋/푸시로 파이프라인 시작

**Happy Coding! 🚀**
