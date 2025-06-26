# ATC Dashboard RWSL System Context

## Session Date: 2025-06-26

### 1. Primary Request and Intent:
- React 무한 루프 에러 해결 (RadarDisplay.tsx:1170 Maximum update depth exceeded)
- 컴파일 에러 수정 (getEstimatedPosition, calculateDistance 접근 불가)
- 마우스 휠 이벤트 에러 해결 (passive event listener preventDefault)
- 32R 활주로 방향을 공식 차트 기준(323°)으로 수정
- 이륙 위치 인식 범위를 2배(1000m)로 확대
- 이륙 위치 인식 범위 시각화 추가
- 초록색 점선 직사각형의 의미 확인
- RWSL에서 이륙 인식 범위의 필요성 검증

### 2. Key Technical Concepts:
- React useEffect 의존성 배열 관리 (무한 루프 방지)
- Passive event listener와 preventDefault 처리
- Canvas 기반 레이더 디스플레이 렌더링
- RWSL (Runway Status Lights) 시스템: REL, THL, RIL
- 활주로 방향 네이밍 (32R = 323°, 공식 차트 기준)
- 항공기 이륙 감지 로직 (위치, 방향, 속도, 가속도)
- GPS 손실 대응 시스템
- 공간 인덱싱 최적화 (500m 그리드)

### 3. Files and Code Sections:
- **RadarDisplay.tsx** (주요 작업 파일)
  - 무한 루프 해결: setRunwayOccupancyTime를 별도 useEffect로 분리 (lines 1209-1268)
  ```typescript
  // 활주로 점유 시간 추적 - 별도 useEffect로 분리
  useEffect(() => {
    if (aircraft.length === 0) return;
    const intervalId = setInterval(() => {
      setRunwayOccupancyTime(prev => {
        // ... 로직
      });
    }, 100);
    return () => clearInterval(intervalId);
  }, [aircraft, localRunways, systemHealthStatus.gpsHealth]);
  ```
  
  - Wheel 이벤트 처리 (lines 1289-1306)
  ```typescript
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheelEvent = (event: WheelEvent) => {
      event.preventDefault();
      const newScale = scale * (event.deltaY > 0 ? 0.9 : 1.1);
      setScale(Math.max(0.1, Math.min(20, newScale)));
    };
    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [scale]);
  ```
  
  - 32R 방향 수정: 320° → 323° (8곳 수정)
  - 이륙 인식 범위: 500m → 1000m
  - 이륙 위치 시각화 추가 (lines 1979-2030)

### 4. Problem Solving:
- **React 무한 루프**: updateRWSLAutomation 내부의 setState를 별도 useEffect로 분리
- **컴파일 에러**: calculateDistanceHelper 직접 사용, runway.centerline 중심점 계산
- **Passive event listener**: React onWheel 대신 native addEventListener 사용
- **활주로 방향**: 최종적으로 공식 차트 확인 후 323°로 수정

### 5. Pending Tasks:
- 없음 (모든 요청 사항 완료)

### 6. Current Work:
프로젝트 컨텍스트를 파일로 저장하여 다음 세션에서 연속성 있게 작업할 수 있도록 준비

### 7. System Architecture Notes:
- **이륙 관련 3가지 범위**:
  1. 이륙 대기 구역: 100m × 60m 직사각형 (시각화용)
  2. 이륙 인식 범위: 반경 1000m (RWSL REL 로직용)
  3. THL 활성화 범위: 반경 100m (Takeoff Hold Lights용)

- **활주로 정보**:
  - 14L/32R, 14R/32L
  - 방향: 14(143°), 32(323°)
  - 각 활주로별 takeoffPositions 정의됨

### 8. Performance Optimizations:
- 공간 인덱싱으로 O(n) → O(k) 성능 개선
- 100ms interval로 runway occupancy 추적
- Canvas 렌더링 최적화 적용됨