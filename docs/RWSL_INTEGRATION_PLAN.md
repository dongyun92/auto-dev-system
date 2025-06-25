# RWSL 시스템 통합 설계서

## 1. 개요
연구 논문과 상용 제품 분석을 통해 도출한 RWSL 핵심 개념을 김포공항 ATC 대시보드에 적용하는 설계서입니다.

## 2. 핵심 적용 사항

### 2.1 다중 센서 데이터 융합 (Multi-Sensor Data Fusion)
**RWSL 표준**: ASDE-X, SMR, MLAT, ADS-B 등 다중 센서 데이터를 1Hz로 융합

**우리 구현**:
```typescript
interface SensorFusion {
  sources: {
    adsb: { weight: 0.4, latency: 100 },
    mlat: { weight: 0.3, latency: 250 },
    radar: { weight: 0.3, latency: 1000 }
  },
  fusionRate: 10, // 0.1초 (더 빠른 반응)
  confidenceThreshold: 0.7,
  kalmanFilter: {
    processNoise: 0.1,
    measurementNoise: 0.05
  }
}
```

### 2.2 항공기 상태 분류 체계
**RWSL 표준**: STP(정지), TAX(지상이동), DEP(이륙), ARR(착륙), LDG(착륙중) 등

**우리 구현**:
```typescript
enum AircraftState {
  PARKED = 'PARKED',         // 속도 < 3kt
  TAXI_OUT = 'TAXI_OUT',     // 3kt ≤ 속도 < 30kt, 게이트→활주로
  LINEUP = 'LINEUP',         // 활주로 진입, 속도 < 10kt
  TAKEOFF_ROLL = 'TO_ROLL',  // 활주로, 속도 ≥ 30kt
  AIRBORNE = 'AIRBORNE',     // 고도 > 50ft
  APPROACH = 'APPROACH',     // 고도 < 1500ft, 하강중
  LANDING_ROLL = 'LDG_ROLL', // 활주로, 속도 감속중
  TAXI_IN = 'TAXI_IN',       // 3kt ≤ 속도 < 30kt, 활주로→게이트
  EMERGENCY = 'EMERGENCY'    // 7700 스쿼크
}
```

### 2.3 3단계 경고 시스템

#### REL (Runway Entrance Lights) 구현
```typescript
class RELController {
  // 활성화 조건
  activationRules = {
    highSpeedTraffic: {
      condition: 'runway.traffic.any(speed >= 30kt)',
      range: 3700, // meters (2NM)
    },
    approachingAircraft: {
      condition: 'runway.approaching.distance <= 1852', // 1NM
      altitude: '<= 300ft AGL'
    },
    intersectionOccupied: {
      condition: 'taxiway.intersection.occupied',
      activateUpstream: true
    }
  };
  
  // 캐스케이드 소등 (Cascade-off)
  cascadeOff = {
    enabled: true,
    leadTime: 3, // seconds before aircraft arrival
    sequence: 'PROGRESSIVE' // 순차적 소등
  };
}
```

#### THL (Takeoff Hold Lights) 구현
```typescript
class THLController {
  // 이중 추적 시스템
  conflictDetection = {
    departureTrack: {
      position: 'runway.threshold ± 100m',
      heading: 'aligned ± 10°',
      intent: 'speed > 5kt OR acceleration > 0.5m/s²'
    },
    conflictingTrack: {
      types: ['landing', 'crossing', 'opposite_departure'],
      timeWindow: 8, // seconds (T_conf)
      separationBuffer: 2 // seconds safety margin
    }
  };
  
  // 예상 분리 (Anticipated Separation)
  anticipatedSeparation = {
    enabled: true,
    condition: 'preceding.aircraft.speed > 80kt',
    clearanceTime: 5 // seconds after rotation
  };
}
```

#### RIL (Runway Intersection Lights) 구현
```typescript
class RILController {
  // 교차 활주로 전용
  intersectionLogic = {
    calculateETA: (aircraft: Aircraft, intersection: Point) => {
      const distance = calculateDistance(aircraft.position, intersection);
      return distance / aircraft.groundSpeed;
    },
    
    conflictThreshold: 15, // seconds
    
    activationRule: (eta1: number, eta2: number) => {
      return Math.abs(eta1 - eta2) < this.conflictThreshold;
    }
  };
}
```

### 2.4 그룹 기반 등화 제어
**RWSL 표준**: (RunwayID, Position, GroupID) 튜플로 등화 그룹 관리

**우리 구현**:
```typescript
interface LightGroup {
  id: string; // "14L_REL_A1"
  runway: string;
  type: 'REL' | 'THL' | 'RIL';
  position: {
    taxiway?: string;
    distance?: number; // from threshold
  };
  fixtures: Light[];
  
  // 그룹 제어
  control: {
    mode: 'INDIVIDUAL' | 'GROUP' | 'CASCADE';
    priority: number; // 1-10
    override: boolean;
  };
}
```

