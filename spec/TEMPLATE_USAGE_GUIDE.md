# 📝 Claude Desktop YAML 템플릿 사용 가이드

## 🎯 개요

이 가이드는 Claude Desktop에서 프로젝트 설계 후 자동화 시스템용 YAML 스펙을 생성하는 방법을 설명합니다. 제공된 템플릿을 활용하여 일관되고 완전한 모듈 명세서를 만들 수 있습니다.

## 🏗️ 설계-to-YAML 워크플로우

### 1. **요구사항 분석** (Claude Desktop)
```
사용자: "온라인 서점 시스템을 만들고 싶어요. 사용자 관리, 도서 관리, 주문 처리가 필요합니다."

Claude: 요구사항을 분석하여 다음과 같이 모듈을 나누어 설계하겠습니다:
1. 데이터베이스 설정 (database-setup)
2. 사용자 서비스 (user-service)  
3. 인증 서비스 (auth-service)
4. 도서 관리 서비스 (book-service)
5. 주문 처리 서비스 (order-service)
6. 알림 통합 서비스 (notification-integration)
```

### 2. **아키텍처 설계** (Claude Desktop)
```
사용자: "각 모듈의 역할과 의존성을 정의해주세요."

Claude: [상세한 아키텍처 설계 제공]
- 모듈 간 의존성 다이어그램
- API 설계
- 데이터베이스 스키마
- 기술 스택 선택
```

### 3. **YAML 스펙 생성** (Claude Desktop)
```
사용자: "이 설계를 바탕으로 자동화 시스템용 YAML 파일들을 생성해주세요."

Claude: [템플릿 기반 YAML 생성]
```

## 📋 템플릿 선택 가이드

### 모듈 타입별 적합한 템플릿

| 모듈 유형 | 사용할 템플릿 | 설명 |
|-----------|---------------|------|
| **REST API** | `api-service-template.yaml` | CRUD 작업, 비즈니스 로직이 있는 서비스 |
| **데이터베이스** | `database-setup-template.yaml` | 스키마 설정, 마이그레이션 |
| **인증/보안** | `auth-service-template.yaml` | 로그인, JWT, 권한 관리 |
| **프론트엔드** | `frontend-component-template.yaml` | React/Vue 컴포넌트, UI |
| **외부 연동** | `integration-service-template.yaml` | 이메일, 결제, API 통합 |
| **공통 라이브러리** | `utility-library-template.yaml` | 헬퍼 함수, 상수, 유틸리티 |

## 🛠️ Claude Desktop 프롬프트 예시

### **Template 1: API Service 생성**

#### 입력 프롬프트:
```
"api-service-template.yaml을 참조해서 도서 관리 API 서비스의 YAML 스펙을 생성해주세요.

요구사항:
- 도서 CRUD 작업 (생성, 조회, 수정, 삭제)
- 카테고리별 도서 검색
- 재고 관리
- 저자 정보 관리
- user-service와 auth-service에 의존

포함할 API 엔드포인트:
- GET /api/books (목록 조회, 페이징, 검색)
- GET /api/books/{id} (상세 조회)
- POST /api/books (도서 생성)
- PUT /api/books/{id} (도서 수정)
- DELETE /api/books/{id} (도서 삭제)
- GET /api/books/categories (카테고리 목록)
- GET /api/books/authors (저자 목록)

테이블:
- books (id, title, author, isbn, price, stock, category_id, created_at, updated_at)
- categories (id, name, description)
- authors (id, name, bio, birth_date)

파일명: book-service.yaml"
```

#### 예상 출력:
```yaml
name: "book-service"
description: "도서 정보 및 재고 관리를 위한 REST API 서비스"
version: "1.0.0"
module_type: "api"
priority: "high"

depends_on:
  - "database-setup"
  - "user-service"
  - "auth-service"

tech_stack:
  - "spring-boot"
  - "spring-data-jpa"
  - "postgresql"
  - "elasticsearch"  # 검색 기능
  - "junit"

endpoints:
  - method: "GET"
    path: "/api/books"
    description: "도서 목록 조회 (검색, 필터링, 페이징 지원)"
    auth_required: false
    # ... 세부 설정
```

### **Template 2: Database Setup 생성**

#### 입력 프롬프트:
```
"database-setup-template.yaml을 참조해서 온라인 서점 프로젝트의 데이터베이스 설정 YAML을 생성해주세요.

필요한 테이블:
1. users (사용자 정보)
2. roles (역할 관리)
3. user_roles (사용자-역할 관계)
4. books (도서 정보)
5. categories (도서 카테고리)
6. authors (저자 정보)
7. orders (주문 정보)
8. order_items (주문 상세)
9. reviews (리뷰)
10. audit_logs (감사 로그)

PostgreSQL 사용, Flyway 마이그레이션
파일명: database-setup.yaml"
```

### **Template 3: Integration Service 생성**

