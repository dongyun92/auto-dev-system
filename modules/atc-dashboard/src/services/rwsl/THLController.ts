/**
 * THL (Takeoff Hold Lights) 컨트롤러
 * RWSL 표준 기반 구현 - 이중 추적 시스템
 */

import { TrackedAircraft } from '../../types';
import { AircraftState, LightGroup } from './RWSLCore';
import { calculateDistance, calculateTimeToConflict } from '../../utils/rwslHelpers';

export interface THLActivation {
  lightGroupId: string;
  active: boolean;
  reason: string;
  departureAircraft?: TrackedAircraft;
  conflictingAircraft?: TrackedAircraft;
  timeToConflict?: number;
  confidence: number;
}

export interface ConflictPair {
  departure: TrackedAircraft;
  conflicting: TrackedAircraft;
  type: 'LANDING' | 'CROSSING' | 'OPPOSITE_DEPARTURE';
  timeToConflict: number;
  separationRequired: number;
}

export class THLController {
  // FAA 표준 파라미터
  private conflictWindow: number = 8; // seconds (T_conf)
  private separationBuffer: number = 2; // seconds
  private thlCoverageDistance: number = 457; // meters (FAA: 1,500 feet)
  private positionTolerance: number = 300; // meters from threshold (ICAO standard)
  private headingTolerance: number = 10; // degrees
  private minDepartureSpeed: number = 5; // knots
  private highSpeedThreshold: number = 30; // knots (FAA 표준)
  private taxiSpeedThreshold: number = 34; // knots (FAA 표준)
  private landingSpeedThreshold: number = 80; // knots (FAA 표준)
  private anticipatedSeparationEnabled: boolean = true;
  private rotationSpeed: number = 80; // knots
  private clearanceTime: number = 5; // seconds after rotation
  
  /**
   * THL 활성화 상태 계산
   */
  calculateTHLStates(
    thlGroups: LightGroup[],
    aircraft: TrackedAircraft[],
    runwayStates: Map<string, AircraftState[]>
  ): THLActivation[] {
    const activations: THLActivation[] = [];
    
    thlGroups.forEach(group => {
      const activation = this.evaluateTHLGroup(group, aircraft, runwayStates);
      activations.push(activation);
    });
    
    return activations;
  }
  
  /**
   * 개별 THL 그룹 평가
   */
  private evaluateTHLGroup(
    group: LightGroup,
    aircraft: TrackedAircraft[],
    runwayStates: Map<string, AircraftState[]>
  ): THLActivation {
    // 1. 출발 항공기 식별
    const departureAircraft = this.identifyDepartureAircraft(
      group,
      aircraft
    );
    
    if (!departureAircraft) {
      return {
        lightGroupId: group.id,
        active: false,
        reason: 'No departure aircraft in position',
        confidence: 1.0
      };
    }
    
    // 2. 충돌 가능 항공기 검색
    const conflicts = this.findConflictingAircraft(
      departureAircraft,
      group.runway,
      aircraft,
      runwayStates
    );
    
    if (conflicts.length === 0) {
      return {
        lightGroupId: group.id,
        active: false,
        reason: 'No conflicting traffic',
        departureAircraft,
        confidence: 0.95
      };
    }
    
    // 3. 가장 가까운 충돌 선택
    const criticalConflict = this.selectCriticalConflict(conflicts);
    
    // 4. 예상 분리 확인
    if (this.anticipatedSeparationEnabled) {
      const hasAnticipatedSeparation = this.checkAnticipatedSeparation(
        criticalConflict
      );
      
      if (hasAnticipatedSeparation) {
        return {
          lightGroupId: group.id,
          active: false,
          reason: 'Anticipated separation available',
          departureAircraft,
          conflictingAircraft: criticalConflict.conflicting,
          timeToConflict: criticalConflict.timeToConflict,
          confidence: 0.85
        };
      }
    }
    
    // 5. THL 활성화
    return {
      lightGroupId: group.id,
      active: true,
      reason: `Conflict with ${criticalConflict.conflicting.callsign} (${criticalConflict.type})`,
      departureAircraft,
      conflictingAircraft: criticalConflict.conflicting,
      timeToConflict: criticalConflict.timeToConflict,
      confidence: this.calculateConfidence(criticalConflict)
    };
  }
  
