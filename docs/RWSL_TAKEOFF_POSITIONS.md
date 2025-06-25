# 김포공항 이륙 위치 정의

## 활주로별 이륙 위치

### 14L/32R 활주로
- **14L 이륙 위치**: 37.5705°N, 126.7784°E (14L 임계값)
- **32R 이륙 위치**: 37.5478°N, 126.8070°E (32R 임계값)

### 14R/32L 활주로
- **14R 이륙 위치**: 37.5683°N, 126.7755°E (14R 임계값)
- **32L 이륙 위치**: 37.5481°N, 126.8009°E (32L 임계값)

## 이륙 위치 시각화

### 시각적 요소
1. **위치 마커**
   - 녹색 원 (반경 15px)
   - 중심점 표시
   - 투명도 30%

2. **방향 화살표**
   - 이륙 방향 표시
   - 14L/14R: 143° (남동쪽)
   - 32L/32R: 323° (북서쪽)

3. **대기 구역**
   - 100m 반경 점선 원
   - 이륙 대기 항공기 감지 영역

4. **좌표 표시**
   - 정확한 위도/경도 표시
   - 8px 폰트 사용

## THL (Takeoff Hold Lights) 연동

### 이륙 위치 감지 로직
```typescript
// 이륙 위치 판단
const isAtTakeoffPosition = (aircraft: TrackedAircraft, runway: string): boolean => {
  const takeoffPos = runway.takeoffPositions[runwayEnd];
  const distance = calculateDistance(
    aircraft.latitude,
    aircraft.longitude,
    takeoffPos.lat,
    takeoffPos.lng
  );
  
  return distance <= 100; // 100m 이내
};
```

### THL 활성화 조건
1. **위치**: 이륙 위치 100m 이내
2. **방향**: 활주로 방향 ±10°
3. **의도**: 속도 ≥ 5kt OR 가속 중

## 사용 방법

### 시각화 활성화
1. 레이더 화면 상단 도구모음
2. "이륙위치" 체크박스 선택
3. 4개 이륙 위치 표시됨

### 디버깅 용도
- 항공기가 정확한 이륙 위치에 있는지 확인
- THL 활성화 조건 검증
- 이륙 대기 구역 범위 확인

## 구현 코드 위치
- 데이터 정의: `RadarDisplay.tsx` lines 75-90
- 시각화 코드: `RadarDisplay.tsx` lines 1892-1972
- 토글 버튼: `RadarDisplay.tsx` lines 2233-2241