### 2.5 Fail-Safe 및 품질 저하 모드

```typescript
class FailSafeManager {
  modes = {
    SENSOR_LOSS: {
      trigger: 'lastUpdate > 2000ms',
      action: 'ACTIVATE_ALL_WARNINGS',
      notification: 'ALERT_ATC'
    },
    
    PARTIAL_FAILURE: {
      trigger: 'confidence < 0.5',
      action: 'INCREASE_SAFETY_MARGINS',
      margins: {
        distance: 1.5, // 50% 증가
        time: 1.5      // 50% 증가
      }
    },
    
    CPU_OVERLOAD: {
      trigger: 'cpu > 85%',
      action: 'DEGRADE_PERFORMANCE',
      degradation: {
        updateRate: 0.5, // 2Hz → 1Hz
        disableAnimation: true
      }
    },
    
    MANUAL_OVERRIDE: {
      source: ['TOWER', 'MAINTENANCE'],
      actions: ['FORCE_ON', 'FORCE_OFF', 'TEST_MODE']
    }
  };
}
```

### 2.6 공항별 파라미터 튜닝

```typescript
// 김포공항 전용 설정
const RKSS_CONFIG = {
  runways: {
    '14L/32R': {
      REL: {
        positions: ['A', 'B1', 'B2', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'E1', 'E2', 'F2', 'G1', 'G2'],
        activationDistance: 3700, // meters
        deactivationLeadTime: 3 // seconds
      },
      THL: {
        position: { lat: 37.5706, lng: 126.7784 },
        conflictWindow: 8,
        minSeparation: 90 // seconds
      }
    },
    '14R/32L': {
      REL: {
        positions: ['W1', 'W2', 'B1', 'C1', 'D1', 'E1', 'G1'],
        activationDistance: 3700,
        deactivationLeadTime: 3
      },
      THL: {
        position: { lat: 37.5683, lng: 126.7755 },
        conflictWindow: 8,
        minSeparation: 90
      }
    }
  },
  
  // 저시정 운영 (CAT II/III)
  lowVisibility: {
    enabled: false,
    modifications: {
      activationDistance: 5500, // 3NM
      conflictWindow: 12,
      additionalLights: ['STOP_BAR', 'GUARD_LIGHTS']
    }
  }
};
```

## 3. 구현 우선순위

### Phase 1: 핵심 기능 (1-2주)
1. **다중 센서 융합 엔진**
   - ADS-B + 시뮬레이션 데이터 통합
   - Confidence 기반 트랙 관리
   - 상태 감지 알고리즘

2. **기본 REL 시스템**
   - 활주로 점유 감지
   - 고속 트래픽 경고
   - 시각적 경고 표시

3. **Fail-Safe 기본 모드**
   - 센서 손실 감지
   - 전체 경고 활성화

### Phase 2: 고급 기능 (2-3주)
1. **THL 시스템**
   - 이중 트랙 충돌 예측
   - 예상 분리 로직
   - 동적 시간 창 조정

2. **RIL 시스템** (교차 활주로용)
   - ETA 계산 알고리즘
   - 교차점 충돌 예측

3. **캐스케이드 제어**
   - 순차적 소등 로직
   - 그룹 기반 제어

### Phase 3: 최적화 및 확장 (3-4주)
1. **성능 최적화**
   - 공간 인덱싱 고도화
   - GPU 가속 렌더링
   - 메모리 사용 최적화

2. **고급 Fail-Safe**
   - 부분 실패 모드
   - 성능 저하 모드
   - 수동 오버라이드

3. **다중 공항 지원**
   - 설정 관리 시스템
   - 공항별 커스터마이징
   - A-SMGCS 레벨 지원

## 4. 테스트 계획

### 4.1 단위 테스트
- 각 컨트롤러 로직 검증
- 상태 전환 테스트
- 충돌 예측 정확도

### 4.2 통합 테스트
- 다중 항공기 시나리오
- Fail-safe 전환 테스트
- 성능 부하 테스트

### 4.3 시뮬레이션 테스트
- 실제 김포공항 트래픽 패턴
- 악천후 시나리오
- 비상 상황 대응

## 5. 성공 지표

1. **안전성**
   - False negative rate < 0.1%
   - 센서 실패 감지 시간 < 2초

2. **성능**
   - 업데이트 주기 ≤ 100ms
   - 100대 동시 추적 가능

3. **신뢰성**
   - 99.9% 가동률
   - Graceful degradation

4. **사용성**
   - 관제사 승인률 > 90%
   - 평균 반응 시간 < 1초