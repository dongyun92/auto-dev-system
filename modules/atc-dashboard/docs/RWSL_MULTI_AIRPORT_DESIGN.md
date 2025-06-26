# RWSL 다중 공항 지원 시스템 설계

## 1. 개요

### 1.1 배경
- 현재 시스템은 김포공항(RKSS)에 특화되어 하드코딩됨
- WGS-84 좌표계 직접 사용으로 성능 및 정확도 이슈 존재
- 다른 공항으로 확장 시 코드 수정 필요

### 1.2 목표
- 평면좌표계 기반 RWSL 계산으로 성능 및 정확도 향상
- 설정 기반 다중 공항 지원
- 확장 가능하고 유지보수가 쉬운 아키텍처

## 2. 아키텍처 설계

### 2.1 핵심 컴포넌트

```typescript
// 1. 좌표계 변환 시스템
interface CoordinateSystem {
  // WGS-84 → 평면좌표 변환
  toPlane(lat: number, lng: number): PlaneCoordinate;
  // 평면좌표 → WGS-84 변환
  toWGS84(x: number, y: number): GeographicCoordinate;
  // 거리 계산 (미터 단위)
  distance(p1: PlaneCoordinate, p2: PlaneCoordinate): number;
  // 방향 계산 (라디안)
  bearing(from: PlaneCoordinate, to: PlaneCoordinate): number;
}

// 2. 공항 설정 시스템
interface AirportConfig {
  id: string;                    // ICAO 코드 (예: RKSS)
  name: string;                  // 공항 이름
  referencePoint: {              // 공항 기준점 (평면좌표 원점)
    lat: number;
    lng: number;
  };
  projection: ProjectionType;    // 투영법 (UTM, TM 등)
  runways: RunwayConfig[];       // 활주로 설정
  rwsl: RWSLConfig;             // RWSL 설정
}

// 3. RWSL 엔진
interface RWSLEngine {
  airport: AirportConfig;
  coordinateSystem: CoordinateSystem;
  
  // 항공기 위치 업데이트 (WGS-84 입력, 내부적으로 평면좌표 변환)
  updateAircraft(aircraft: TrackedAircraft): void;
  
  // RWSL 상태 계산
  calculateRWSLState(): RWSLState;
  
  // 특정 영역 검사
  checkREL(runway: string, position: PlaneCoordinate): boolean;
  checkTHL(runway: string, position: PlaneCoordinate): boolean;
}
```

### 2.2 좌표계 변환 전략

#### 2.2.1 평면좌표계 선택
```typescript
enum ProjectionType {
  UTM = 'UTM',           // Universal Transverse Mercator
  TM = 'TM',             // Transverse Mercator (한국 TM)
  LOCAL_TANGENT = 'LOCAL_TANGENT'  // 지역 접평면 (작은 공항용)
}

class ProjectionFactory {
  static create(type: ProjectionType, referencePoint: GeographicCoordinate): CoordinateSystem {
    switch(type) {
      case ProjectionType.UTM:
        return new UTMProjection(referencePoint);
      case ProjectionType.TM:
        return new TMProjection(referencePoint);
      case ProjectionType.LOCAL_TANGENT:
        return new LocalTangentPlane(referencePoint);
    }
  }
}
```

#### 2.2.2 지역 접평면 좌표계 (추천)
- 공항 중심점을 원점으로 하는 평면좌표계
- X축: 동쪽 방향 (미터)
- Y축: 북쪽 방향 (미터)
- 수 km 범위에서 충분한 정확도

```typescript
class LocalTangentPlane implements CoordinateSystem {
  private origin: GeographicCoordinate;
  private cosLat: number;
  
  constructor(origin: GeographicCoordinate) {
    this.origin = origin;
    this.cosLat = Math.cos(origin.lat * Math.PI / 180);
  }
  
  toPlane(lat: number, lng: number): PlaneCoordinate {
    const dLat = (lat - this.origin.lat) * Math.PI / 180;
    const dLng = (lng - this.origin.lng) * Math.PI / 180;
    
    const x = dLng * this.cosLat * 6371000;  // 동쪽 방향 (m)
    const y = dLat * 6371000;                 // 북쪽 방향 (m)
    
    return { x, y };
  }
  
  toWGS84(x: number, y: number): GeographicCoordinate {
    const lat = this.origin.lat + (y / 6371000) * 180 / Math.PI;
    const lng = this.origin.lng + (x / (6371000 * this.cosLat)) * 180 / Math.PI;
    
    return { lat, lng };
  }
}
```

### 2.3 공항 설정 파일 구조

