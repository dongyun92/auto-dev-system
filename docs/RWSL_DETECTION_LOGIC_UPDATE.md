# RWSL 감지 로직 업데이트

## 변경사항

### 1. 이륙 위치 감지 개선
**이전**: 활주로 양쪽 끝에서 500m 원형 영역
**변경**: 진행 방향 고려
- 항공기 heading으로 이륙 방향 판단 (14 또는 32)
- 14 방향 이륙: 32R/32L 끝점에서만 500m 확인
- 32 방향 이륙: 14L/14R 끝점에서만 500m 확인
- 진행 방향과 반대쪽은 무시

### 2. THL 대기 영역 개선
**이전**: THL 중심에서 250m 원형 영역
**변경**: 직사각형 임계값 영역
- 크기: 100m (활주로 방향) × 60m (활주로 폭)
- 위치: THL 위치에서 활주로 반대 방향 100m
- 활주로 방향 벡터를 이용한 정확한 직사각형 계산

### 3. 바람 정보 제거
**이전**: 측풍 25kt 초과 시 THL 자동 활성화
**변경**: 바람 정보 관련 로직 제거
- weatherData 의존성 제거
- 측풍 계산 로직 제거
- THL은 오직 트래픽과 대기 항공기로만 제어

## 기술적 구현

### 이륙 위치 판단
```typescript
// 1. 항공기 heading으로 이륙 방향 결정
const isTakeoff14Direction = headingDiff14 <= headingDiff32;

// 2. 방향에 따른 거리 계산
if (isTakeoff14Direction) {
  // 32R/32L 끝점에서만 거리 확인
  isAtTakeoffPosition = dist32 <= 500;
} else {
  // 14L/14R 끝점에서만 거리 확인
  isAtTakeoffPosition = dist14 <= 500;
}
```

### THL 직사각형 영역
```typescript
// 1. 활주로 방향 벡터 계산
const runwayHeading = line.id.includes('14') ? 143 : 323;
const runwayVector = {
  lat: Math.cos(headingRad),
  lng: Math.sin(headingRad)
};

// 2. 직사각형 영역 판단
// - 활주로 방향: -100m ~ 0m (THL 전방)
// - 활주로 수직: ±30m (활주로 폭의 절반)
return alongRunwayMeters >= -100 && alongRunwayMeters <= 0 && 
       acrossRunwayMeters <= 30;
```

## 결과
- 더 정확한 이륙 위치 감지
- 실제 공항 운영과 일치하는 THL 대기 영역
- 불필요한 바람 정보 의존성 제거