#### 입력 프롬프트:
```
"integration-service-template.yaml을 참조해서 결제 통합 서비스 YAML을 생성해주세요.

요구사항:
- 여러 결제 수단 지원 (신용카드, PayPal, 무통장입금)
- 결제 상태 추적
- 환불 처리
- 외부 PG사 연동 (Stripe, PayPal)
- 결제 실패시 재시도 로직
- order-service에 의존

API 엔드포인트:
- POST /api/payments/process (결제 처리)
- GET /api/payments/{id}/status (결제 상태 조회)
- POST /api/payments/{id}/refund (환불 처리)
- POST /api/payments/webhooks (외부 알림 수신)

파일명: payment-integration.yaml"
```

## 🎨 커스터마이징 가이드

### **템플릿 수정 시 주의사항**

1. **필수 필드 유지**
   ```yaml
   # 반드시 포함해야 할 필드들
   name: "module-name"
   description: "모듈 설명"
   version: "1.0.0"
   module_type: "api|database|auth|frontend|integration|utility"
   ```

2. **의존성 정확히 명시**
   ```yaml
   depends_on:
     - "database-setup"  # 정확한 모듈명 사용
     - "auth-service"
   ```

3. **엔드포인트 형식 준수**
   ```yaml
   endpoints:
     - method: "GET|POST|PUT|DELETE"
       path: "/api/..."
       description: "설명"
       auth_required: true|false
   ```

### **프로젝트별 공통 설정**

#### **기술 스택 통일**
```yaml
# 모든 API 서비스에서 공통 사용
tech_stack:
  - "spring-boot"
  - "postgresql"
  - "jwt"
  - "junit"
```

#### **보안 설정 통일**
```yaml
security:
  authentication: "jwt"
  authorization: ["USER", "ADMIN"]
  sensitive_data: true
```

#### **모니터링 설정 통일**
```yaml
monitoring:
  logging:
    level: "INFO"
    format: "json"
```

## 📁 파일 구조 및 네이밍

### **권장 파일 구조**
```
spec/modules/
├── 01-database-setup.yaml      # 우선순위 순서
├── 02-common-utils.yaml
├── 03-auth-service.yaml
├── 04-user-service.yaml
├── 05-book-service.yaml
├── 06-order-service.yaml
├── 07-payment-integration.yaml
└── 08-notification-integration.yaml
```

### **네이밍 규칙**
- **모듈명**: `kebab-case` (예: `user-service`, `auth-service`)
- **파일명**: `{모듈명}.yaml` 또는 `{순서}-{모듈명}.yaml`
- **엔드포인트**: `/api/{resource}` 패턴

## ✅ 검증 체크리스트

### **YAML 생성 후 확인사항**

#### **🔍 기본 검증**
- [ ] 모든 필수 필드 포함 (`name`, `description`, `version`, `module_type`)
- [ ] 의존성 모듈명이 정확한지 확인
- [ ] YAML 문법 오류 없음
- [ ] 스키마 준수 (`spec/schema/module-schema.json` 기준)

#### **🎯 설계 검증**
- [ ] API 엔드포인트가 RESTful 규칙 준수
- [ ] 데이터베이스 스키마가 정규화됨
- [ ] 보안 요구사항이 적절히 설정됨
- [ ] 성능 요구사항이 현실적임

#### **🔄 의존성 검증**
- [ ] 순환 의존성 없음
- [ ] 의존 모듈이 먼저 개발될 수 있는 구조
- [ ] 외부 서비스 의존성 최소화

## 🚀 다음 단계

YAML 파일 생성 완료 후:

1. **spec/modules/ 폴더에 업로드**
2. **Git 커밋 & 푸시**
3. **Orchestrator 자동 실행 확인**
4. **생성된 이슈들 모니터링**
5. **Claude Code 자동 개발 시작**

## 💡 팁과 베스트 프랙티스

### **효율적인 설계 접근법**
1. **큰 그림부터**: 전체 시스템 아키텍처 먼저 설계
2. **의존성 우선**: 의존성이 적은 모듈부터 설계
3. **재사용성 고려**: 공통 기능은 utility로 분리
4. **단계적 구현**: 핵심 기능부터 점진적 확장

### **템플릿 활용 요령**
1. **기본 템플릿에서 시작**: 가장 유사한 템플릿 선택
2. **점진적 수정**: 한 번에 모든 걸 바꾸지 말고 단계적으로
3. **일관성 유지**: 프로젝트 내에서 설정 스타일 통일
4. **문서화**: 커스터마이징한 부분은 주석으로 설명

## 🆘 문제 해결

### **자주 발생하는 문제들**

#### **Problem 1: YAML 파싱 에러**
```
Error: yaml: line 15: could not find expected ':'
```
**해결**: YAML 문법 검사 (들여쓰기, 콜론 위치 확인)

#### **Problem 2: 스키마 검증 실패**
```
Error: Required field 'description' is missing
```
**해결**: JSON Schema 준수 확인 (`spec/schema/module-schema.json`)

#### **Problem 3: 순환 의존성**
```
Error: Circular dependency detected: user-service -> auth-service -> user-service
```
**해결**: 의존성 구조 재설계, 공통 모듈 분리

---

**Happy Designing! 🎨**

이 가이드를 따라하면 Claude Desktop에서 설계한 내용을 자동화 시스템이 이해할 수 있는 표준 YAML 스펙으로 변환할 수 있습니다.