```json
// airports/RKSS.json
{
  "id": "RKSS",
  "name": "김포국제공항",
  "referencePoint": {
    "lat": 37.5592,
    "lng": 126.7912
  },
  "projection": "LOCAL_TANGENT",
  "runways": [
    {
      "id": "14L/32R",
      "name": "14L/32R",
      "threshold": {
        "14L": { "lat": 37.5705, "lng": 126.7784 },
        "32R": { "lat": 37.5478, "lng": 126.8070 }
      },
      "width": 60,
      "stopway": {
        "14L": 150,
        "32R": 150
      }
    },
    {
      "id": "14R/32L",
      "name": "14R/32L",
      "threshold": {
        "14R": { "lat": 37.5683, "lng": 126.7755 },
        "32L": { "lat": 37.5481, "lng": 126.8009 }
      },
      "width": 45,
      "stopway": {
        "14R": 150,
        "32L": 150
      }
    }
  ],
  "rwsl": {
    "rel": {
      "enabled": true,
      "detectionRange": {
        "inner": 50,
        "outer": 200
      },
      "sectorAngle": 90,
      "activationDelay": 2000
    },
    "thl": {
      "enabled": true,
      "detectionArea": {
        "length": 100,
        "width": 60
      },
      "activationDelay": 1500
    },
    "lights": {
      "rel": [
        {"id": "REL-14L-1", "offset": {"x": 0, "y": 50}},
        {"id": "REL-14L-2", "offset": {"x": 0, "y": 100}}
      ],
      "thl": [
        {"id": "THL-14L-1", "offset": {"x": -30, "y": 50}},
        {"id": "THL-14L-2", "offset": {"x": 30, "y": 50}}
      ]
    }
  }
}
```

### 2.4 타입 정의 개선

```typescript
// 평면좌표 타입
interface PlaneCoordinate {
  x: number;  // 동쪽 방향 (미터)
  y: number;  // 북쪽 방향 (미터)
}

// 지리좌표 타입
interface GeographicCoordinate {
  lat: number;
  lng: number;
}

// 확장된 항공기 타입
interface TrackedAircraftExtended extends TrackedAircraft {
  // 평면좌표 (계산된 값, 캐시용)
  planePosition?: PlaneCoordinate;
  // 예측 경로 (평면좌표)
  predictedPath?: PlaneCoordinate[];
}

// RWSL 상태
interface RWSLState {
  rel: Map<string, LightState>;
  thl: Map<string, LightState>;
  conflicts: Conflict[];
  lastUpdate: number;
}

interface LightState {
  id: string;
  active: boolean;
  reason?: string;
  activatedAt?: number;
  position: PlaneCoordinate;
}
```

## 3. 구현 계획

### 3.1 단계별 구현

#### Phase 1: 좌표계 변환 시스템
1. CoordinateSystem 인터페이스 구현
2. LocalTangentPlane 구현
3. 기존 거리/방향 계산 함수 마이그레이션

#### Phase 2: 공항 설정 시스템
1. AirportConfig 타입 정의
2. 설정 파일 로더 구현
3. 김포공항 설정 파일 생성

#### Phase 3: RWSL 엔진 리팩토링
1. 평면좌표 기반 감지 로직 구현
2. 부채꼴/직사각형 영역 검사 최적화
3. 성능 테스트 및 비교

#### Phase 4: UI 업데이트
1. RadarDisplay 평면좌표 렌더링
2. 좌표 변환 레이어 추가
3. 디버그 모드 좌표 표시

### 3.2 파일 구조

```
src/
├── core/
│   ├── coordinates/
│   │   ├── CoordinateSystem.ts
│   │   ├── LocalTangentPlane.ts
│   │   ├── UTMProjection.ts
│   │   └── index.ts
│   ├── airport/
│   │   ├── AirportConfig.ts
│   │   ├── AirportLoader.ts
│   │   └── index.ts
│   └── rwsl/
│       ├── RWSLEngine.ts
│       ├── RELDetector.ts
│       ├── THLDetector.ts
│       └── index.ts
├── config/
│   └── airports/
│       ├── RKSS.json
│       ├── RKSI.json
│       └── RKPC.json
└── types/
    ├── coordinates.ts
    ├── airport.ts
    └── rwsl.ts
```

## 4. 장점

### 4.1 성능 향상
- 평면좌표 계산이 구면좌표보다 빠름
- 거리/각도 계산 단순화
- 캐싱 효율성 증가

### 4.2 정확도 향상
- 작은 영역에서 왜곡 최소화
- 미터 단위 직접 사용
- 일관된 거리 계산

### 4.3 확장성
- 새 공항 추가 시 설정 파일만 추가
- 투영법 변경 가능
- RWSL 파라미터 공항별 커스터마이징

### 4.4 유지보수성
- 하드코딩 제거
- 모듈화된 구조
- 테스트 용이성

## 5. 고려사항

### 5.1 마이그레이션
- 기존 WGS-84 기반 코드와 호환성 유지
- 점진적 마이그레이션 전략
- 백워드 호환성

### 5.2 테스트
- 좌표 변환 정확도 테스트
- RWSL 감지 영역 검증
- 성능 벤치마크

### 5.3 문서화
- 공항 설정 가이드
- 좌표계 선택 가이드
- API 문서