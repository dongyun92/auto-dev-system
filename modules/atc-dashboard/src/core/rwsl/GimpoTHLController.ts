/**
 * 김포공항 THL(Takeoff Hold Lights) 제어 시스템
 * 설계 문서 기반 구현
 */

import {
  THLConfiguration,
  THLControlDecision,
  THLCommand,
  TakeoffReadyAnalysis,
  AircraftApproachData,
  ConflictAnalysis,
  ConflictDetail
} from '../../types/rwsl';
import { TrackedAircraft } from '../../types';
import { CoordinateSystem } from '../coordinates';
import { PlaneCoordinate } from '../../types/coordinates';
import rwslLightPositions from '../../data/rwslLightPositions.json';

interface ApproachStatus {
  isApproaching: boolean;
  runway: string;
  distance: number;
  approachQuality: 'GOOD' | 'MARGINAL' | 'POOR';
}

interface TakeoffReadinessStatus {
  isReadyForTakeoff: boolean;
  runway: string;
  position: PlaneCoordinate;
  readiness: 'holding' | 'lineup_ready' | 'takeoff_ready' | 'rolling';
  holdPositionDistance: number;
}

interface TimeConflictAnalysis {
  isConflict: boolean;
  separation: number;
  minimumRequired: number;
  shortfall: number;
  severity: string;
  conflictType: string;
}

export class GimpoTHLController {
  private coordinateSystem: CoordinateSystem;
  private thlLights: Map<string, THLConfiguration>;
  private approachingAircraft: Map<string, AircraftApproachData>;
  private conflictWindow: number = 8; // seconds
  private separationBuffer: number = 2; // seconds
  private thlCoverageDistance: number = 457; // meters (1,500 feet)
  private positionTolerance: number = 300; // meters from threshold

  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
    this.thlLights = new Map();
    this.approachingAircraft = new Map();
    
