/**
 * RWSL 시스템 어댑터
 * GimpoRWSLSystem을 React 컴포넌트에서 사용하기 위한 어댑터
 */

import { GimpoRWSLSystem } from '../../core/rwsl/GimpoRWSLSystem';
import { CoordinateSystem } from '../../core/coordinates';
import { TrackedAircraft } from '../../types';
import { RWSLState, RWSLSystemStatus, ConflictEvent, RunwayOccupancy } from '../../types/rwsl';

type StateChangeCallback = (state: RWSLState) => void;
type ErrorCallback = (error: Error) => void;

export class RWSLAdapter {
  private rwslSystem: GimpoRWSLSystem;
  private coordinateSystem: CoordinateSystem;
  private updateInterval: NodeJS.Timeout | null = null;
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private isRunning: boolean = false;
  private lastAircraftData: TrackedAircraft[] = [];

  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
    this.rwslSystem = new GimpoRWSLSystem(coordinateSystem);
  }

  /**
   * RWSL 시스템 시작
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('[RWSLAdapter] RWSL 시스템 시작');

    // 주기적으로 시스템 상태 업데이트
    this.updateInterval = setInterval(() => {
      this.processUpdate();
    }, 100); // 100ms 간격으로 업데이트
  }

  /**
   * RWSL 시스템 정지
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('[RWSLAdapter] RWSL 시스템 정지');
  }

  /**
   * 항공기 데이터 업데이트
   */
  public updateAircraftData(aircraft: TrackedAircraft[]): void {
    this.lastAircraftData = aircraft;
    if (this.isRunning) {
      this.processUpdate();
    }
  }

  /**
   * 시스템 상태 가져오기
   */
  public getSystemStatus(): RWSLSystemStatus {
    return this.rwslSystem.getSystemStatus();
  }

  /**
   * 충돌 정보 가져오기
   */
  public getConflicts(): ConflictEvent[] {
    return this.rwslSystem.getConflicts();
  }

  /**
   * 활주로 점유 정보 가져오기
   */
  public getRunwayOccupancy(): Map<string, RunwayOccupancy> {
    return this.rwslSystem.getRunwayOccupancy();
  }

  /**
   * 접근 항공기 정보 가져오기
   */
  public getApproachingAircraft(): Map<string, string[]> {
    return this.rwslSystem.checkApproachingAircraft(this.lastAircraftData);
  }

  /**
   * 상태 변경 콜백 등록
   */
  public onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * 오류 콜백 등록
   */
  public onErrorOccurred(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * 업데이트 처리
   */
  private processUpdate(): void {
    try {
      // RWSL 시스템에 항공기 데이터 처리
      this.rwslSystem.processRWSL(this.lastAircraftData);

      // 현재 상태 가져오기
      const currentState = this.rwslSystem.getCurrentState();

      // 모든 콜백에 상태 전달
      this.stateChangeCallbacks.forEach(callback => {
        try {
          callback(currentState);
        } catch (error) {
          console.error('[RWSLAdapter] 콜백 실행 오류:', error);
        }
      });
    } catch (error) {
      console.error('[RWSLAdapter] 업데이트 처리 오류:', error);
      
      // 오류 콜백 실행
      this.errorCallbacks.forEach(callback => {
        try {
          callback(error as Error);
        } catch (callbackError) {
          console.error('[RWSLAdapter] 오류 콜백 실행 오류:', callbackError);
        }
      });
    }
  }
}