/**
 * RWSL 엔진 - FAA 표준 구현
 * 단순화된 REL/THL 로직
 */

import { TrackedAircraft } from '../types';
import { RKSS_AIRPORT_DATA, getRELPositions, getTHLPositions } from '../data/airportData';
import { RunwayOccupancyDetector } from './runwayOccupancy';
import { AircraftStateClassifier, AircraftState, ClassifiedAircraft } from './aircraftStateClassifier';

export interface LightState {
  id: string;
  type: 'REL' | 'THL';
  position: { lat: number; lng: number };
  active: boolean;
  reason?: string;
  runway?: string;
}

export interface RWSLState {
  rel: Map<string, LightState>;
  thl: Map<string, LightState>;
  lastUpdate: number;
}

export class RWSLEngine {
  private runwayDetector: RunwayOccupancyDetector;
  private aircraftClassifier: AircraftStateClassifier;
  private rwslState: RWSLState;
  
  // FAA 표준 값
  private readonly REL_APPROACH_DISTANCE = 1609; // 1 mile in meters
  private readonly REL_DEACTIVATION_SPEED = 34; // knots
  private readonly REL_HIGH_SPEED_THRESHOLD = 30; // knots
  private readonly THL_COVERAGE_DISTANCE = 457; // 1,500 feet in meters
  private readonly CASCADE_LEAD_TIME = 2.5; // seconds
  
  constructor() {
    this.runwayDetector = new RunwayOccupancyDetector();
    this.aircraftClassifier = new AircraftStateClassifier(this.runwayDetector);
    
    // RWSL 상태 초기화
    this.rwslState = {
      rel: new Map(),
      thl: new Map(),
      lastUpdate: Date.now()
    };
    
    this.initializeLights();
  }
  
  /**
   * 등화 초기화
   */
  private initializeLights(): void {
    // REL 초기화
    RKSS_AIRPORT_DATA.runways.forEach(runway => {
      Object.keys(runway.thresholds).forEach(threshold => {
        const relPositions = getRELPositions(threshold);
        relPositions.forEach(rel => {
          this.rwslState.rel.set(rel.id, {
            id: rel.id,
            type: 'REL',
            position: rel.position,
            active: false,
            runway: runway.id
          });
        });
      });
    });
    
    // THL 초기화
    RKSS_AIRPORT_DATA.runways.forEach(runway => {
      Object.keys(runway.thresholds).forEach(threshold => {
        const thlPositions = getTHLPositions(threshold);
        thlPositions.forEach(thl => {
          this.rwslState.thl.set(thl.id, {
            id: thl.id,
            type: 'THL',
            position: thl.position,
            active: false,
            runway: runway.id
          });
        });
      });
    });
  }
  
  /**
   * RWSL 상태 업데이트
   */
  update(aircraft: TrackedAircraft[]): RWSLState {
    // 활주로 점유 상태 업데이트
    const runwayOccupancy = this.runwayDetector.update(aircraft);
    
    // 항공기 상태 분류
    const classifiedAircraft = this.aircraftClassifier.classifyAircraft(aircraft);
    
    // REL 상태 업데이트
    this.updateRELStates(classifiedAircraft, runwayOccupancy);
    
    // THL 상태 업데이트
    this.updateTHLStates(classifiedAircraft, runwayOccupancy);
    
    this.rwslState.lastUpdate = Date.now();
    return this.rwslState;
  }
  
  /**
   * REL 상태 업데이트 (FAA 표준)
   */
  private updateRELStates(
    aircraft: ClassifiedAircraft[],
    runwayOccupancy: Map<string, any>
  ): void {
    this.rwslState.rel.forEach((light, lightId) => {
      let shouldActivate = false;
      let reason = '';
      
      // 1. 이륙 항공기 확인 (30 knots 이상)
      const departingAircraft = aircraft.filter(ac => 
        ac.state === AircraftState.TAKEOFF ||
        (ac.assignedRunway === light.runway && ac.speed >= this.REL_HIGH_SPEED_THRESHOLD)
      );
      
      if (departingAircraft.length > 0) {
        shouldActivate = true;
        reason = `Departing aircraft on runway (${departingAircraft[0].callsign})`;
        
        // 예상 분리: 2-3초 전 소등
        departingAircraft.forEach(ac => {
          const distance = this.calculateDistance(ac, light.position);
          const timeToReach = this.calculateTimeToReach(ac, distance);
          
          if (timeToReach <= this.CASCADE_LEAD_TIME && timeToReach > 0) {
            shouldActivate = false;
            reason = 'Cascade off - aircraft approaching';
          }
          
          // 34 knots 이하로 감속하면 소등
          if (ac.speed <= this.REL_DEACTIVATION_SPEED) {
            shouldActivate = false;
            reason = 'Aircraft below taxi speed';
          }
        });
      }
      
      // 2. 착륙 항공기 확인 (1 mile 이내)
      if (!shouldActivate && light.runway) {
        const runway = RKSS_AIRPORT_DATA.runways.find(r => r.id === light.runway);
        if (runway) {
          const arrivingAircraft = aircraft.filter(ac => 
            ac.state === AircraftState.APPROACH || ac.state === AircraftState.LANDING
          );
          
          arrivingAircraft.forEach(ac => {
            // 활주로 임계값까지의 거리
            Object.values(runway.thresholds).forEach(threshold => {
              const distanceToThreshold = this.calculateDistance(ac, threshold);
              
              if (distanceToThreshold <= this.REL_APPROACH_DISTANCE) {
                shouldActivate = true;
                reason = `Arriving aircraft within 1 mile (${ac.callsign})`;
                
                // 착륙 후 80kt 이하로 감속하면 소등 준비
                if (ac.altitude <= 50 && ac.speed <= 80) {
                  // 34kt까지 감속하면 완전 소등
                  if (ac.speed <= this.REL_DEACTIVATION_SPEED) {
                    shouldActivate = false;
                    reason = 'Landing aircraft in taxi state';
                  }
                }
              }
            });
          });
        }
      }
      
      // 등화 상태 업데이트
      light.active = shouldActivate;
      light.reason = reason;
    });
  }
  