  /**
   * 출발 항공기 식별
   */
  private identifyDepartureAircraft(
    group: LightGroup,
    aircraft: TrackedAircraft[]
  ): TrackedAircraft | null {
    // THL 위치 (활주로 임계값)
    const thresholdPosition = this.getThresholdPosition(group);
    if (!thresholdPosition) return null;
    
    // 활주로 방향
    const runwayHeading = this.getRunwayHeading(group.runway);
    
    for (const ac of aircraft) {
      // 지상에 있어야 함
      if (ac.altitude > 50) continue;
      
      // 임계값 근처 확인 (300m 이내)
      const distance = calculateDistance(
        ac.latitude,
        ac.longitude,
        thresholdPosition.lat,
        thresholdPosition.lng
      );
      
      if (distance > this.positionTolerance) continue;
      
      // 활주로 방향 정렬 확인
      let headingDiff = Math.abs(ac.heading - runwayHeading);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;
      
      if (headingDiff > this.headingTolerance) continue;
      
      // 이륙 의도 확인 (속도 또는 가속)
      if (ac.speed >= this.minDepartureSpeed) {
        return ac;
      }
    }
    
    return null;
  }
  
  /**
   * 충돌 가능 항공기 검색
   */
  private findConflictingAircraft(
    departure: TrackedAircraft,
    runway: string,
    aircraft: TrackedAircraft[],
    runwayStates: Map<string, AircraftState[]>
  ): ConflictPair[] {
    const conflicts: ConflictPair[] = [];
    
    aircraft.forEach(ac => {
      if (ac.id === departure.id) return;
      
      // 1. 착륙 항공기
      if (this.isLandingAircraft(ac, runway)) {
        const timeToConflict = this.calculateLandingConflict(
          departure,
          ac,
          runway
        );
        
        if (timeToConflict < this.conflictWindow) {
          conflicts.push({
            departure,
            conflicting: ac,
            type: 'LANDING',
            timeToConflict,
            separationRequired: 90 // seconds
          });
        }
      }
      
      // 2. 교차 활주로 항공기
      const crossingConflict = this.checkCrossingTraffic(
        departure,
        ac,
        runway
      );
      
      if (crossingConflict) {
        conflicts.push(crossingConflict);
      }
      
      // 3. 반대 방향 출발
      if (this.isOppositeDepature(ac, runway)) {
        const timeToConflict = this.calculateOppositeConflict(
          departure,
          ac,
          runway
        );
        
        if (timeToConflict < this.conflictWindow) {
          conflicts.push({
            departure,
            conflicting: ac,
            type: 'OPPOSITE_DEPARTURE',
            timeToConflict,
            separationRequired: 180 // seconds
          });
        }
      }
    });
    
    return conflicts;
  }
  
  /**
   * 착륙 항공기 확인
   */
  private isLandingAircraft(
    aircraft: TrackedAircraft,
    runway: string
  ): boolean {
    // 접근 중
    if (aircraft.altitude > 1500) return false;
    if ((aircraft.verticalSpeed || 0) >= -100) return false;
    
    // 속도 범위 확인 (FAA: 80kt 이상일 때 착륙 단계)
    if (aircraft.speed < this.landingSpeedThreshold) return false;
    
    // 활주로 정렬
    return aircraft.assignedRunway === runway;
  }
  
  /**
   * 착륙 충돌 시간 계산
   */
  private calculateLandingConflict(
    departure: TrackedAircraft,
    landing: TrackedAircraft,
    runway: string
  ): number {
    // THL 커버리지 영역(1,500ft) 내에 있는지 확인
    const thresholdPos = this.getThresholdPosition({ runway } as LightGroup);
    if (!thresholdPos) return Infinity;
    
    const distanceFromThreshold = calculateDistance(
      landing.latitude,
      landing.longitude,
      thresholdPos.lat,
      thresholdPos.lng
    );
    
    // FAA: THL은 대기 항공기 전방 1,500ft를 커버
    if (distanceFromThreshold > this.thlCoverageDistance) {
      return Infinity; // 커버리지 밖
    }
    
    // 착륙 항공기의 활주로 도달 시간
    const landingETA = this.estimateLandingTime(landing, runway);
    
    // 출발 항공기의 이륙 완료 시간
    const departureTime = this.estimateTakeoffTime(departure);
    
    // 시간 차이
    return Math.abs(landingETA - departureTime);
  }
  
  /**
   * 교차 활주로 확인
   */
  private checkCrossingTraffic(
    departure: TrackedAircraft,
    other: TrackedAircraft,
    runway: string
  ): ConflictPair | null {
    // 김포공항의 경우 14L/32R과 14R/32L이 평행
    // 실제 교차는 없지만, 근접 평행 활주로 운영 확인
    
    const parallelRunways = this.getParallelRunways(runway);
    if (!parallelRunways.includes(other.assignedRunway || '')) {
      return null;
    }
    
    // 동시 운영 확인
    if (other.speed >= 30 && other.altitude <= 50) {
      return {
        departure,
        conflicting: other,
        type: 'CROSSING',
        timeToConflict: 5, // 근접 운영
        separationRequired: 30
      };
    }
    
    return null;
  }
  
