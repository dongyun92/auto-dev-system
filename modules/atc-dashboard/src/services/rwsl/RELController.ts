/**
 * REL (Runway Entrance Lights) 컨트롤러
 * RWSL 표준 기반 구현
 */

import { TrackedAircraft } from '../../types';
import { AircraftState, LightGroup, Light } from './RWSLCore';
import { calculateDistance } from '../../utils/rwslHelpers';

export interface RELActivation {
  lightGroupId: string;
  active: boolean;
  reason: string;
  confidence: number;
  cascadeOffTime?: number; // 소등 예정 시간
}

export class RELController {
  // FAA 표준 값
  private highSpeedThreshold: number = 30; // knots - 고속 이동 임계값
  private taxiSpeedThreshold: number = 34; // knots - 택시 상태 임계값  
  private landingSpeedThreshold: number = 80; // knots - 착륙 후 감속 임계값
  private approachDistanceThreshold: number = 1609; // meters (1 mile) - 착륙 접근 감지
  private cascadeLeadTime: number = 2.5; // seconds - 예상 분리 시간 (2-3초 평균)
  private approachAltitudeThreshold: number = 500; // feet AGL
  
  /**
   * REL 활성화 상태 계산
   */
  calculateRELStates(
    relGroups: LightGroup[],
    aircraft: TrackedAircraft[],
    runwayTraffic: Map<string, TrackedAircraft[]>
  ): RELActivation[] {
    const activations: RELActivation[] = [];
    
    relGroups.forEach(group => {
      const activation = this.evaluateRELGroup(group, aircraft, runwayTraffic);
      activations.push(activation);
    });
    
    return activations;
  }
  
  /**
   * 개별 REL 그룹 평가
   */
  private evaluateRELGroup(
    group: LightGroup,
    aircraft: TrackedAircraft[],
    runwayTraffic: Map<string, TrackedAircraft[]>
  ): RELActivation {
    // 기본 비활성 상태
    let activation: RELActivation = {
      lightGroupId: group.id,
      active: false,
      reason: 'No traffic',
      confidence: 1.0
    };
    
    // 1. 이륙 항공기 확인 (30 knots 이상)
    const departingAircraft = this.checkDepartingAircraft(
      group.runway,
      runwayTraffic
    );
    
    if (departingAircraft) {
      activation = {
        lightGroupId: group.id,
        active: true,
        reason: `Departing aircraft ${departingAircraft.aircraft.callsign} at ${departingAircraft.aircraft.speed}kt`,
        confidence: 0.95
      };
      
      // 캐스케이드 소등 계산 (2-3초 전)
      const cascadeOff = this.calculateCascadeOff(
        group,
        departingAircraft.aircraft,
        departingAircraft.distance
      );
      
      if (cascadeOff) {
        activation.cascadeOffTime = cascadeOff;
        if (Date.now() >= cascadeOff) {
          activation.active = false;
          activation.reason = 'Cascade off - aircraft passing';
        }
      }
      
      // 속도가 34kt 이하로 떨어지면 소등
      if (departingAircraft.aircraft.speed <= this.taxiSpeedThreshold) {
        activation.active = false;
        activation.reason = 'Aircraft below taxi speed';
      }
    }
    
    // 2. 착륙 항공기 확인 (1 mile 이내)
    const landingAircraft = this.checkLandingAircraft(
      group,
      aircraft
    );
    
    if (landingAircraft && !activation.active) {
      activation = {
        lightGroupId: group.id,
        active: true,
        reason: `Landing aircraft ${landingAircraft.aircraft.callsign} at ${Math.round(landingAircraft.distance)}m`,
        confidence: 0.9
      };
      
      // 착륙 후 80kt 이하로 감속하면 소등 준비
      if (landingAircraft.aircraft.altitude <= 50 && 
          landingAircraft.aircraft.speed <= this.landingSpeedThreshold) {
        // 34kt까지 감속하면 완전 소등
        if (landingAircraft.aircraft.speed <= this.taxiSpeedThreshold) {
          activation.active = false;
          activation.reason = 'Landing aircraft in taxi state';
        }
      }
    }
    
    // 3. 교차점 점유 확인
    const intersectionOccupied = this.checkIntersectionOccupancy(
      group,
      aircraft
    );
    
    if (intersectionOccupied && !activation.active) {
      activation = {
        lightGroupId: group.id,
        active: true,
        reason: 'Taxiway intersection occupied',
        confidence: 0.85
      };
    }
    
    return activation;
  }
  
  /**
   * 이륙 항공기 확인 (FAA: 30 knots 이상)
   */
  private checkDepartingAircraft(
    runway: string,
    runwayTraffic: Map<string, TrackedAircraft[]>
  ): { aircraft: TrackedAircraft; distance: number } | null {
    const traffic = runwayTraffic.get(runway) || [];
    
    for (const aircraft of traffic) {
      // FAA 표준: 30 knots 이상일 때 REL 활성화
      if (aircraft.speed >= this.highSpeedThreshold && aircraft.altitude <= 200) {
        // REL 그룹까지의 거리 계산 (실제 구현에서는 정확한 위치 사용)
        const distance = this.calculateDistanceToREL(aircraft);
        return { aircraft, distance };
      }
    }
    
    return null;
  }
  