  /**
   * THL 상태 업데이트 (FAA 표준)
   */
  private updateTHLStates(
    aircraft: ClassifiedAircraft[],
    runwayOccupancy: Map<string, any>
  ): void {
    this.rwslState.thl.forEach((light, lightId) => {
      let shouldActivate = false;
      let reason = '';
      
      if (!light.runway) return;
      
      // 활주로가 점유되어 있는지 확인
      const occupancy = runwayOccupancy.get(light.runway);
      if (!occupancy || !occupancy.occupied) {
        light.active = false;
        light.reason = 'Runway clear';
        return;
      }
      
      // 이륙 위치에 있는 항공기 확인
      const runway = RKSS_AIRPORT_DATA.runways.find(r => r.id === light.runway);
      if (!runway) return;
      
      // 각 임계값에서 이륙 대기 중인 항공기 확인
      Object.values(runway.thresholds).forEach(threshold => {
        const waitingAircraft = aircraft.filter(ac => {
          const distance = this.calculateDistance(ac, threshold);
          return distance <= 300 && // ICAO 표준 이륙 위치
                 ac.altitude <= 50 &&
                 ac.speed >= 5 &&
                 this.isAlignedWithRunway(ac, threshold.heading);
        });
        
        if (waitingAircraft.length > 0) {
          // 활주로가 점유되어 있으므로 THL 활성화
          shouldActivate = true;
          reason = `Runway occupied, aircraft ${waitingAircraft[0].callsign} in position`;
          
          // THL 커버리지 범위 (1,500ft) 내 충돌 위험 확인
          const conflictingAircraft = occupancy.aircraft.filter((occAc: TrackedAircraft) => {
            if (occAc.id === waitingAircraft[0].id) return false;
            
            const distance = this.calculateDistance(occAc, threshold);
            return distance <= this.THL_COVERAGE_DISTANCE;
          });
          
          if (conflictingAircraft.length > 0) {
            reason += `, conflict with ${conflictingAircraft[0].callsign}`;
          }
        }
      });
      
      // 등화 상태 업데이트
      light.active = shouldActivate;
      light.reason = reason;
    });
  }
  
  /**
   * 거리 계산 (미터)
   */
  private calculateDistance(
    aircraft: TrackedAircraft,
    position: { lat: number; lng: number }
  ): number {
    const R = 6371000; // 지구 반지름 (미터)
    const lat1 = aircraft.latitude * Math.PI / 180;
    const lat2 = position.lat * Math.PI / 180;
    const deltaLat = (position.lat - aircraft.latitude) * Math.PI / 180;
    const deltaLng = (position.lng - aircraft.longitude) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }
  
  /**
   * 도달 시간 계산 (초)
   */
  private calculateTimeToReach(aircraft: TrackedAircraft, distance: number): number {
    if (aircraft.speed <= 0) return Infinity;
    
    const speedMs = aircraft.speed * 0.514; // knots to m/s
    return distance / speedMs;
  }
  
  /**
   * 활주로 방향 정렬 확인
   */
  private isAlignedWithRunway(aircraft: TrackedAircraft, runwayHeading: number): boolean {
    let headingDiff = Math.abs(aircraft.heading - runwayHeading);
    if (headingDiff > 180) headingDiff = 360 - headingDiff;
    return headingDiff <= 10; // 10도 이내
  }
  
  /**
   * 현재 RWSL 상태 가져오기
   */
  getState(): RWSLState {
    return this.rwslState;
  }
  
  /**
   * 활성화된 REL 개수
   */
  getActiveRELCount(): number {
    let count = 0;
    this.rwslState.rel.forEach(light => {
      if (light.active) count++;
    });
    return count;
  }
  
  /**
   * 활성화된 THL 개수
   */
  getActiveTHLCount(): number {
    let count = 0;
    this.rwslState.thl.forEach(light => {
      if (light.active) count++;
    });
    return count;
  }
}