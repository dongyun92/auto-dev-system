# RWSL 시스템 성능 최적화 가이드

## 성능 문제 원인 분석

### 1. 과도한 렌더링
- 0.1초마다 전체 캔버스 재렌더링
- 불필요한 요소도 매번 다시 그림
- 화면 밖 요소도 렌더링

### 2. 비효율적인 계산
- 매 프레임마다 모든 항공기-등화 거리 계산
- 메모이제이션 없는 좌표 변환
- 중복된 상태 계산

### 3. 메모리 누수 가능성
- OSM 타일 무한 축적
- 항공기 이력 데이터 증가

## 최적화 방법

### 1. 렌더링 최적화

#### 1.1 조건부 렌더링
```typescript
// 변경된 요소만 다시 그리기
if (hasStateChanged) {
  redrawCanvas();
}
```

#### 1.2 뷰포트 컬링
```typescript
// 화면에 보이는 요소만 렌더링
if (isInViewport(x, y, width, height)) {
  drawElement();
}
```

#### 1.3 레이어 분리
- 정적 요소 (활주로, 배경): 별도 캔버스
- 동적 요소 (항공기, 등화): 메인 캔버스
- UI 요소: React 컴포넌트

### 2. 계산 최적화

#### 2.1 공간 인덱싱 활용
```typescript
// O(n²) → O(k) 복잡도 감소
const nearbyAircraft = spatialIndex.query(boundingBox);
```

#### 2.2 거리 계산 최적화
```typescript
// 제곱근 계산 제거
if (distanceSquared(x1, y1, x2, y2) < thresholdSquared) {
  // 거리 내에 있음
}
```

#### 2.3 업데이트 주기 조정
```typescript
// CPU 사용률에 따른 동적 조정
const updateRate = cpuUsage > 50 ? 200 : 100; // ms
```

### 3. 메모리 최적화

#### 3.1 타일 캐시 제한
```typescript
const MAX_TILES = 100;
if (tileCache.size > MAX_TILES) {
  evictOldestTiles();
}
```

#### 3.2 이력 데이터 제한
```typescript
const MAX_HISTORY_SECONDS = 10;
purgeOldHistory();
```

## 즉시 적용 가능한 최적화

### 1. RWSL 업데이트 쓰로틀링
```typescript
// RadarDisplay.tsx
const updateRWSL = useMemo(
  () => throttle(() => {
    const updatedLines = updateRWSLAutomation(aircraft, rwslLines);
    setRwslLines(updatedLines);
  }, 200), // 200ms 간격으로 제한
  []
);
```

### 2. 캔버스 최적화 설정
```typescript
// 렌더링 시작 시
ctx.save();
ctx.imageSmoothingEnabled = false; // 안티앨리어싱 비활성화
ctx.globalCompositeOperation = 'source-over';
```

### 3. 조건부 시각화
```typescript
// 줌 레벨에 따른 상세도 조정
if (scale > 2) {
  drawDetailedElements();
} else {
  drawSimplifiedElements();
}
```

### 4. 배치 업데이트
```typescript
// 상태 업데이트 배치 처리
const batchUpdate = () => {
  ReactDOM.unstable_batchedUpdates(() => {
    setAircraftHistory(newHistory);
    setSpatialIndex(newIndex);
    setRwslLines(newLines);
  });
};
```

## 설정 추가

### 성능 모드 토글
```typescript
interface PerformanceSettings {
  mode: 'high' | 'balanced' | 'low';
  updateRate: number;
  renderQuality: 'full' | 'reduced';
  enableAnimations: boolean;
  maxAircraft: number;
}

const performancePresets = {
  high: {
    updateRate: 100,
    renderQuality: 'full',
    enableAnimations: true,
    maxAircraft: 200
  },
  balanced: {
    updateRate: 200,
    renderQuality: 'full',
    enableAnimations: false,
    maxAircraft: 100
  },
  low: {
    updateRate: 500,
    renderQuality: 'reduced',
    enableAnimations: false,
    maxAircraft: 50
  }
};
```

## 측정 지표

### 성능 모니터링
1. **FPS**: 목표 30+ FPS
2. **CPU 사용률**: < 50%
3. **메모리 사용량**: < 200MB
4. **업데이트 지연**: < 100ms

### 디버그 정보 표시
```typescript
if (showPerformanceStats) {
  ctx.fillText(`FPS: ${fps}`, 10, 20);
  ctx.fillText(`Aircraft: ${aircraft.length}`, 10, 35);
  ctx.fillText(`Active Lights: ${activeLights}`, 10, 50);
}
```

## 권장 브라우저 설정

### Chrome 플래그
- `chrome://flags/#enable-gpu-rasterization`: 활성화
- `chrome://flags/#enable-zero-copy`: 활성화

### 하드웨어 가속
- GPU 가속 활성화 확인
- 충분한 메모리 할당 (최소 4GB)