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
  private activationRange: number = 3700; // meters (2NM)
  private cascadeLeadTime: number = 3; // seconds
  private highSpeedThreshold: number = 30; // knots
  private approachDistanceThreshold: number = 1852; // meters (1NM)
  private approachAltitudeThreshold: number = 300; // feet AGL
  
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
    
    // 1. 고속 활주로 트래픽 확인
    const runwayHighSpeed = this.checkHighSpeedRunwayTraffic(
      group.runway,
      runwayTraffic
    );
    
    if (runwayHighSpeed) {
      activation = {
        lightGroupId: group.id,
        active: true,
        reason: `High speed traffic on runway ${group.runway}`,
        confidence: 0.95
      };
      
      // 캐스케이드 소등 계산
      const cascadeOff = this.calculateCascadeOff(
        group,
        runwayHighSpeed.aircraft,
        runwayHighSpeed.distance
      );
      
      if (cascadeOff) {
        activation.cascadeOffTime = cascadeOff;
        if (Date.now() >= cascadeOff) {
          activation.active = false;
          activation.reason = 'Cascade off - aircraft passed';
        }
      }
    }
    
    // 2. 접근 항공기 확인 (착륙)
    const approaching = this.checkApproachingAircraft(
      group,
      aircraft
    );
    
    if (approaching && !activation.active) {
      activation = {
        lightGroupId: group.id,
        active: true,
        reason: `Aircraft ${approaching.callsign} approaching runway`,
        confidence: 0.9
      };
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
   * 고속 활주로 트래픽 확인
   */
  private checkHighSpeedRunwayTraffic(
    runway: string,
    runwayTraffic: Map<string, TrackedAircraft[]>
  ): { aircraft: TrackedAircraft; distance: number } | null {
    const traffic = runwayTraffic.get(runway) || [];
    
    for (const aircraft of traffic) {
      if (aircraft.speed >= this.highSpeedThreshold) {
        // REL 그룹까지의 거리는 실제 구현에서 계산
        // 여기서는 단순화
        return { aircraft, distance: 1000 };
      }
    }
    
    return null;
  }
  
  /**
   * 접근 항공기 확인
   */
  private checkApproachingAircraft(
    group: LightGroup,
    aircraft: TrackedAircraft[]
  ): TrackedAircraft | null {
    // 활주로 임계값 위치 (실제로는 group의 runway 정보에서 가져옴)
    const thresholdPosition = { lat: 37.5706, lng: 126.7784 }; // 예시
    
    for (const ac of aircraft) {
      // 접근 중인 항공기만
      if (ac.altitude > this.approachAltitudeThreshold) continue;
      if ((ac.verticalSpeed || 0) >= 0) continue; // 하강 중이어야 함
      
      const distance = calculateDistance(
        ac.latitude,
        ac.longitude,
        thresholdPosition.lat,
        thresholdPosition.lng
      );
      
      if (distance <= this.approachDistanceThreshold) {
        return ac;
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
   * 캐스케이드 소등 시간 계산
   */
  private calculateCascadeOff(
    group: LightGroup,
    aircraft: TrackedAircraft,
    currentDistance: number
  ): number | null {
    if (aircraft.speed <= 0) return null;
    
    // 항공기가 REL을 통과할 예상 시간
    const timeToReach = currentDistance / (aircraft.speed * 0.514); // seconds
    
    if (timeToReach <= this.cascadeLeadTime) {
      // 소등 시작
      return Date.now() + (timeToReach * 1000);
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
}