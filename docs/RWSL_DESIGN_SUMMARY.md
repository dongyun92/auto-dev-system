# RWSL 시스템 설계 요약

## 연구 문서 기반 핵심 적용 사항

### 1. **다중 센서 데이터 융합**
- **RWSL 표준**: ASDE-X, SMR, MLAT, ADS-B 통합 (1Hz)
- **우리 구현**: 
  - 0.1초 업데이트 주기 (10Hz) - 더 빠른 반응
  - 가중치 기반 신뢰도 계산
  - Kalman 필터 적용
  - 센서 실패 시 graceful degradation

### 2. **항공기 상태 머신**
```
PARKED → TAXI_OUT → LINEUP → TAKEOFF_ROLL → AIRBORNE
                                    ↓
PARKED ← TAXI_IN ← LANDING_ROLL ← APPROACH
```

### 3. **3단계 경고 시스템 아키텍처**

#### REL (Runway Entrance Lights)
- **활성화 조건**:
  - 고속 트래픽 (≥30kt) 3.7km 이내
  - 접근 항공기 1NM 이내, 300ft AGL 이하
  - 교차점 점유 시 상류 활성화
- **캐스케이드 소등**: 항공기 통과 3초 전부터 순차 소등

#### THL (Takeoff Hold Lights)
- **이중 추적 시스템**:
  - Track 1: 출발 항공기 (임계값 ±100m)
  - Track 2: 충돌 트래픽 (착륙/교차/반대)
- **충돌 예측**: 8-10초 창 (T_conf)
- **예상 분리**: 선행기 80kt 도달 시 5초 여유

#### RIL (Runway Intersection Lights)
- **교차점 ETA 계산**
- **충돌 임계값**: 15초
- **김포공항**: 평행 활주로이므로 근접 운영 모니터링

### 4. **Fail-Safe 메커니즘**

```typescript
enum FailSafeMode {
  NORMAL,           // 정상 운영
  SENSOR_LOSS,      // 2초 이상 데이터 없음 → 모든 등화 ON
  PARTIAL_FAILURE,  // 신뢰도 < 0.5 → 안전 마진 150%
  CPU_OVERLOAD,     // CPU > 85% → 업데이트 주기 감소
  MANUAL_OVERRIDE   // ATC 수동 제어
}
```

### 5. **그룹 기반 등화 제어**
- **(RunwayID, Position, GroupID)** 튜플 관리
- 모드: INDIVIDUAL, GROUP, CASCADE
- 우선순위 기반 오버라이드

### 6. **공항별 커스터마이징**
- 김포공항 특화 파라미터
- 저시정 운영 모드 (CAT II/III)
- 활주로별 REL/THL 위치 매핑

## 구현 아키텍처

```
┌─────────────────────────────────────────────┐
│            Sensor Fusion Layer              │
│  (ADS-B, MLAT, Radar → Unified Tracks)     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         State Detection Engine              │
│    (Aircraft State Classification)          │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         RWSL Control System                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │   REL   │ │   THL   │ │   RIL   │      │
│  │Controller│ │Controller│ │Controller│     │
│  └─────────┘ └─────────┘ └─────────┘      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         Fail-Safe Manager                   │
│   (Mode Selection & Override Logic)         │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         UI Visualization Layer              │
│    (Real-time Display & Alerts)            │
└─────────────────────────────────────────────┘
```

## 주요 차별점

1. **실시간 성능**: 0.1초 업데이트 (표준 1초 대비 10배)
2. **예측 정확도**: 가속도 기반 이륙 의도 조기 감지
3. **강건성**: GPS 손실 시 Dead Reckoning 위치 추정
4. **최적화**: 공간 인덱싱으로 O(n²) → O(k) 성능 개선
5. **안전성**: 다중 Fail-Safe 모드 및 수동 오버라이드

## 구현 현황

### 완료된 모듈
- ✅ `RWSLCore.ts`: 핵심 엔진 및 상태 관리
- ✅ `RELController.ts`: REL 제어 로직
- ✅ `THLController.ts`: THL 이중 추적 시스템
- ✅ `rwslHelpers.ts`: 유틸리티 함수

### 다음 단계
1. RIL 컨트롤러 구현
2. Fail-Safe Manager 구현
3. UI 통합 및 시각화
4. 실시간 테스트 환경 구축

## 성과 지표
- **False Negative Rate**: < 0.1% (목표)
- **응답 시간**: < 100ms
- **동시 추적**: 100+ 항공기
- **가동률**: 99.9%