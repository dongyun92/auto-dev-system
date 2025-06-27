/**
 * 김포공항 실시간 충돌 감지 시스템
 * 설계 문서 기반 구현
 */

import {
  ConflictType,
  ConflictSeverity,
  ConflictEvent,
  RunwayOccupancy,
  RunwayDirection
} from '../../types/rwsl';
import { TrackedAircraft } from '../../types';
import { CoordinateSystem } from '../coordinates';
import { PlaneCoordinate } from '../../types/coordinates';

interface RunwayBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  centerlineY: number;
}

interface ApproachPath {
  finalApproachZone: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  glideSlopeAltitude: (distance: number) => number;
  centerlineY: number;
}

interface WakeCategory {
  category: 'HEAVY' | 'MEDIUM' | 'LIGHT';
  separationRequirements: Map<string, number>;
}

export class GimpoCollisionDetector {
  private coordinateSystem: CoordinateSystem;
  private runwayBounds: Map<string, RunwayBounds>;
  private approachPaths: Map<string, ApproachPath>;
  private wakeCategories: Map<string, WakeCategory>;
  private activeFlights: Map<string, TrackedAircraft>;
  private runwayOccupancy: Map<string, RunwayOccupancy>;

  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
    this.activeFlights = new Map();
    this.runwayOccupancy = new Map();
    this.runwayBounds = new Map();
    this.approachPaths = new Map();
    this.wakeCategories = new Map();
    
