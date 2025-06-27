/**
 * RWSL 시스템과 RadarDisplay를 연결하는 어댑터
 * GimpoRWSLSystem과 기존 대시보드 간의 인터페이스
 */

import { GimpoRWSLSystem } from '../../core/rwsl/GimpoRWSLSystem';
import { CoordinateSystem } from '../../core/coordinates';
import { TrackedAircraft } from '../../types';
import { RWSLState, RWSLSystemStatus, PerformanceMetrics } from '../../types/rwsl';

export class RWSLAdapter {
  private rwslSystem: GimpoRWSLSystem;
  private coordinateSystem: CoordinateSystem;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private lastProcessedData: TrackedAircraft[] = [];
  
  // 콜백 함수들
  private onStateUpdate?: (state: RWSLState) => void;
  private onStatusUpdate?: (status: RWSLSystemStatus) => void;
  private onError?: (error: Error) => void;
  
  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
    this.rwslSystem = new GimpoRWSLSystem(coordinateSystem);
  }
  
  /**
   * RWSL 시스템 시작
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('RWSL 시스템이 이미 실행 중입니다.');
      return;
    }
    
    this.isRunning = true;
    // console.log('RWSL 시스템 시작');
    
    // 1초마다 처리 (설계 요구사항)
    this.processingInterval = setInterval(() => {
      this.processRWSLCycle();
    }, 1000);
  }
  
  /**
   * RWSL 시스템 중지
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // console.log('RWSL 시스템 중지');
  }
  
  /**
   * 항공기 데이터 업데이트
   */
  public updateAircraftData(aircraftData: TrackedAircraft[]): void {
    this.lastProcessedData = aircraftData;
    
    // 즉시 처리가 필요한 경우
    if (this.shouldProcessImmediately(aircraftData)) {
      this.processRWSLCycle();
    }
  }
  
  /**
   * RWSL 처리 사이클
   */
  private processRWSLCycle(): void {
    if (!this.isRunning || this.lastProcessedData.length === 0) {
      return;
    }
    
    try {
      // RWSL 시스템 처리
      const state = this.rwslSystem.processRWSL(this.lastProcessedData);
      
      // 상태 콜백 호출
      if (this.onStateUpdate) {
        this.onStateUpdate(state);
      }
      
      // 시스템 상태 업데이트
      const status = this.rwslSystem.getSystemStatus();
      if (this.onStatusUpdate) {
        this.onStatusUpdate(status);
      }
      
      // 위험 상황 감지 시 알림
      this.checkCriticalSituations(state);
      
    } catch (error) {
      console.error('RWSL 처리 중 오류:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }
  
  /**
   * 즉시 처리가 필요한지 확인
   */
  private shouldProcessImmediately(aircraftData: TrackedAircraft[]): boolean {
    // 활주로 근처 항공기 확인
    return aircraftData.some(aircraft => {
      if (!aircraft.isActive) return false;
      
      const localPos = this.coordinateSystem.toPlane(
        aircraft.latitude,
        aircraft.longitude
      );
      
      // 활주로 중심으로부터 500m 이내
      const distanceFromCenter = Math.sqrt(
        localPos.x * localPos.x + localPos.y * localPos.y
      );
      
      return distanceFromCenter < 500;
    });
  }
  
  /**
   * 위험 상황 확인
   */
  private checkCriticalSituations(state: RWSLState): void {
    const criticalConflicts = state.conflicts.filter(
      conflict => conflict.severity === 'CRITICAL'
    );
    
    if (criticalConflicts.length > 0) {
      console.warn('위험 상황 감지:', criticalConflicts);
      // 실제 시스템에서는 경보 발생
    }
  }
  
  /**
   * 이벤트 리스너 등록
   */
  public onStateChange(callback: (state: RWSLState) => void): void {
    this.onStateUpdate = callback;
  }
  
  public onStatusChange(callback: (status: RWSLSystemStatus) => void): void {
    this.onStatusUpdate = callback;
  }
  
  public onErrorOccurred(callback: (error: Error) => void): void {
    this.onError = callback;
  }
  
  /**
   * 현재 상태 조회
   */
  public getCurrentState(): RWSLState {
    return this.rwslSystem.getCurrentState();
  }
  
  public getSystemStatus(): RWSLSystemStatus {
    return this.rwslSystem.getSystemStatus();
  }
  
  public getPerformanceMetrics(): PerformanceMetrics {
    return this.rwslSystem.getPerformanceMetrics();
  }
  
  /**
   * 특정 위치 주변 항공기 조회
   */
  public getNearbyAircraft(lat: number, lon: number, radiusM: number): string[] {
    const planeCoords = this.coordinateSystem.toPlane(lat, lon);
    return this.rwslSystem.getNearbyAircraft(planeCoords, radiusM);
  }
  
  /**
   * 시스템 재설정
   */
  public reset(): void {
    this.stop();
    this.rwslSystem = new GimpoRWSLSystem(this.coordinateSystem);
    this.lastProcessedData = [];
  }
  
  /**
   * 디버그 정보
   */
  public getDebugInfo(): {
    isRunning: boolean;
    aircraftCount: number;
    lastUpdateTime: number;
    systemHealth: string;
  } {
    const state = this.rwslSystem.getCurrentState();
    const status = this.rwslSystem.getSystemStatus();
    
    return {
      isRunning: this.isRunning,
      aircraftCount: this.lastProcessedData.length,
      lastUpdateTime: state.lastUpdate,
      systemHealth: status.systemHealth.status
    };
  }
}