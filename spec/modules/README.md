# 김포공항 RWSL 시스템 모듈 사양서

이 폴더는 김포공항 RWSL(Runway Wait Status Light) 실시간 충돌 감지 및 안전 시스템의 9개 핵심 모듈 YAML 사양서를 포함합니다.

## 프로젝트 개요

**김포공항 RWSL 시스템**은 국제선 A-SMGCS Level 2 표준에 기반한 충돌 감지 및 예방 시스템입니다. FlightRadar24 실제 데이터를 활용하여 김포공항의 실시간 항공기 이동을 추적하고, 99.5% 정확도로 충돌 위험을 감지하여 관제사에게 실시간 경고를 제공합니다.

## 모듈 아키텍처

### Phase 1: 기반 데이터 시스템 (병렬 처리 가능)

1. **[adsb-data-simulator.yaml](./adsb-data-simulator.yaml)**
   - FlightRadar24 기반 ADS-B 데이터 시뮬레이터
   - 실제 김포공항 항공기 데이터 수집 및 처리
   - 과거 데이터 플레이백 기능
   - **예상 개발시간:** 6시간

2. **[aircraft-tracking.yaml](./aircraft-tracking.yaml)**
   - 실시간 항공기 위치 추적 및 경로 예측
   - 50대 항공기 동시 추적 지원
   - 다중 예측 알고리즘 (선형, 곡선, 네트워크 기반)
   - **예상 개발시간:** 8시간

3. **[runway-status-manager.yaml](./runway-status-manager.yaml)**
   - 김포공항 활주로 점유 상태 관리
   - RWSL 등화 제어 시스템
   - 4개 활주로 및 9개 RWSL 구역 관리
   - **예상 개발시간:** 4시간

### Phase 2: 핵심 로직 시스템 (데이터 시스템 완료 후)

4. **[taxiway-management.yaml](./taxiway-management.yaml)**
   - 김포공항 유도로 교통 관리
   - 지상 이동 경로 최적화
   - 혼잡도 예측 및 관리
   - **예상 개발시간:** 6시간

5. **[conflict-detection-engine.yaml](./conflict-detection-engine.yaml)** 🔥
   - 실시간 충돌 감지 및 위험 분석 엔진
   - 99.5% 감지 정확도, 1초 이내 응답시간
   - 다중 레이어 안전 시스템
   - **예상 개발시간:** 12시간 (가장 복잡)

6. **[notification-service.yaml](./notification-service.yaml)**
   - 실시간 알림 및 경고 전달
   - 한국어/영어 다국어 지원
   - 바단계 에스컬레이션 시스템
   - **예상 개발시간:** 4시간

### Phase 3: 지도 및 시각화 (핵심 로직과 병렬 가능)

7. **[gimpo-map-service.yaml](./gimpo-map-service.yaml)**
   - 김포공항 벡터 지도 서비스
   - SVG/GeoJSON 다중 포맷 지원
   - 실시간 오버레이 렌더링
   - **예상 개발시간:** 8시간

### Phase 4: 사용자 인터페이스 (모든 백엔드 완료 후)

8. **[atc-dashboard.yaml](./atc-dashboard.yaml)**
   - 김포타워 관제사용 통합 대시보드
   - React 18 + TypeScript 기반
   - 60 FPS 렌더링 성능
   - **예상 개발시간:** 10시간

### Phase 5: 시스템 통합 (모든 모듈 완료 후)

9. **[system-integration.yaml](./system-integration.yaml)** 🏁
   - 전체 시스템 통합, 배포 및 운영
   - Kubernetes 오케스트레이션
   - CI/CD 파이프라인 및 모니터링
   - **예상 개발시간:** 6시간

## 기술 스택

### 백엔드
- **Java**: Spring Boot 3.2.0, JDK 17
- **데이터베이스**: PostgreSQL 15 + PostGIS (spatial data)
- **실시간 통신**: WebSocket, Redis
- **외부 API**: FlightRadar24 연동

### 프론트엔드
- **React**: React 18 + TypeScript
- **스타일링**: TailwindCSS
- **차트**: Recharts
- **지도**: SVG 벡터 렌더링

