# Auth Service

Todo 애플리케이션을 위한 JWT 기반 사용자 인증 시스템

## 기능

- 사용자 등록 및 인증
- JWT 기반 토큰 인증
- 리프레시 토큰을 통한 토큰 갱신
- 비밀번호 암호화 (BCrypt)
- 역할 기반 접근 제어

## API 엔드포인트

### 인증 API

- `POST /api/auth/register` - 사용자 등록
- `POST /api/auth/login` - 사용자 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/logout` - 사용자 로그아웃

## 기술 스택

- Spring Boot 3.2.0
- Spring Security
- JWT (JSON Web Tokens)
- PostgreSQL
- BCrypt 암호화
- Java 17

## 실행 방법

1. PostgreSQL 데이터베이스 설정
```sql
CREATE DATABASE auth_db;
CREATE USER auth_user WITH PASSWORD 'auth_password';
GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;
```

2. 애플리케이션 실행
```bash
mvn spring-boot:run
```

## 환경 설정

`application.yml`에서 다음 설정을 수정할 수 있습니다:

- 데이터베이스 연결 정보
- JWT 비밀키 및 만료 시간
- CORS 설정
- 비밀번호 정책

## 사용 예시

### 사용자 등록
```bash
curl -X POST http://localhost:8081/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123",
    "confirmPassword": "TestPass123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 로그인
```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "TestPass123"
  }'
```