# 포괄적 RWSL (Runway Status Lights) 알고리즘 구현

## 개요
이 문서는 김포공항 ATC 대시보드에 구현된 고급 RWSL 시스템의 상세 알고리즘을 설명합니다.

## 주요 기능

### 1. 기본 RWSL 구성 요소
- **REL (Runway Entrance Lights)**: 유도로-활주로 교차점 등화
- **THL (Takeoff Hold Lights)**: 활주로 시작점 대기 등화  
- **RIL (Runway Intersection Lights)**: 활주로 교차점 등화

### 2. 고급 기능

#### 2.1 가속도 기반 이륙 의도 감지
- 항공기 속도 이력을 추적하여 가속도 계산
- 가속도 > 0.5 m/s² 시 이륙 의도로 판단
- 5초간의 속도 이력 유지

```typescript
const acceleration = getAircraftAcceleration(aircraft.id);
const isAccelerating = acceleration > 0.5; // 0.5 m/s² 이상
```

#### 2.2 GPS 손실 대응
- GPS 신호 손실 시 마지막 알려진 위치에서 추정
- heading과 속도를 이용한 위치 예측
- Dead Reckoning 방식 구현

```typescript
const position = getEstimatedPosition(aircraft);
// GPS 정상: 실제 위치 반환
// GPS 손실: 추정 위치 계산
```

#### 2.3 공간 인덱싱 최적화
- 500m 그리드 단위로 항공기 위치 인덱싱
- REL 주변 항공기만 선택적 검사
- O(n) → O(k) 성능 개선 (k << n)

```typescript
const nearbyAircraft = [];
const gridKeys = getNearbyGridKeys(relMidpoint.lat, relMidpoint.lng);
gridKeys.forEach(key => {
  const gridAircraft = aircraftSpatialIndex.get(key) || [];
  nearbyAircraft.push(...gridAircraft);
});
```

#### 2.4 날씨 조건 반영
- 측풍 성분 계산 및 안전성 평가
- 측풍 25kt 초과 시 THL 자동 활성화
- 활주로별 측풍 경고

```typescript
const crosswind = calculateCrosswindComponent(
  weatherData.windSpeed,
  weatherData.windDirection,
  runwayHeading
);
if (crosswind > 25) {
  // THL 활성화 - 안전 경고
}
```

#### 2.5 충돌 예측 시스템
- 교차 활주로 동시 운용 시 충돌 시간 계산
- 15초 이내 충돌 예상 시 RIL 활성화
- 실시간 충돌 가능성 모니터링

```typescript
const timeToConflict = calculateTimeToConflict(
  aircraft1, aircraft2, intersectionPoint
);
if (timeToConflict < 15) {
  // RIL 활성화
}
```

#### 2.6 활주로 점유 시간 추적
- 항공기별 활주로 점유 시간 실시간 추적
- 60초 이상 점유 시 경고 발생
- 비정상 상황 자동 감지

## 알고리즘 상세

### REL 활성화 로직

1. **이륙 항공기 감지**
   - 속도 ≥ 30kt 또는
   - 이륙 위치 + 정렬 + 속도 ≥ 5kt 또는
   - 이륙 위치 + 정렬 + 가속 중

2. **이륙 진행 시 소등**
   - 항공기가 REL 통과 (370m 이내) → 해당 REL 소등
   - 항공기 고도 > 200ft → 모든 REL 소등

3. **유도로 접근 감지**
   - 이륙 항공기가 없을 때
   - 50-200m 거리 내 항공기
   - 벡터 기반 방향성 검사

### THL 활성화 로직

1. **기본 조건**
   - 활주로에 활성 트래픽 존재
   - 250m 이내 대기 항공기 존재

2. **날씨 조건**
   - 측풍 > 25kt 시 자동 활성화

### RIL 활성화 로직

1. **충돌 예측**
   - 교차 활주로 동시 운용
   - 15초 이내 교차점 도달 예상

2. **기본 보호**
   - 어느 활주로든 활성 트래픽 존재

## 시스템 강건성

### Fail-Safe 메커니즘
1. GPS 손실 시 위치 추정 계속
2. 레이더 장애 시 마지막 데이터 유지
3. 통신 두절 시 보수적 등화 운용

### 성능 최적화
1. 공간 인덱싱으로 근거리 항공기만 검사
2. 0.1초 주기로 최소한의 상태 업데이트
3. 변경사항이 있을 때만 등화 상태 갱신

## 구현 파일

- `/src/components/RadarDisplay.tsx`: 메인 RWSL 로직
- `/src/utils/rwslHelpers.ts`: 헬퍼 함수 모음
- `/src/types/index.ts`: 타입 정의

## 테스트 시나리오

1. **정상 이륙**
   - 활주로 진입 → REL 활성화
   - 가속 → REL 순차 소등
   - Airborne → 모든 REL 소등

2. **GPS 손실**
   - GPS 신호 차단
   - 위치 추정 계속
   - RWSL 정상 작동

3. **악천후**
   - 측풍 30kt 설정
   - THL 자동 활성화
   - 안전 경고 표시

4. **동시 운용**
   - 양 활주로 동시 이륙
   - RIL 활성화 확인
   - 충돌 시간 계산

## 향후 개선사항

1. 머신러닝 기반 이륙 의도 예측
2. 활주로 표면 상태 반영
3. 조종사 피드백 통합
4. 다중 공항 지원