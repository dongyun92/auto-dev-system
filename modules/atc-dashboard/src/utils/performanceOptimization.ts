/**
 * 성능 최적화 유틸리티
 */

// 디바운스 함수
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// 쓰로틀 함수
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// 메모이제이션
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = func(...args);
    cache.set(key, result);
    
    // 캐시 크기 제한 (최대 100개)
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  }) as T;
}

// 애니메이션 프레임 요청 최적화
export class AnimationFrameOptimizer {
  private rafId: number | null = null;
  private callback: FrameRequestCallback;
  private isRunning: boolean = false;
  
  constructor(callback: FrameRequestCallback) {
    this.callback = callback;
  }
  
  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.animate();
    }
  }
  
  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isRunning = false;
  }
  
  private animate = (timestamp: number = 0) => {
    if (this.isRunning) {
      this.callback(timestamp);
      this.rafId = requestAnimationFrame(this.animate);
    }
  };
}

// 배치 업데이트
export class BatchUpdater<T> {
  private updates: T[] = [];
  private processor: (updates: T[]) => void;
  private delay: number;
  private timer: NodeJS.Timeout | null = null;
  
  constructor(processor: (updates: T[]) => void, delay: number = 16) {
    this.processor = processor;
    this.delay = delay;
  }
  
  add(update: T) {
    this.updates.push(update);
    
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.delay);
    }
  }
  
  flush() {
    if (this.updates.length > 0) {
      this.processor(this.updates);
      this.updates = [];
    }
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// 가시성 검사 최적화
export function isInViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number = 50
): boolean {
  return (
    x >= -padding &&
    x <= width + padding &&
    y >= -padding &&
    y <= height + padding
  );
}

// 거리 계산 최적화 (제곱근 없이)
export function distanceSquared(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

// 각도 정규화 (0-360)
export function normalizeAngle(angle: number): number {
  angle = angle % 360;
  return angle < 0 ? angle + 360 : angle;
}

// 캔버스 최적화 설정
export function optimizeCanvas(ctx: CanvasRenderingContext2D) {
  // 안티앨리어싱 비활성화 (성능 향상)
  ctx.imageSmoothingEnabled = false;
  
  // 합성 작업 최적화
  ctx.globalCompositeOperation = 'source-over';
  
  // 투명도 최적화
  ctx.globalAlpha = 1;
}

// 프레임 레이트 모니터
export class FPSMonitor {
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;
  
  update(): number {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
    
    return this.fps;
  }
  
  getFPS(): number {
    return this.fps;
  }
}