    // 김포공항 활주로 정의
    this.initializeRunwayBounds();
    this.initializeApproachPaths();
    this.initializeWakeCategories();
  }

  private initializeRunwayBounds(): void {
    this.runwayBounds = new Map([
      ['14L_32R', {
        xMin: -1600,
        xMax: 1600,
        yMin: 25,
        yMax: 85,
        centerlineY: 55
      }],
      ['14R_32L', {
        xMin: -1600,
        xMax: 1600,
        yMin: -85,
        yMax: -25,
        centerlineY: -55
      }]
    ]);
  }

  private initializeApproachPaths(): void {
    this.approachPaths = new Map([
      ['14L', {
        finalApproachZone: { xMin: -3000, xMax: -1600, yMin: 25, yMax: 200 },
        glideSlopeAltitude: (distance: number) => 18 + (distance * Math.tan(3 * Math.PI / 180)),
        centerlineY: 55
      }],
      ['32R', {
        finalApproachZone: { xMin: 1600, xMax: 3000, yMin: 25, yMax: 200 },
        glideSlopeAltitude: (distance: number) => 18 + (distance * Math.tan(3 * Math.PI / 180)),
        centerlineY: 55
      }],
      ['14R', {
        finalApproachZone: { xMin: -3000, xMax: -1600, yMin: -200, yMax: -25 },
        glideSlopeAltitude: (distance: number) => 18 + (distance * Math.tan(3 * Math.PI / 180)),
        centerlineY: -55
      }],
      ['32L', {
        finalApproachZone: { xMin: 1600, xMax: 3000, yMin: -200, yMax: -25 },
        glideSlopeAltitude: (distance: number) => 18 + (distance * Math.tan(3 * Math.PI / 180)),
        centerlineY: -55
      }]
    ]);
  }

  private initializeWakeCategories(): void {
    // 항공기 유형별 후류 분류
    const wakeSeparationRequirements = new Map([
      ['HEAVY-HEAVY', 4 * 1852], // 4 NM
      ['HEAVY-MEDIUM', 5 * 1852], // 5 NM
      ['HEAVY-LIGHT', 6 * 1852], // 6 NM
      ['MEDIUM-LIGHT', 3 * 1852], // 3 NM
      ['MEDIUM-MEDIUM', 3 * 1852], // 3 NM
      ['LIGHT-LIGHT', 3 * 1852] // 3 NM
    ]);

    this.wakeCategories = new Map([
      ['B747', { category: 'HEAVY', separationRequirements: wakeSeparationRequirements }],
      ['B777', { category: 'HEAVY', separationRequirements: wakeSeparationRequirements }],
      ['A330', { category: 'HEAVY', separationRequirements: wakeSeparationRequirements }],
      ['A340', { category: 'HEAVY', separationRequirements: wakeSeparationRequirements }],
      ['A380', { category: 'HEAVY', separationRequirements: wakeSeparationRequirements }],
      ['B737', { category: 'MEDIUM', separationRequirements: wakeSeparationRequirements }],
      ['B738', { category: 'MEDIUM', separationRequirements: wakeSeparationRequirements }],
      ['A320', { category: 'MEDIUM', separationRequirements: wakeSeparationRequirements }],
      ['A321', { category: 'MEDIUM', separationRequirements: wakeSeparationRequirements }],
      ['AT72', { category: 'LIGHT', separationRequirements: wakeSeparationRequirements }],
      ['DH8D', { category: 'LIGHT', separationRequirements: wakeSeparationRequirements }],
      ['CRJ9', { category: 'LIGHT', separationRequirements: wakeSeparationRequirements }]
    ]);
  }

  /**
   * 메인 충돌 감지 함수
   */
  public detectConflicts(flightData: TrackedAircraft[]): ConflictEvent[] {
    // 1. 현재 항공기 상태 업데이트
    this.updateFlightStates(flightData);
    
    // 2. 활주로 점유 상태 업데이트
    this.updateRunwayOccupancy(flightData);
    
    // 3. 각 유형별 충돌 감지
    const conflicts: ConflictEvent[] = [];
    conflicts.push(...this.detectRunwayIntrusion());
    conflicts.push(...this.detectCrossingConflicts());
    conflicts.push(...this.detectWakeTurbulenceConflicts());
    conflicts.push(...this.detectSimultaneousOperations());
    
    // 4. 충돌 우선순위 및 심각도 평가
    return this.prioritizeConflicts(conflicts);
  }

  private updateFlightStates(flightData: TrackedAircraft[]): void {
    this.activeFlights.clear();
    flightData.forEach(aircraft => {
      if (aircraft.isActive) {
        this.activeFlights.set(aircraft.id.toString(), aircraft);
      }
    });
  }

  private updateRunwayOccupancy(flightData: TrackedAircraft[]): void {
    this.runwayOccupancy.clear();
    
    // 각 활주로별 점유 상태 분석
    ['14L_32R', '14R_32L'].forEach(runway => {
      const occupancy: RunwayOccupancy = {
        runway: runway as any,
        occupied: false,
        aircraft: [],
        occupancyType: null
      };

      flightData.forEach(aircraft => {
        if (this.isOnRunway(aircraft, runway)) {
          occupancy.occupied = true;
          occupancy.aircraft.push(aircraft);
          occupancy.occupancyType = this.classifyOccupancyType(aircraft);
        }
      });

      this.runwayOccupancy.set(runway, occupancy);
    });
  }

  private isOnRunway(aircraft: TrackedAircraft, runway: string): boolean {
    const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const bounds = this.runwayBounds.get(runway);
    
    if (!bounds) return false;
    
    return localPos.x >= bounds.xMin && 
           localPos.x <= bounds.xMax &&
           localPos.y >= bounds.yMin && 
           localPos.y <= bounds.yMax;
  }

  private classifyOccupancyType(aircraft: TrackedAircraft): 'TAKEOFF' | 'LANDING' | 'TAXI' | 'LINEUP' {
    if (aircraft.speed >= 50) {
      return (aircraft.verticalSpeed || 0) > 0 ? 'TAKEOFF' : 'LANDING';
    } else if (aircraft.speed >= 5) {
      return 'TAXI';
    } else {
      return 'LINEUP';
    }
  }

  /**
   * 활주로 무단 침입 감지
   */
  private detectRunwayIntrusion(): ConflictEvent[] {
    const conflicts: ConflictEvent[] = [];
    
    this.runwayOccupancy.forEach((occupancy, runway) => {
      if (!occupancy.occupied) return;
      
      // 접근 중인 항공기 확인
      const approachingAircraft = this.getApproachingAircraft(runway);
      
      // 진입하려는 항공기 확인
      const intendingAircraft = this.getRunwayIntendingAircraft(runway);
      
      // 충돌 분석
      approachingAircraft.forEach(approaching => {
        occupancy.aircraft.forEach(occupying => {
          const conflict = this.analyzeRunwayIntrusionConflict(
            approaching, occupying, runway
          );
          if (conflict) conflicts.push(conflict);
        });
        
        intendingAircraft.forEach(intending => {
          const conflict = this.analyzeRunwayIntrusionConflict(
            approaching, intending, runway
          );
          if (conflict) conflicts.push(conflict);
        });
      });
    });
    
    return conflicts;
  }

  private getApproachingAircraft(runway: string): TrackedAircraft[] {
    const approaching: TrackedAircraft[] = [];
    
    this.activeFlights.forEach(aircraft => {
      // 착륙 접근 중: 고도 1500ft 이하, 하강 중
      if (aircraft.altitude <= 1500 && (aircraft.verticalSpeed || 0) < -100) {
        const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
        
        // 각 활주로 방향별 접근 경로 확인
        ['14L', '32R', '14R', '32L'].forEach(direction => {
          const path = this.approachPaths.get(direction);
          if (path && this.isInApproachZone(localPos, path.finalApproachZone)) {
            approaching.push(aircraft);
          }
        });
      }
    });
    
    return approaching;
  }

  private getRunwayIntendingAircraft(runway: string): TrackedAircraft[] {
    const intending: TrackedAircraft[] = [];
    
    this.activeFlights.forEach(aircraft => {
      // 지상에서 활주로 근처
      if (aircraft.altitude <= 50 && aircraft.speed < 30) {
        const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
        const bounds = this.runwayBounds.get(runway);
        
        if (bounds) {
          // 활주로 진입 지점 근처 (300m 이내)
          const distanceToRunway = Math.min(
            Math.abs(localPos.x - bounds.xMin),
            Math.abs(localPos.x - bounds.xMax)
          );
          
          if (distanceToRunway < 300) {
            intending.push(aircraft);
          }
        }
      }
    });
    
    return intending;
  }

  private isInApproachZone(pos: PlaneCoordinate, zone: any): boolean {
    return pos.x >= zone.xMin && 
           pos.x <= zone.xMax &&
           pos.y >= zone.yMin && 
           pos.y <= zone.yMax;
  }

  private analyzeRunwayIntrusionConflict(
    aircraftA: TrackedAircraft,
    aircraftB: TrackedAircraft,
    runway: string
  ): ConflictEvent | null {
    // 미래 위치 예측 (2분 후)
    const futureA = this.predictFuturePosition(aircraftA, 120);
    const futureB = this.predictFuturePosition(aircraftB, 120);
    
    // 활주로 보호구역 내 동시 존재 여부 확인
    const bounds = this.runwayBounds.get(runway);
    if (!bounds) return null;
    
    const timeInZoneA = this.calculateTimeInZone(aircraftA, bounds);
    const timeInZoneB = this.calculateTimeInZone(aircraftB, bounds);
    
    // 시간 겹침 확인
    const overlap = this.calculateTimeOverlap(timeInZoneA, timeInZoneB);
    
    if (overlap > 0) {
      const minSeparation = this.calculateMinimumSeparation(aircraftA, aircraftB);
      const predictedSeparation = this.calculateDistance(futureA, futureB);
      
      if (predictedSeparation < minSeparation) {
        const severity = this.calculateConflictSeverity(
          predictedSeparation, minSeparation, overlap
        );
        
        return {
          id: `intrusion_${aircraftA.id}_${aircraftB.id}_${Date.now()}`,
          type: ConflictType.RUNWAY_INTRUSION,
          severity,
          aircraftInvolved: [aircraftA.id.toString(), aircraftB.id.toString()],
          runwayInvolved: [runway],
          predictedTime: new Date(Date.now() + overlap * 1000),
          confidence: 0.85,
          recommendedAction: this.recommendAction(aircraftA, aircraftB, severity),
          estimatedSeparation: predictedSeparation
        };
      }
    }
    
    return null;
  }

  /**
   * 교차 트래픽 충돌 감지
   */
  private detectCrossingConflicts(): ConflictEvent[] {
    const conflicts: ConflictEvent[] = [];
    
    // 김포공항의 주요 교차점
    const intersectionPoints = [
      {
        id: 'runway_intersection',
        runways: ['14L_32R', '14R_32L'],
        position: { x: 0, y: 0 }, // 활주로 교차점
        criticalZoneRadius: 200
      }
    ];
    
    intersectionPoints.forEach(intersection => {
      const aircraftInArea = this.getAircraftNearIntersection(intersection);
      
      if (aircraftInArea.length >= 2) {
        for (let i = 0; i < aircraftInArea.length; i++) {
          for (let j = i + 1; j < aircraftInArea.length; j++) {
            const conflict = this.analyzeIntersectionConflict(
              aircraftInArea[i], aircraftInArea[j], intersection
            );
            if (conflict) conflicts.push(conflict);
          }
        }
      }
    });
    
    return conflicts;
  }

  private getAircraftNearIntersection(intersection: any): TrackedAircraft[] {
    const nearby: TrackedAircraft[] = [];
    
    this.activeFlights.forEach(aircraft => {
      const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
      const distance = Math.sqrt(
        Math.pow(localPos.x - intersection.position.x, 2) +
        Math.pow(localPos.y - intersection.position.y, 2)
      );
      
      if (distance <= intersection.criticalZoneRadius) {
        nearby.push(aircraft);
      }
    });
    
    return nearby;
  }

  private analyzeIntersectionConflict(
    aircraftA: TrackedAircraft,
    aircraftB: TrackedAircraft,
    intersection: any
  ): ConflictEvent | null {
    // 두 항공기가 교차점에 도달하는 시간 계산
    const timeToIntersectionA = this.calculateTimeToPoint(aircraftA, intersection.position);
    const timeToIntersectionB = this.calculateTimeToPoint(aircraftB, intersection.position);
    
    const timeDifference = Math.abs(timeToIntersectionA - timeToIntersectionB);
    
    // 30초 이내에 동시 도달 예상
    if (timeDifference < 30) {
      const severity = timeDifference < 10 ? 'CRITICAL' : 
                      timeDifference < 20 ? 'HIGH' : 'MEDIUM';
      
      return {
        id: `crossing_${aircraftA.id}_${aircraftB.id}_${Date.now()}`,
        type: ConflictType.CROSSING_TRAFFIC,
        severity: severity as ConflictSeverity,
        aircraftInvolved: [aircraftA.id.toString(), aircraftB.id.toString()],
        runwayInvolved: intersection.runways,
        predictedTime: new Date(Date.now() + Math.min(timeToIntersectionA, timeToIntersectionB) * 1000),
        confidence: 0.75,
        recommendedAction: `Hold ${aircraftA.id.toString()} or expedite ${aircraftB.id.toString()}`,
        estimatedSeparation: timeDifference * 10 // 대략적인 거리
      };
    }
    
    return null;
  }

  /**
   * 후류 난기류 충돌 감지
   */
  private detectWakeTurbulenceConflicts(): ConflictEvent[] {
    const conflicts: ConflictEvent[] = [];
    
    // 각 활주로별로 연속 운항 분석
    ['14L_32R', '14R_32L'].forEach(runway => {
      const runwayTraffic = this.getRunwaySequence(runway);
      
      for (let i = 0; i < runwayTraffic.length - 1; i++) {
        const leading = runwayTraffic[i];
        const following = runwayTraffic[i + 1];
        
        const leadingCategory = this.getWakeCategory(leading.aircraftType || 'UNKNOWN');
        const followingCategory = this.getWakeCategory(following.aircraftType || 'UNKNOWN');
        
        const key = `${leadingCategory}-${followingCategory}`;
        const requiredSeparation = this.wakeCategories.values().next().value?.separationRequirements.get(key) || 3 * 1852;
        
        // 시간 간격을 거리로 변환
        const currentSeparation = this.calculateSeparation(leading, following);
        
        if (currentSeparation < requiredSeparation) {
          conflicts.push({
            id: `wake_${leading.id}_${following.id}_${Date.now()}`,
            type: ConflictType.WAKE_TURBULENCE,
            severity: this.calculateWakeSeverity(currentSeparation, requiredSeparation),
            aircraftInvolved: [leading.id.toString(), following.id.toString()],
            runwayInvolved: [runway],
            predictedTime: new Date(),
            confidence: 0.8,
            recommendedAction: `Increase separation to ${Math.round(requiredSeparation)}m`,
            estimatedSeparation: currentSeparation
          });
        }
      }
    });
    
    return conflicts;
  }

  private getRunwaySequence(runway: string): TrackedAircraft[] {
    const sequence: TrackedAircraft[] = [];
    const occupancy = this.runwayOccupancy.get(runway);
    
    if (occupancy && occupancy.aircraft.length > 0) {
      // 활주로 위치 순으로 정렬
      sequence.push(...occupancy.aircraft.sort((a, b) => {
        const posA = this.coordinateSystem.toPlane(a.latitude, a.longitude);
        const posB = this.coordinateSystem.toPlane(b.latitude, b.longitude);
        return posA.x - posB.x;
      }));
    }
    
    return sequence;
  }

  private getWakeCategory(aircraftType: string): string {
    const category = this.wakeCategories.get(aircraftType);
    return category?.category || 'MEDIUM';
  }

  private calculateWakeSeverity(actual: number, required: number): ConflictSeverity {
    const ratio = actual / required;
    
    if (ratio < 0.5) return 'CRITICAL';
    if (ratio < 0.7) return 'HIGH';
    if (ratio < 0.9) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 동시 운항 충돌 감지
   */
  private detectSimultaneousOperations(): ConflictEvent[] {
    const conflicts: ConflictEvent[] = [];
    
    // 평행 활주로 동시 이륙/착륙 확인
    const runway1 = this.runwayOccupancy.get('14L_32R');
    const runway2 = this.runwayOccupancy.get('14R_32L');
    
    if (runway1?.occupied && runway2?.occupied) {
      runway1.aircraft.forEach(ac1 => {
        runway2.aircraft.forEach(ac2 => {
          // 동시 이륙 상황
          if (ac1.speed > 50 && ac2.speed > 50) {
            const separation = this.calculateLateralSeparation(ac1, ac2);
            
            if (separation < 300) { // 300m 미만
              conflicts.push({
                id: `simultaneous_${ac1.id}_${ac2.id}_${Date.now()}`,
                type: ConflictType.SIMULTANEOUS_TAKEOFF,
                severity: 'HIGH',
                aircraftInvolved: [ac1.id.toString(), ac2.id.toString()],
                runwayInvolved: ['14L_32R', '14R_32L'],
                predictedTime: new Date(),
                confidence: 0.9,
                recommendedAction: 'Stagger takeoff times',
                estimatedSeparation: separation
              });
            }
          }
        });
      });
    }
    
    return conflicts;
  }

  /**
   * 보조 함수들
   */
  private predictFuturePosition(aircraft: TrackedAircraft, timeSeconds: number): PlaneCoordinate {
    const currentPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const speedMs = aircraft.speed * 0.514444; // knots to m/s
    const headingRad = aircraft.heading * Math.PI / 180;
    
    const distance = speedMs * timeSeconds;
    
    return {
      x: currentPos.x + distance * Math.sin(headingRad),
      y: currentPos.y + distance * Math.cos(headingRad),
      z: aircraft.altitude * 0.3048 // feet to meters
    };
  }

  private calculateTimeInZone(aircraft: TrackedAircraft, zone: RunwayBounds): { enter: number; exit: number } {
    const pos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const speedMs = aircraft.speed * 0.514444;
    
    // 간단한 추정 (실제로는 더 정교한 계산 필요)
    const distanceToEnter = Math.max(0, zone.xMin - pos.x);
    const distanceToExit = zone.xMax - pos.x;
    
    return {
      enter: distanceToEnter / speedMs,
      exit: distanceToExit / speedMs
    };
  }

  private calculateTimeOverlap(timeA: { enter: number; exit: number }, timeB: { enter: number; exit: number }): number {
    const overlapStart = Math.max(timeA.enter, timeB.enter);
    const overlapEnd = Math.min(timeA.exit, timeB.exit);
    return Math.max(0, overlapEnd - overlapStart);
  }

  private calculateMinimumSeparation(aircraftA: TrackedAircraft, aircraftB: TrackedAircraft): number {
    const baseSeparation = 500; // 기본 500m
    
    // 속도별 가중치
    const maxSpeed = Math.max(aircraftA.speed, aircraftB.speed);
    const speedMultiplier = 1.0 + (maxSpeed - 100) / 500;
    
    return baseSeparation * speedMultiplier;
  }

  private calculateDistance(posA: PlaneCoordinate, posB: PlaneCoordinate): number {
    return Math.sqrt(
      Math.pow(posA.x - posB.x, 2) +
      Math.pow(posA.y - posB.y, 2) +
      Math.pow((posA.z || 0) - (posB.z || 0), 2)
    );
  }

  private calculateSeparation(aircraftA: TrackedAircraft, aircraftB: TrackedAircraft): number {
    const posA = this.coordinateSystem.toPlane(aircraftA.latitude, aircraftB.longitude);
    const posB = this.coordinateSystem.toPlane(aircraftB.latitude, aircraftB.longitude);
    return this.calculateDistance(posA, posB);
  }

  private calculateLateralSeparation(aircraftA: TrackedAircraft, aircraftB: TrackedAircraft): number {
    const posA = this.coordinateSystem.toPlane(aircraftA.latitude, aircraftA.longitude);
    const posB = this.coordinateSystem.toPlane(aircraftB.latitude, aircraftB.longitude);
    return Math.abs(posA.y - posB.y);
  }

  private calculateTimeToPoint(aircraft: TrackedAircraft, point: PlaneCoordinate): number {
    const currentPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const distance = this.calculateDistance(currentPos, point);
    const speedMs = aircraft.speed * 0.514444;
    return speedMs > 0 ? distance / speedMs : Infinity;
  }

  private calculateConflictSeverity(
    predictedSeparation: number,
    minSeparation: number,
    timeToConflict: number
  ): ConflictSeverity {
    const separationRatio = predictedSeparation / minSeparation;
    const timeFactor = Math.max(0, 1 - timeToConflict / 60);
    const riskScore = (1 - separationRatio) + timeFactor;
    
    if (riskScore >= 1.5) return 'EMERGENCY';
    if (riskScore >= 1.2) return 'CRITICAL';
    if (riskScore >= 0.8) return 'HIGH';
    if (riskScore >= 0.4) return 'MEDIUM';
    return 'LOW';
  }

  private recommendAction(
    aircraftA: TrackedAircraft,
    aircraftB: TrackedAircraft,
    severity: ConflictSeverity
  ): string {
    const actions = {
      EMERGENCY: 'IMMEDIATE STOP - All aircraft hold position',
      CRITICAL: 'Hold short of runway',
      HIGH: 'Reduce speed - maintain separation',
      MEDIUM: 'Monitor closely',
      LOW: 'Continue monitoring'
    };
    
    return `${actions[severity]} - ${aircraftA.id.toString()}, ${aircraftB.id.toString()}`;
  }

  private prioritizeConflicts(conflicts: ConflictEvent[]): ConflictEvent[] {
    return conflicts.sort((a, b) => {
      // 심각도 우선
      const severityOrder = { EMERGENCY: 5, CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // 시간 긴급도
      const timeA = a.predictedTime.getTime() - Date.now();
      const timeB = b.predictedTime.getTime() - Date.now();
      return timeA - timeB;
    });
  }
}