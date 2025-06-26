/**
 * 항공기 상태 분류 시스템
 * FAA RWSL 표준 속도 임계값 기반
 */

import { TrackedAircraft } from '../types';
import { RunwayOccupancyDetector } from './runwayOccupancy';

export enum AircraftState {
  PARKED = 'PARKED',           // < 5 knots
  TAXI = 'TAXI',               // 5-34 knots
  HIGH_SPEED = 'HIGH_SPEED',   // ≥ 30 knots (이륙/착륙)
  AIRBORNE = 'AIRBORNE',       // 고도 > 50ft
  APPROACH = 'APPROACH',       // 착륙 접근 중
  LANDING = 'LANDING',         // 착륙 중 (고도 낮고 하강)
  TAKEOFF = 'TAKEOFF'          // 이륙 중 (활주로에서 가속)
}

export interface ClassifiedAircraft extends TrackedAircraft {
  state: AircraftState;
  isAccelerating: boolean;
  assignedRunway?: string;
}

export class AircraftStateClassifier {
  private aircraftHistory: Map<number, TrackedAircraft[]> = new Map();
  private readonly HISTORY_SIZE = 10; // 1초간의 이력 (100ms 간격)
  
  // FAA 표준 속도 임계값
  private readonly PARKED_SPEED = 5;      // knots
  private readonly TAXI_SPEED = 34;       // knots  
  private readonly HIGH_SPEED = 30;       // knots
  private readonly LANDING_SPEED = 80;    // knots
  
  constructor(private runwayDetector: RunwayOccupancyDetector) {}
  
  /**
   * 항공기 상태 분류
   */
  classifyAircraft(aircraft: TrackedAircraft[]): ClassifiedAircraft[] {
    const classified: ClassifiedAircraft[] = [];
    
    aircraft.forEach(ac => {
      // 이력 업데이트
      this.updateHistory(ac);
      
      // 상태 분류
      const state = this.determineState(ac);
      const isAccelerating = this.calculateAcceleration(ac) > 0;
      const assignedRunway = this.detectAssignedRunway(ac);
      
      classified.push({
        ...ac,
        state,
        isAccelerating,
        assignedRunway
      });
    });
    
    return classified;
  }
  
  /**
   * 항공기 상태 결정
   */
  private determineState(aircraft: TrackedAircraft): AircraftState {
    // 공중
    if (aircraft.altitude > 50) {
      // 착륙 접근 판단
      if (aircraft.altitude < 1500 && 
          (aircraft.verticalSpeed || 0) < -100 &&
          aircraft.speed >= this.LANDING_SPEED) {
        return AircraftState.APPROACH;
      }
      return AircraftState.AIRBORNE;
    }
    
    // 지상 - 속도 기반 분류
    if (aircraft.speed < this.PARKED_SPEED) {
      return AircraftState.PARKED;
    }
    
    // 활주로 점유 확인
    const runwayOccupancy = this.runwayDetector.getOccupancySummary();
    const onRunway = Object.entries(runwayOccupancy).some(([runway, occupied]) => {
      if (!occupied) return false;
      const occupyingAircraft = this.runwayDetector.getOccupyingAircraft(runway);
      return occupyingAircraft.some(ac => ac.id === aircraft.id);
    });
    
    // 고속 이동 (30kt 이상)
    if (aircraft.speed >= this.HIGH_SPEED) {
      if (onRunway) {
        // 가속도로 이륙/착륙 구분
        const acceleration = this.calculateAcceleration(aircraft);
        return acceleration > 0 ? AircraftState.TAKEOFF : AircraftState.LANDING;
      }
      return AircraftState.HIGH_SPEED;
    }
    
    // 택시 상태 (5-34kt)
    if (aircraft.speed < this.TAXI_SPEED) {
      return AircraftState.TAXI;
    }
    
    // 34kt 이상이지만 활주로에 없으면 고속 택시
    return AircraftState.HIGH_SPEED;
  }
  
  /**
   * 가속도 계산 (m/s²)
   */
  private calculateAcceleration(aircraft: TrackedAircraft): number {
    const history = this.aircraftHistory.get(aircraft.id);
    if (!history || history.length < 2) return 0;
    
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    
    // 시간 차이 (초)
    const dt = 0.1; // 100ms 간격
    
    // 속도 변화 (m/s)
    const dv = (current.speed - previous.speed) * 0.514; // knots to m/s
    
    return dv / dt;
  }
  
  /**
   * 할당된 활주로 감지
   */
  private detectAssignedRunway(aircraft: TrackedAircraft): string | undefined {
    // 각 활주로별로 확인
    const runwayOccupancy = this.runwayDetector.getOccupancySummary();
    
    for (const [runway, occupied] of Object.entries(runwayOccupancy)) {
      if (occupied) {
        const occupyingAircraft = this.runwayDetector.getOccupyingAircraft(runway);
        if (occupyingAircraft.some(ac => ac.id === aircraft.id)) {
          return runway;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * 항공기 이력 업데이트
   */
  private updateHistory(aircraft: TrackedAircraft): void {
    if (!this.aircraftHistory.has(aircraft.id)) {
      this.aircraftHistory.set(aircraft.id, []);
    }
    
    const history = this.aircraftHistory.get(aircraft.id)!;
    history.push({ ...aircraft });
    
    // 이력 크기 제한
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
  }
  
  /**
   * 특정 상태의 항공기 필터링
   */
  filterByState(aircraft: ClassifiedAircraft[], state: AircraftState): ClassifiedAircraft[] {
    return aircraft.filter(ac => ac.state === state);
  }
  
  /**
   * 이륙 중인 항공기 찾기
   */
  getDepartingAircraft(aircraft: ClassifiedAircraft[]): ClassifiedAircraft[] {
    return aircraft.filter(ac => 
      ac.state === AircraftState.TAKEOFF ||
      (ac.state === AircraftState.HIGH_SPEED && ac.isAccelerating && ac.assignedRunway)
    );
  }
  
  /**
   * 착륙 중인 항공기 찾기
   */
  getArrivingAircraft(aircraft: ClassifiedAircraft[]): ClassifiedAircraft[] {
    return aircraft.filter(ac => 
      ac.state === AircraftState.LANDING ||
      ac.state === AircraftState.APPROACH
    );
  }
}