  /**
   * 가장 위험한 충돌 선택
   */
  private selectCriticalConflict(conflicts: ConflictPair[]): ConflictPair {
    return conflicts.reduce((critical, current) => {
      // 분리 여유 계산
      const criticalMargin = critical.timeToConflict - this.separationBuffer;
      const currentMargin = current.timeToConflict - this.separationBuffer;
      
      // 더 가까운 충돌 선택
      return currentMargin < criticalMargin ? current : critical;
    });
  }
  
  /**
   * 예상 분리 확인
   */
  private checkAnticipatedSeparation(conflict: ConflictPair): boolean {
    if (conflict.type !== 'LANDING') return false;
    
    // 선행 항공기가 회전 속도 도달했는지
    if (conflict.conflicting.speed >= this.rotationSpeed) {
      // 추가 여유 시간 확인
      return conflict.timeToConflict > (this.conflictWindow + this.clearanceTime);
    }
    
    return false;
  }
  
  /**
   * 신뢰도 계산
   */
  private calculateConfidence(conflict: ConflictPair): number {
    let confidence = 0.9;
    
    // 충돌 유형별 조정
    switch (conflict.type) {
      case 'LANDING':
        confidence = 0.95; // 가장 정확
        break;
      case 'CROSSING':
        confidence = 0.85;
        break;
      case 'OPPOSITE_DEPARTURE':
        confidence = 0.80;
        break;
    }
    
    // 시간 여유에 따른 조정
    const margin = conflict.timeToConflict - this.separationBuffer;
    if (margin < 2) {
      confidence += 0.05; // 임박한 충돌은 더 확실
    }
    
    return Math.min(confidence, 1.0);
  }
  
  // 헬퍼 메서드들
  private getThresholdPosition(group: LightGroup): { lat: number; lng: number } | null {
    // 실제로는 공항 데이터베이스에서
    const thresholds: Record<string, { lat: number; lng: number }> = {
      '14L': { lat: 37.5706, lng: 126.7784 },
      '14R': { lat: 37.5683, lng: 126.7755 },
      '32L': { lat: 37.5481, lng: 126.8009 },
      '32R': { lat: 37.5478, lng: 126.8070 }
    };
    
    const runwayEnd = group.runway.substring(0, 3);
    return thresholds[runwayEnd] || null;
  }
  
  private getRunwayHeading(runway: string): number {
    return runway.includes('14') ? 143 : 323;
  }
  
  private getParallelRunways(runway: string): string[] {
    const runwayMap: Record<string, string[]> = {
      '14L/32R': ['14R/32L'],
      '14R/32L': ['14L/32R']
    };
    return runwayMap[runway] || [];
  }
  
  private isOppositeDepature(aircraft: TrackedAircraft, runway: string): boolean {
    if (!aircraft.assignedRunway) return false;
    if (aircraft.altitude > 50) return false;
    if (aircraft.speed < 30) return false;
    
    // 같은 활주로의 반대편
    const oppositeEnds: Record<string, string> = {
      '14L': '32R',
      '32R': '14L',
      '14R': '32L',
      '32L': '14R'
    };
    
    const currentEnd = runway.substring(0, 3);
    const assignedEnd = aircraft.assignedRunway.substring(0, 3);
    
    return oppositeEnds[currentEnd] === assignedEnd;
  }
  
  private estimateLandingTime(aircraft: TrackedAircraft, runway: string): number {
    // 단순화: 고도와 하강률 기반
    const timeToTouchdown = aircraft.altitude / Math.abs(aircraft.verticalSpeed || 500) * 60;
    return timeToTouchdown;
  }
  
  private estimateTakeoffTime(aircraft: TrackedAircraft): number {
    // FAA 표준: 30kt 이상이면 이륙 진행 중
    if (aircraft.speed >= this.highSpeedThreshold) {
      return 20; // 이미 가속 중
    }
    return 30; // 정지 상태에서 시작
  }
  
  private calculateOppositeConflict(
    departure: TrackedAircraft,
    opposite: TrackedAircraft,
    runway: string
  ): number {
    // 활주로 길이와 양 항공기 속도 고려
    const runwayLength = 3600; // meters (김포공항)
    const combinedSpeed = (departure.speed + opposite.speed) * 0.514; // m/s
    
    if (combinedSpeed > 0) {
      return runwayLength / combinedSpeed;
    }
    
    return Infinity;
  }
}