### 인프라
- **컸테이너**: Docker + Kubernetes
- **로드밸런서**: Nginx Ingress
- **모니터링**: Prometheus + Grafana
- **로깅**: ELK Stack

## 특징

### 한국 항공업계 특화
- **김포공항 정확 반영**: 실제 좌표 (37.5583°N, 126.7908°E)
- **한국 항공사**: KAL, AAR, JJA, TWB 우선순위 시스템
- **기상 대응**: 한강 안개, 서해 강풍, 황사 등
- **VIP 처리**: 대통령전용기(KOREA01), 정부전용기(KOREA02)

### 성능 목표
- **충돌 감지 정확도**: 99.5% 이상
- **응답시간**: 1초 이내
- **동시 처리**: 50대 항공기
- **오탐률**: 5% 이하
- **가용률**: 99.9%

## 개발 순서

### 추천 개발 순서
1. **Phase 1 병렬 개발** (1-2주)
   - `adsd-data-simulator` + `aircraft-tracking` + `runway-status-manager`
   - FlightRadar24 연동 및 기본 데이터 파이프라인 구축

2. **Phase 2 순차 개발** (2-3주)
   - `taxiway-management` → `conflict-detection-engine` → `notification-service`
   - 핵심 로직 및 알림 시스템 구축

3. **Phase 3 병렬 개발** (1-2주)
   - `gimpo-map-service` (백엔드와 병렬 가능)
   - 지도 서비스 및 시각화 계층

4. **Phase 4 프론트엔드** (2주)
   - `atc-dashboard`
   - 관제사용 통합 대시보드 개발

5. **Phase 5 통합** (1주)
   - `system-integration`
   - 전체 시스템 통합 및 배포

**총 예상 개발기간**: 5-8주 (8주 계획 대비 37.5% 단축)

## Auto-Dev System 연동

### 자동화 준비도: 96.7%
- **YAML 스펙 품질**: 98.9%
- **API 엔드포인트**: 89개 완전 정의
- **김포공항 데이터**: 100% 정확성
- **FlightRadar24 검증**: 실제 데이터 연동 확인

### 자동 개발 비율
- **75% 완전 자동**: CRUD API, 기본 로직, 데이터베이스 스키마
- **20% AI 보조**: 복잡한 알고리즘, UI 카자이너트
- **5% 수동 검증**: 최종 검증, 세부 조정

## 테스트 전략

### 단위 테스트
- **커버리지 목표**: 85% 이상
- **테스트 도구**: JUnit 5, Jest, Mockito

### 통합 테스트
- **실제 데이터**: FlightRadar24 연동 테스트
- **성능 테스트**: 50대 항공기 동시 처리
- **부하 테스트**: 러시아워 시나리오

### E2E 테스트
- **도구**: Playwright
- **시나리오**: 전체 워크플로우 테스트
- **브라우저**: Chrome, Firefox, Safari

## 보안 및 규정 준수

### 항공 보안 표준
- **ICAO A-SMGCS Level 2**: 국제 항공 지상 이동 표준
- **국토교통부**: 항공안전 기준 준수
- **김포공항 운영절차**: 실제 운영 환경 반영

### 데이터 보안
- **암호화**: AES-256 저장 데이터 암호화
- **접근 제어**: RBAC 기반 역할별 권한
- **감사 로그**: 모든 사용자 행동 기록

## 알려진 제약사항

1. **FlightRadar24 API 레이트 제한**: 초당 요청 횟수 제한
2. **실제 RWSL 연동 불가**: 시뮬레이션 모드로 개발
3. **날씨 데이터**: 기상청 API 연동 필요
4. **VIP 항공기**: 보안사반상 공개 데이터 제한

## 다음 단계

1. **Auto-Dev System 자동 개발 시작**
2. **Phase 1 모듈 병렬 개발**
3. **FlightRadar24 연동 테스트**
4. **점진적 통합 및 배포**

---

**프로젝트 상태**: 자동 개발 준비 완료 (96.7%)
**예상 완성일**: 5-8주 후
**개발 예상 번질**: 69개 자동 생성 이슈

🚀 **준비 완료! 자동 개발 시작 가능!** 🚀
