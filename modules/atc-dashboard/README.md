# ATC Dashboard

김포타워 관제사용 RWSL 통합 대시보드 - 실시간 안전 모니터링 시스템

## 기능

- 실시간 항공기 추적 및 모니터링
- 레이더 화면 표시
- 활주로 상태 및 RWSL(Runway Status Light) 관리
- 항공기 상세 정보 및 궤적 분석
- WebSocket을 통한 실시간 데이터 업데이트
- 긴급상황 알림 시스템

## 주요 화면

### 대시보드
- 시스템 상태 개요
- 추적 중인 항공기 목록
- 실시간 레이더 화면
- 활주로 상태 패널

### 항공기 상세
- 항공기 기본 정보
- 비행 상태 및 궤적
- 고도/속도 차트
- 최근 이동 경로

### 활주로 상태
- 활주로 운용 상태
- RWSL 라이트 상태
- 접근 중인 항공기 목록
- 활주로 제어 기능

## 기술 스택

- React 18
- TypeScript
- Tailwind CSS
- Recharts (차트)
- Socket.IO (WebSocket)
- React Router

## 설치 및 실행

1. 의존성 설치
```bash
npm install
```

2. 개발 서버 시작
```bash
npm start
```

3. 프로덕션 빌드
```bash
npm run build
```

## 환경 설정

환경 변수를 통해 API 서버 주소를 설정할 수 있습니다:

```bash
REACT_APP_API_URL=http://localhost:8082
```

## 주요 컴포넌트

- `Header`: 네비게이션 및 연결 상태 표시
- `AircraftList`: 추적 중인 항공기 목록
- `RadarDisplay`: 실시간 레이더 화면
- `SystemStatus`: 시스템 상태 개요
- `RunwayPanel`: 활주로 상태 및 접근 항공기

## WebSocket 연결

대시보드는 항공기 추적 서비스(포트 8082)의 WebSocket에 연결하여 실시간 데이터를 수신합니다.

## 브라우저 지원

- Chrome (최신)
- Firefox (최신)
- Safari (최신)
- Edge (최신)