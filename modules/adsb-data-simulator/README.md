# ADSB Data Simulator

FlightRadar24 실시간 데이터를 시뮬레이션하는 ADSB(Automatic Dependent Surveillance-Broadcast) 시스템

## 기능

- 김포공항 주변 항공기 실시간 데이터 조회
- 특정 콜사인으로 항공기 검색
- 지정된 좌표 반경 내 항공기 검색
- 가상 항공기 데이터 시뮬레이션
- WebSocket을 통한 실시간 데이터 스트리밍

## API 엔드포인트

### REST API

- `GET /api/adsb/aircraft` - 김포공항 지역의 모든 항공기 데이터 조회
- `GET /api/adsb/aircraft/{callsign}` - 특정 항공기 상세 데이터 조회
- `GET /api/adsb/aircraft/area/{latitude}/{longitude}/{radius}` - 지정된 좌표 반경 내 항공기 데이터 조회
- `POST /api/adsb/simulate` - 가상 항공기 데이터 생성

### WebSocket

- `WebSocket /ws/adsb/realtime` - 실시간 항공기 데이터 스트리밍

## 기술 스택

- Spring Boot 3.2.0
- PostgreSQL
- Spring WebSocket
- Spring Data JPA
- Java 17

## 실행 방법

1. PostgreSQL 데이터베이스 설정
```sql
CREATE DATABASE adsb_db;
CREATE USER adsb_user WITH PASSWORD 'adsb_password';
GRANT ALL PRIVILEGES ON DATABASE adsb_db TO adsb_user;
```

2. 애플리케이션 실행
```bash
mvn spring-boot:run
```

## 환경 설정

`application.yml`에서 다음 설정을 수정할 수 있습니다:

- 데이터베이스 연결 정보
- 김포공항 좌표 및 반경
- 시뮬레이션 업데이트 주기
- FlightRadar24 API 설정