    // 김포공항 THL 구성 초기화
    this.initializeTHLConfiguration();
  }

  private initializeTHLConfiguration(): void {
    // rwslLightPositions.json에서 THL 데이터 읽기
    const thlConfigurations: THLConfiguration[] = [];
    
    console.log('[RWSL] THL 데이터 로드 시작:', {
      hasTHL: !!rwslLightPositions.lights.THL,
      runways: Object.keys(rwslLightPositions.lights.THL || {})
    });
    
    // JSON 데이터에서 THL 변환
    Object.entries(rwslLightPositions.lights.THL || {}).forEach(([runway, lights]) => {
      if (Array.isArray(lights)) {
        console.log(`[RWSL] ${runway} THL 개수:`, lights.length);
        // RunwayDirection 타입 검증
        if (!['14L', '32R', '14R', '32L'].includes(runway)) {
          console.error(`[RWSL] 잘못된 활주로 방향: ${runway}`);
          return;
        }
        const runwayDirection = runway as '14L' | '32R' | '14R' | '32L';
        
        lights.forEach((light, index) => {
          const localCoords = this.coordinateSystem.toPlane(light.position.lat, light.position.lng);
          thlConfigurations.push({
            id: light.id,
            type: 'THL' as const,
            runway: runwayDirection,
            position: {
              lat: light.position.lat,
              lon: light.position.lng,
              localCoords: localCoords
            },
            purpose: `${runway} 이륙 대기`,
            coverageArea: 200,
            direction: runway.startsWith('14') ? 'eastbound' as const : 'westbound' as const
          });
        });
      }
    });
    
    // 하드코딩된 설정 제거
    /*
    const thlConfigurations: THLConfiguration[] = [
      // 주요 이륙 대기점
      {
        id: "THL_14L_HOLD",
        type: 'THL',
        runway: '14L',
        position: {
          lat: 37.571833,
          lon: 126.779167,
          localCoords: { x: -1580, y: 55, z: 0 }
        },
        purpose: "14L 이륙 대기",
        coverageArea: 200,
        direction: "eastbound"
      },
      {
        id: "THL_32R_HOLD",
        type: 'THL',
        runway: '32R',
        position: {
          lat: 37.544789,
          lon: 126.802011,
          localCoords: { x: 1580, y: 55, z: 0 }
        },
        purpose: "32R 이륙 대기",
        coverageArea: 200,
        direction: "westbound"
      },
      {
        id: "THL_14R_HOLD",
        type: 'THL',
        runway: '14R',
        position: {
          lat: 37.571833,
          lon: 126.773889,
          localCoords: { x: -1580, y: -55, z: 0 }
        },
        purpose: "14R 이륙 대기",
        coverageArea: 200,
        direction: "eastbound"
      },
      {
        id: "THL_32L_HOLD",
        type: 'THL',
        runway: '32L',
        position: {
          lat: 37.544789,
          lon: 126.807222,
          localCoords: { x: 1580, y: -55, z: 0 }
        },
        purpose: "32L 이륙 대기",
        coverageArea: 200,
        direction: "westbound"
      },
      // 중간 대기점 (교차점 근처)
      {
        id: "THL_14L_INTERSECT",
        type: 'THL',
        runway: '14L',
        position: {
          lat: 37.558311,
          lon: 126.790572,
          localCoords: { x: -100, y: 55, z: 0 }
        },
        purpose: "교차점 이전 이륙 대기",
        coverageArea: 150,
        direction: "eastbound"
      },
      {
        id: "THL_32R_INTERSECT",
        type: 'THL',
        runway: '32R',
        position: {
          lat: 37.558311,
          lon: 126.790572,
          localCoords: { x: 100, y: 55, z: 0 }
        },
        purpose: "교차점 이전 이륙 대기",
        coverageArea: 150,
        direction: "westbound"
      },
      {
        id: "THL_14R_INTERSECT",
        type: 'THL',
        runway: '14R',
        position: {
          lat: 37.558311,
          lon: 126.790572,
          localCoords: { x: -100, y: -55, z: 0 }
        },
        purpose: "교차점 이전 이륙 대기",
        coverageArea: 150,
        direction: "eastbound"
      },
      {
        id: "THL_32L_INTERSECT",
        type: 'THL',
        runway: '32L',
        position: {
          lat: 37.558311,
          lon: 126.790572,
          localCoords: { x: 100, y: -55, z: 0 }
        },
        purpose: "교차점 이전 이륙 대기",
        coverageArea: 150,
        direction: "westbound"
      }
    ];
    */

    thlConfigurations.forEach(config => {
      this.thlLights.set(config.id, config);
    });
  }

  /**
   * THL 제어 결정 처리
   */
  public processTakeoffHoldScenarios(
    aircraftData: TrackedAircraft[]
  ): THLControlDecision[] {
    // 1. 착륙 접근 항공기 감지
    const approachingAnalysis = this.analyzeApproachingAircraft(aircraftData);
    
    // 2. 이륙 대기 항공기 감지
    const takeoffReadyAnalysis = this.analyzeTakeoffReadyAircraft(aircraftData);
    
    // 3. THL 제어 결정
    const thlDecisions = this.makeTHLControlDecisions(approachingAnalysis, takeoffReadyAnalysis);
    
    return thlDecisions;
  }

  /**
   * 착륙 접근 항공기 분석
   */
  private analyzeApproachingAircraft(aircraftData: TrackedAircraft[]): Map<string, AircraftApproachData[]> {
    const approachMap = new Map<string, AircraftApproachData[]>();
    
    // 각 활주로별 초기화
    ['14L', '32R', '14R', '32L'].forEach(runway => {
      approachMap.set(runway, []);
    });
    
    aircraftData.forEach(aircraft => {
      const approachStatus = this.determineApproachStatus(aircraft);
      
      if (approachStatus.isApproaching) {
        const distanceToThreshold = this.calculateDistanceToThreshold(
          this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude),
          approachStatus.runway
        );
        
        const approachData: AircraftApproachData = {
          aircraft,
          targetRunway: approachStatus.runway,
          distanceToThreshold,
          estimatedLandingTime: this.estimateLandingTime(aircraft, approachStatus),
          approachSpeed: aircraft.speed,
          approachPhase: this.classifyApproachPhase(aircraft, approachStatus),
          conflictPotential: this.assessConflictPotential(aircraft, approachStatus)
        };
        
        const runwayApproaches = approachMap.get(approachStatus.runway) || [];
        runwayApproaches.push(approachData);
        approachMap.set(approachStatus.runway, runwayApproaches);
        
        // 전역 접근 항공기 맵에도 저장
        this.approachingAircraft.set(aircraft.id.toString(), approachData);
      }
    });
    
    return approachMap;
  }

  /**
   * 이륙 대기 항공기 분석
   */
  private analyzeTakeoffReadyAircraft(aircraftData: TrackedAircraft[]): TakeoffReadyAnalysis[] {
    const takeoffReady: TakeoffReadyAnalysis[] = [];
    
    aircraftData.forEach(aircraft => {
      const takeoffStatus = this.determineTakeoffReadiness(aircraft);
      
      if (takeoffStatus.isReadyForTakeoff) {
        takeoffReady.push({
          aircraft,
          assignedRunway: takeoffStatus.runway,
          positionOnRunway: takeoffStatus.position,
          readinessLevel: takeoffStatus.readiness,
          estimatedTakeoffTime: this.estimateTakeoffTime(aircraft, takeoffStatus),
          takeoffClearanceStatus: this.checkTakeoffClearance(aircraft)
        });
      }
    });
    
    return takeoffReady;
  }

  /**
   * THL 제어 결정
   */
  private makeTHLControlDecisions(
    approachingAircraft: Map<string, AircraftApproachData[]>,
    takeoffReadyAircraft: TakeoffReadyAnalysis[]
  ): THLControlDecision[] {
    const decisions: THLControlDecision[] = [];
    
    // 각 활주로별 THL 제어 결정
    ['14L', '32R', '14R', '32L'].forEach(runway => {
      const approaches = approachingAircraft.get(runway) || [];
      const takeoffReady = takeoffReadyAircraft.filter(a => a.assignedRunway === runway);
      
      const runwayDecision = this.makeRunwayTHLDecision(runway, approaches, takeoffReady);
      
      if (runwayDecision.controlAction !== 'NO_ACTION') {
        decisions.push(runwayDecision);
      }
    });
    
    return decisions;
  }

  /**
   * 활주로별 THL 제어 결정
   */
  private makeRunwayTHLDecision(
    runway: string,
    approaches: AircraftApproachData[],
    takeoffReady: TakeoffReadyAnalysis[]
  ): THLControlDecision {
    const decision: THLControlDecision = {
      runway,
      controlAction: 'NO_ACTION',
      affectedTHLLights: [],
      reasoning: '',
      priority: 'LOW',
      conflictScenarios: []
    };
    
    // 시나리오 1: 착륙 접근 중 + 이륙 대기 항공기 있음
    if (approaches.length > 0 && takeoffReady.length > 0) {
      const conflictAnalysis = this.analyzeApproachTakeoffConflict(approaches, takeoffReady);
      
      if (conflictAnalysis.hasConflict) {
        decision.controlAction = 'ACTIVATE_RED';
        decision.affectedTHLLights = this.getTHLsForRunway(runway);
        decision.reasoning = `착륙 접근 중 (${approaches.length}대), 이륙 대기 중 (${takeoffReady.length}대)`;
        decision.priority = this.calculateConflictPriority(conflictAnalysis);
        decision.conflictScenarios = [conflictAnalysis];
        decision.detailedCommands = this.generateTHLCommands(runway, conflictAnalysis);
      }
    }
    // 시나리오 2: 연속 이륙 간격 부족
    else if (takeoffReady.length > 1) {
      const sequenceAnalysis = this.analyzeTakeoffSequence(takeoffReady);
      
      if (sequenceAnalysis.needsDelay) {
        decision.controlAction = 'SELECTIVE_ACTIVATION';
        decision.affectedTHLLights = this.getSelectiveTHLs(runway, sequenceAnalysis);
        decision.reasoning = `연속 이륙 간격 조정 필요 (${takeoffReady.length}대 대기)`;
        decision.priority = 'MEDIUM';
        decision.detailedCommands = this.generateSequenceCommands(runway, sequenceAnalysis);
      }
    }
    // 시나리오 3: 교차점 통과 제어
    else if (this.needsIntersectionControl(runway, approaches, takeoffReady)) {
      decision.controlAction = 'INTERSECTION_HOLD';
      decision.affectedTHLLights = this.getIntersectionTHLs(runway);
      decision.reasoning = '교차점 통과 대기 필요';
      decision.priority = 'HIGH';
    }
    
    return decision;
  }

  /**
   * 접근-이륙 충돌 분석
   */
  private analyzeApproachTakeoffConflict(
    approaches: AircraftApproachData[],
    takeoffReady: TakeoffReadyAnalysis[]
  ): ConflictAnalysis {
    let hasConflict = false;
    let conflictSeverity = 'LOW';
    const conflictDetails: ConflictDetail[] = [];
    
    approaches.forEach(approach => {
      takeoffReady.forEach(takeoff => {
        // THL 커버리지 영역 내인지 확인
        if (approach.distanceToThreshold <= this.thlCoverageDistance) {
          const timeConflict = this.analyzeTimeConflict(approach, takeoff);
          
          if (timeConflict.isConflict) {
            hasConflict = true;
            
            conflictDetails.push({
              approachingAircraft: approach.aircraft.id.toString(),
              takeoffAircraft: takeoff.aircraft.id.toString(),
              estimatedLandingTime: approach.estimatedLandingTime,
              estimatedTakeoffTime: takeoff.estimatedTakeoffTime,
              timeSeparation: timeConflict.separation,
              minimumRequiredSeparation: timeConflict.minimumRequired,
              severity: timeConflict.severity
            });
            
            if (this.getSeverityLevel(timeConflict.severity) > this.getSeverityLevel(conflictSeverity)) {
              conflictSeverity = timeConflict.severity;
            }
          }
        }
      });
    });
    
    return {
      hasConflict,
      severity: conflictSeverity,
      conflictDetails,
      recommendedAction: this.getRecommendedAction(conflictSeverity, conflictDetails)
    };
  }

  /**
   * 시간 충돌 분석
   */
  private analyzeTimeConflict(
    approach: AircraftApproachData,
    takeoff: TakeoffReadyAnalysis
  ): TimeConflictAnalysis {
    const landingTime = approach.estimatedLandingTime;
    const takeoffTime = takeoff.estimatedTakeoffTime;
    const timeSeparation = Math.abs(landingTime - takeoffTime) / 1000; // seconds
    
    // 김포공항 최소 분리 기준
    const minimumSeparations = {
      landing_before_takeoff: 120, // 착륙 후 2분 이후 이륙 허용
      takeoff_before_landing: 90,  // 이륙 후 1.5분 이후 착륙 허용
      wake_turbulence: this.calculateWakeTurbulenceSeparation(approach.aircraft, takeoff.aircraft)
    };
    
    let minimumRequired: number;
    let conflictType: string;
    
    if (landingTime < takeoffTime) {
      minimumRequired = Math.max(
        minimumSeparations.landing_before_takeoff,
        minimumSeparations.wake_turbulence
      );
      conflictType = 'landing_before_takeoff';
    } else {
      minimumRequired = Math.max(
        minimumSeparations.takeoff_before_landing,
        minimumSeparations.wake_turbulence
      );
      conflictType = 'takeoff_before_landing';
    }
    
    const isConflict = timeSeparation < minimumRequired;
    let severity: string;
    
    if (isConflict) {
      const shortfall = minimumRequired - timeSeparation;
      if (shortfall > 60) severity = 'CRITICAL';
      else if (shortfall > 30) severity = 'HIGH';
      else severity = 'MEDIUM';
    } else {
      severity = 'LOW';
    }
    
    return {
      isConflict,
      separation: timeSeparation,
      minimumRequired,
      shortfall: isConflict ? minimumRequired - timeSeparation : 0,
      severity,
      conflictType
    };
  }

  /**
   * THL 명령 생성
   */
  private generateTHLCommands(runway: string, conflictAnalysis: ConflictAnalysis): THLCommand[] {
    const commands: THLCommand[] = [];
    const thlIds = this.getTHLsForRunway(runway);
    
    thlIds.forEach(thlId => {
      const urgency = this.calculateUrgency(conflictAnalysis.severity);
      
      commands.push({
        thlId,
        command: 'RED_ON',
        intensity: this.calculateIntensity(urgency),
        flashPattern: this.getFlashPattern(urgency),
        activationDelay: this.calculateActivationDelay(conflictAnalysis),
        duration: this.calculateActivationDuration(conflictAnalysis),
        priority: conflictAnalysis.severity
      });
    });
    
    return commands;
  }

  /**
   * 보조 함수들
   */
  private determineApproachStatus(aircraft: TrackedAircraft): ApproachStatus {
    // 착륙 접근 조건: 고도 1500ft 이하, 하강 중
    if (aircraft.altitude > 1500 || (aircraft.verticalSpeed || 0) >= -100) {
      return { isApproaching: false } as ApproachStatus;
    }
    
    const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    
    // 각 활주로 접근 경로 확인
    const approachPaths = {
      '14L': { xMin: -3000, xMax: -1600, yMin: 25, yMax: 200 },
      '32R': { xMin: 1600, xMax: 3000, yMin: 25, yMax: 200 },
      '14R': { xMin: -3000, xMax: -1600, yMin: -200, yMax: -25 },
      '32L': { xMin: 1600, xMax: 3000, yMin: -200, yMax: -25 }
    };
    
    for (const [runway, path] of Object.entries(approachPaths)) {
      if (this.isInZone(localPos, path)) {
        const distance = this.calculateDistanceToThreshold(localPos, runway);
        const altitudeDifference = Math.abs(aircraft.altitude * 0.3048 - (18 + distance * Math.tan(3 * Math.PI / 180)));
        
        return {
          isApproaching: true,
          runway,
          distance,
          approachQuality: altitudeDifference < 30 ? 'GOOD' : altitudeDifference < 50 ? 'MARGINAL' : 'POOR'
        };
      }
    }
    
    return { isApproaching: false } as ApproachStatus;
  }

  private determineTakeoffReadiness(aircraft: TrackedAircraft): TakeoffReadinessStatus {
    // 지상에 있고 속도가 낮은 항공기
    if (aircraft.altitude > 50 || aircraft.speed > 50) {
      return { isReadyForTakeoff: false } as TakeoffReadinessStatus;
    }
    
    const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    
    // THL 대기점 영역 확인
    let closestTHL: THLConfiguration | null = null;
    let minDistance = Infinity;
    
    this.thlLights.forEach(thl => {
      const distance = this.calculateDistance(localPos, thl.position.localCoords);
      if (distance < minDistance && distance <= thl.coverageArea) {
        minDistance = distance;
        closestTHL = thl;
      }
    });
    
    if (!closestTHL) {
      return { isReadyForTakeoff: false } as TakeoffReadinessStatus;
    }
    
    const readinessLevel = this.assessReadinessLevel(aircraft, minDistance);
    const thl = closestTHL as THLConfiguration; // Type assertion
    
    return {
      isReadyForTakeoff: true,
      runway: String(thl.runway),
      position: localPos,
      readiness: readinessLevel,
      holdPositionDistance: minDistance
    };
  }

  private assessReadinessLevel(
    aircraft: TrackedAircraft,
    distanceToHold: number
  ): 'holding' | 'lineup_ready' | 'takeoff_ready' | 'rolling' {
    if (aircraft.speed > 30) return 'rolling';
    if (distanceToHold < 50 && aircraft.speed < 5) return 'takeoff_ready';
    if (distanceToHold < 100) return 'lineup_ready';
    return 'holding';
  }

  private estimateLandingTime(aircraft: TrackedAircraft, approach: ApproachStatus): number {
    const timeToTouchdown = approach.distance / (aircraft.speed * 0.514444); // seconds
    return Date.now() + timeToTouchdown * 1000;
  }

  private estimateTakeoffTime(aircraft: TrackedAircraft, status: TakeoffReadinessStatus): number {
    const timeEstimates = {
      holding: 120,
      lineup_ready: 90,
      takeoff_ready: 30,
      rolling: 0
    };
    
    const baseTime = timeEstimates[status.readiness] || 120;
    
    // 항공기 기종별 조정
    const aircraftAdjustments: Record<string, number> = {
      'AT72': -15,
      'B737': 0,
      'A320': 5,
      'A321': 15
    };
    
    const adjustment = aircraftAdjustments[aircraft.aircraftType || ''] || 0;
    return Date.now() + (baseTime + adjustment) * 1000;
  }

  private classifyApproachPhase(aircraft: TrackedAircraft, approach: ApproachStatus): 'INITIAL' | 'INTERMEDIATE' | 'FINAL' | 'SHORT_FINAL' {
    if (approach.distance < 500) return 'SHORT_FINAL';
    if (approach.distance < 1000) return 'FINAL';
    if (approach.distance < 2000) return 'INTERMEDIATE';
    return 'INITIAL';
  }

  private assessConflictPotential(aircraft: TrackedAircraft, approach: ApproachStatus): number {
    const qualityScores = { GOOD: 0.2, MARGINAL: 0.5, POOR: 0.8 };
    const distanceScore = Math.max(0, 1 - approach.distance / 3000);
    const speedScore = aircraft.speed / 200;
    
    return (qualityScores[approach.approachQuality] + distanceScore + speedScore) / 3;
  }

  private checkTakeoffClearance(aircraft: TrackedAircraft): boolean {
    // 실제로는 ATC 시스템과 연동
    // 여기서는 간단히 구현
    return aircraft.speed < 5;
  }

  private calculateWakeTurbulenceSeparation(landing: TrackedAircraft, takeoff: TrackedAircraft): number {
    const categories: Record<string, string> = {
      'B747': 'HEAVY', 'B777': 'HEAVY', 'A330': 'HEAVY',
      'B737': 'MEDIUM', 'A320': 'MEDIUM',
      'AT72': 'LIGHT', 'DH8D': 'LIGHT'
    };
    
    const landingCat = categories[landing.aircraftType || ''] || 'MEDIUM';
    const takeoffCat = categories[takeoff.aircraftType || ''] || 'MEDIUM';
    
    const separations: Record<string, number> = {
      'HEAVY-HEAVY': 120,
      'HEAVY-MEDIUM': 150,
      'HEAVY-LIGHT': 180,
      'MEDIUM-LIGHT': 90,
      'MEDIUM-MEDIUM': 90,
      'LIGHT-LIGHT': 60
    };
    
    return separations[`${landingCat}-${takeoffCat}`] || 90;
  }

  private analyzeTakeoffSequence(takeoffReady: TakeoffReadyAnalysis[]): any {
    // 연속 이륙 간격 분석
    const needsDelay = takeoffReady.length > 1 && 
                      takeoffReady.some(a => a.readinessLevel === 'takeoff_ready');
    
    return {
      needsDelay,
      aircraftSequence: takeoffReady.map(a => a.aircraft.id.toString())
    };
  }

  private needsIntersectionControl(
    runway: string,
    approaches: AircraftApproachData[],
    takeoffReady: TakeoffReadyAnalysis[]
  ): boolean {
    // 교차점 제어 필요 여부
    return (runway === '14L' || runway === '14R') && 
           (approaches.length > 0 || takeoffReady.length > 0);
  }

  private getTHLsForRunway(runway: string): string[] {
    const thlIds: string[] = [];
    
    this.thlLights.forEach((thl, id) => {
      if (thl.runway === runway) {
        thlIds.push(id);
      }
    });
    
    return thlIds;
  }

  private getSelectiveTHLs(runway: string, sequenceAnalysis: any): string[] {
    // 선택적 THL 활성화
    return this.getTHLsForRunway(runway).filter(id => id.includes('HOLD'));
  }

  private getIntersectionTHLs(runway: string): string[] {
    return this.getTHLsForRunway(runway).filter(id => id.includes('INTERSECT'));
  }

  private generateSequenceCommands(runway: string, sequenceAnalysis: any): THLCommand[] {
    const commands: THLCommand[] = [];
    const thlIds = this.getSelectiveTHLs(runway, sequenceAnalysis);
    
    thlIds.forEach((thlId, index) => {
      commands.push({
        thlId,
        command: index === 0 ? 'AMBER_FLASH' : 'RED_ON',
        intensity: 0.8,
        flashPattern: 'slow_flash',
        activationDelay: index * 1000,
        duration: 30000,
        priority: 'MEDIUM'
      });
    });
    
    return commands;
  }

  private getSeverityLevel(severity: string): number {
    const levels: Record<string, number> = {
      'CRITICAL': 4,
      'HIGH': 3,
      'MEDIUM': 2,
      'LOW': 1
    };
    return levels[severity] || 0;
  }

  private calculateConflictPriority(analysis: ConflictAnalysis): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      'CRITICAL': 'CRITICAL',
      'HIGH': 'HIGH',
      'MEDIUM': 'MEDIUM',
      'LOW': 'LOW'
    };
    return severityMap[analysis.severity] || 'LOW';
  }

  private getRecommendedAction(severity: string, details: ConflictDetail[]): string {
    if (severity === 'CRITICAL') {
      return 'HOLD POSITION - Immediate stop all takeoff operations';
    } else if (severity === 'HIGH') {
      return 'DELAY TAKEOFF - Wait for landing aircraft to clear';
    } else if (severity === 'MEDIUM') {
      return 'MONITOR CLOSELY - Be prepared to hold';
    }
    return 'CONTINUE MONITORING - Normal operations';
  }

  private calculateUrgency(severity: string): number {
    const urgencyMap: Record<string, number> = {
      'CRITICAL': 1.0,
      'HIGH': 0.8,
      'MEDIUM': 0.5,
      'LOW': 0.2
    };
    return urgencyMap[severity] || 0.2;
  }

  private calculateIntensity(urgency: number): number {
    return Math.max(0.5, Math.min(1.0, 0.5 + urgency * 0.5));
  }

  private getFlashPattern(urgency: number): string {
    if (urgency > 0.8) return 'fast_flash';
    if (urgency > 0.6) return 'medium_flash';
    if (urgency > 0.3) return 'slow_flash';
    return 'steady';
  }

  private calculateActivationDelay(analysis: ConflictAnalysis): number {
    const severityDelays: Record<string, number> = {
      'CRITICAL': 0,
      'HIGH': 500,
      'MEDIUM': 1000,
      'LOW': 2000
    };
    return severityDelays[analysis.severity] || 1000;
  }

  private calculateActivationDuration(analysis: ConflictAnalysis): number {
    // 충돌 지속 시간 + 여유 시간
    const baseDuration = 60000; // 1분 기본
    const severityMultiplier: Record<string, number> = {
      'CRITICAL': 2,
      'HIGH': 1.5,
      'MEDIUM': 1.2,
      'LOW': 1
    };
    return baseDuration * (severityMultiplier[analysis.severity] || 1);
  }

  private isInZone(pos: PlaneCoordinate, zone: any): boolean {
    return pos.x >= zone.xMin &&
           pos.x <= zone.xMax &&
           pos.y >= zone.yMin &&
           pos.y <= zone.yMax;
  }

  private calculateDistance(p1: PlaneCoordinate, p2: PlaneCoordinate): number {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow((p1.z || 0) - (p2.z || 0), 2)
    );
  }

  private calculateDistanceToThreshold(pos: PlaneCoordinate, runway: string): number {
    const thresholdPositions: Record<string, PlaneCoordinate> = {
      '14L': { x: -1600, y: 55, z: 0 },
      '32R': { x: 1600, y: 55, z: 0 },
      '14R': { x: -1600, y: -55, z: 0 },
      '32L': { x: 1600, y: -55, z: 0 }
    };
    
    const threshold = thresholdPositions[runway];
    return threshold ? this.calculateDistance(pos, threshold) : Infinity;
  }
}