  /**
   * 착륙 항공기 확인 (FAA: 1 mile 이내)
   */
  private checkLandingAircraft(
    group: LightGroup,
    aircraft: TrackedAircraft[]
  ): { aircraft: TrackedAircraft; distance: number } | null {
    // 활주로 임계값 위치 (실제로는 group의 runway 정보에서 가져옴)
    const thresholdPosition = this.getRunwayThreshold(group.runway);
    if (!thresholdPosition) return null;
    
    for (const ac of aircraft) {
      // 착륙 접근 중인 항공기
      if (ac.altitude > this.approachAltitudeThreshold) continue;
      if ((ac.verticalSpeed || 0) >= -100) continue; // 하강률 100fpm 이상
      if (!ac.assignedRunway?.includes(group.runway)) continue;
      
      const distance = calculateDistance(
        ac.latitude,
        ac.longitude,
        thresholdPosition.lat,
        thresholdPosition.lng
      );
      
      // FAA 표준: 1 mile (1609m) 이내에서 활성화
      if (distance <= this.approachDistanceThreshold) {
        return { aircraft: ac, distance };
      }
    }
    
    return null;
  }
  
  /**
   * 교차점 점유 확인
   */
  private checkIntersectionOccupancy(
    group: LightGroup,
    aircraft: TrackedAircraft[]
  ): boolean {
    // 해당 REL 그룹의 교차점 위치
    if (!group.position.taxiway) return false;
    
    // 교차점 근처 항공기 확인
    const intersectionPosition = this.getIntersectionPosition(group);
    if (!intersectionPosition) return false;
    
    for (const ac of aircraft) {
      if (ac.altitude > 50) continue; // 지상 항공기만
      if (ac.speed < 3) continue; // 이동 중인 항공기만
      
      const distance = calculateDistance(
        ac.latitude,
        ac.longitude,
        intersectionPosition.lat,
        intersectionPosition.lng
      );
      
      if (distance <= 50) { // 50m 이내
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 캐스케이드 소등 시간 계산 (FAA: 2-3초 전)
   */
  private calculateCascadeOff(
    group: LightGroup,
    aircraft: TrackedAircraft,
    currentDistance: number
  ): number | null {
    if (aircraft.speed <= 0) return null;
    
    // 항공기가 REL을 통과할 예상 시간
    const timeToReach = currentDistance / (aircraft.speed * 0.514); // seconds
    
    // FAA 표준: 교차점 도달 2-3초 전에 소등
    if (timeToReach <= this.cascadeLeadTime) {
      // 소등 시작 시간 = 현재 시간 + (도달 시간 - 리드 타임)
      const cascadeTime = Math.max(0, timeToReach - this.cascadeLeadTime);
      return Date.now() + (cascadeTime * 1000);
    }
    
    return null;
  }
  
  /**
   * 교차점 위치 가져오기
   */
  private getIntersectionPosition(
    group: LightGroup
  ): { lat: number; lng: number } | null {
    // 실제로는 공항 데이터베이스에서 가져옴
    // 여기서는 예시
    const intersections: Record<string, { lat: number; lng: number }> = {
      'A1': { lat: 37.5650, lng: 126.7800 },
      'B1': { lat: 37.5640, lng: 126.7810 },
      // ... 기타 교차점
    };
    
    return intersections[group.position.taxiway || ''] || null;
  }
  
  /**
   * REL 강도 계산 (디밍 지원)
   */
  calculateIntensity(
    activation: RELActivation,
    ambientLight: number
  ): number {
    if (!activation.active) return 0;
    
    // 기본 강도
    let intensity = 100;
    
    // 주간/야간 조정
    if (ambientLight > 50000) { // lux
      intensity = 100; // 주간 최대
    } else if (ambientLight > 10000) {
      intensity = 80; // 황혼
    } else {
      intensity = 60; // 야간 (눈부심 방지)
    }
    
    // 신뢰도에 따른 조정
    intensity *= activation.confidence;
    
    // 캐스케이드 소등 중이면 점진적 감소
    if (activation.cascadeOffTime) {
      const remaining = activation.cascadeOffTime - Date.now();
      if (remaining > 0 && remaining < 1000) { // 마지막 1초
        intensity *= remaining / 1000;
      }
    }
    
    return Math.round(intensity);
  }
  
  /**
   * 항공기에서 REL까지의 거리 계산
   */
  private calculateDistanceToREL(aircraft: TrackedAircraft): number {
    // 실제 구현에서는 정확한 REL 위치 사용
    // 여기서는 단순화된 거리 반환
    return 1000; // meters
  }
  
  /**
   * 활주로 임계값 위치 가져오기
   */
  private getRunwayThreshold(runway: string): { lat: number; lng: number } | null {
    const thresholds: Record<string, { lat: number; lng: number }> = {
      '14L': { lat: 37.5705, lng: 126.7784 },
      '14R': { lat: 37.5683, lng: 126.7755 },
      '32L': { lat: 37.5481, lng: 126.8009 },
      '32R': { lat: 37.5478, lng: 126.8070 }
    };
    
    // 활주로 이름에서 방향 추출
    const runwayDir = runway.match(/\d+[LR]/)?.[0];
    return runwayDir ? thresholds[runwayDir] : null;
  }
}