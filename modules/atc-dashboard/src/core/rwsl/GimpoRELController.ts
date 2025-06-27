/**
 * 김포공항 REL(Runway Entrance Lights) 제어 시스템
 * 설계 문서 기반 구현
 */

import {
  RELConfiguration,
  RELControlDecision,
  RELCommand,
  RunwayOccupancy,
  AircraftApproachData,
  ConflictSeverity
} from '../../types/rwsl';
import { TrackedAircraft } from '../../types';
import { CoordinateSystem } from '../coordinates';
import { PlaneCoordinate } from '../../types/coordinates';
import { gimpoRELConfigurations } from './gimpoRELConfig';

interface RunwayApproachAnalysis {
  isApproaching: boolean;
  targetRunway: string;
  entryPoint: string;
  distanceToEntry: number;
  estimatedTimeToEntry: number;
  approachSpeed: number;
  approachAngle: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class GimpoRELController {
  private coordinateSystem: CoordinateSystem;
  private relLights: Map<string, RELConfiguration>;
  private runwayOccupancy: Map<string, RunwayOccupancy>;
  private approachDetectionDistance: number = 500; // meters
  private criticalDistance: number = 100; // meters

  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
    this.relLights = new Map();
    this.runwayOccupancy = new Map();
    
    // 김포공항 REL 구성 초기화
    this.initializeRELConfiguration();
  }

  private initializeRELConfiguration(): void {
    gimpoRELConfigurations.forEach(config => {
      this.relLights.set(config.id, config);
    });
  }

  /**
   * REL 제어 결정 처리
   */
  public processRunwayOccupancy(
    aircraftData: TrackedAircraft[],
    runwayOccupancy: Map<string, RunwayOccupancy>
  ): RELControlDecision[] {
    this.runwayOccupancy = runwayOccupancy;
    
    // 1. 접근 항공기 분석
    const approachingAnalysis = this.analyzeApproachingAircraft(aircraftData);
    
    // 2. REL 제어 결정
    const relDecisions = this.makeRELControlDecisions(approachingAnalysis);
    
    return relDecisions;
  }

  /**
   * 접근 항공기 분석
   */
  private analyzeApproachingAircraft(aircraftData: TrackedAircraft[]): Map<string, AircraftApproachData[]> {
    const approachMap = new Map<string, AircraftApproachData[]>();
    
    // 각 활주로별 초기화
    ['14L', '32R', '14R', '32L'].forEach(runway => {
      approachMap.set(runway, []);
    });
    
    aircraftData.forEach(aircraft => {
      const approachStatus = this.analyzeRunwayApproach(aircraft);
      
      if (approachStatus.isApproaching) {
        const approachData: AircraftApproachData = {
          aircraft,
          targetRunway: approachStatus.targetRunway,
          distanceToThreshold: approachStatus.distanceToEntry,
          estimatedLandingTime: Date.now() + approachStatus.estimatedTimeToEntry * 1000,
          approachSpeed: approachStatus.approachSpeed,
          approachPhase: this.determineApproachPhase(approachStatus.distanceToEntry),
          conflictPotential: this.calculateConflictPotential(approachStatus)
        };
        
        const runwayApproaches = approachMap.get(approachStatus.targetRunway) || [];
        runwayApproaches.push(approachData);
        approachMap.set(approachStatus.targetRunway, runwayApproaches);
      }
    });
    
    return approachMap;
  }

  /**
   * 활주로 접근 분석
   */
  private analyzeRunwayApproach(aircraft: TrackedAircraft): RunwayApproachAnalysis {
    const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    
    // 가장 가까운 REL 진입점 찾기
    let closestREL: RELConfiguration | null = null;
    let minDistance = Infinity;
    
    this.relLights.forEach(rel => {
      const distance = this.calculateDistance(localPos, rel.position.localCoords);
      if (distance < minDistance && distance <= this.approachDetectionDistance) {
        minDistance = distance;
        closestREL = rel;
      }
    });
    
    if (!closestREL) {
      return { isApproaching: false } as RunwayApproachAnalysis;
    }
    
    if (!this.isHeadingTowardsEntry(aircraft, closestREL)) {
      return { isApproaching: false } as RunwayApproachAnalysis;
    }
    
    const timeToEntry = minDistance / (aircraft.speed * 0.514444); // seconds
    const rel = closestREL as RELConfiguration; // Type assertion
    
    return {
      isApproaching: true,
      targetRunway: String(rel.runway),
      entryPoint: rel.id,
      distanceToEntry: minDistance,
      estimatedTimeToEntry: timeToEntry,
      approachSpeed: aircraft.speed,
      approachAngle: this.calculateApproachAngle(aircraft, rel),
      riskLevel: this.assessApproachRisk(minDistance, timeToEntry)
    };
  }

  /**
   * REL 제어 결정
   */
  private makeRELControlDecisions(
    approachingAircraft: Map<string, AircraftApproachData[]>
  ): RELControlDecision[] {
    const decisions: RELControlDecision[] = [];
    
    // 각 활주로별 제어 결정
    ['14L_32R', '14R_32L'].forEach(runway => {
      const runwayOccupancy = this.runwayOccupancy.get(runway);
      const approaches14L = approachingAircraft.get('14L') || [];
      const approaches32R = approachingAircraft.get('32R') || [];
      const approaches14R = approachingAircraft.get('14R') || [];
      const approaches32L = approachingAircraft.get('32L') || [];
      
      let approaches: AircraftApproachData[] = [];
      if (runway === '14L_32R') {
        approaches = [...approaches14L, ...approaches32R];
      } else {
        approaches = [...approaches14R, ...approaches32L];
      }
      
      const decision = this.makeRunwayRELDecision(runway, runwayOccupancy, approaches);
      if (decision.controlAction !== 'NO_ACTION') {
        decisions.push(decision);
      }
    });
    
    return decisions;
  }

  /**
   * 활주로별 REL 제어 결정
   */
  private makeRunwayRELDecision(
    runway: string,
    occupancy: RunwayOccupancy | undefined,
    approaches: AircraftApproachData[]
  ): RELControlDecision {
    const decision: RELControlDecision = {
      runway,
      controlAction: 'NO_ACTION',
      affectedRELLights: [],
      reasoning: '',
      priority: 'LOW'
    };
    
    // 시나리오 1: 활주로 점유 중 + 접근 항공기 있음
    if (occupancy?.occupied && approaches.length > 0) {
      decision.controlAction = 'ACTIVATE_RED';
      decision.affectedRELLights = this.getAffectedRELs(runway, approaches);
      decision.reasoning = `활주로 점유 중 (${occupancy.aircraft.length}대), 접근 항공기 ${approaches.length}대 감지`;
      decision.priority = this.calculatePriority(occupancy, approaches);
      decision.detailedCommands = this.generateDetailedRELCommands(runway, occupancy, approaches);
    }
    // 시나리오 2: 활주로 미점유 + 접근 항공기 없음
    else if (!occupancy?.occupied && approaches.length === 0) {
      decision.controlAction = 'DEACTIVATE_ALL';
      decision.affectedRELLights = this.getAllRELsForRunway(runway);
      decision.reasoning = '활주로 비점유, 접근 항공기 없음';
      decision.priority = 'LOW';
    }
    // 시나리오 3: 복합 상황
    else if (this.isComplexScenario(occupancy, approaches)) {
      decision.controlAction = 'SELECTIVE_ACTIVATION';
      decision.affectedRELLights = this.getSelectiveRELs(runway, occupancy, approaches);
      decision.reasoning = '복합 상황 - 선택적 REL 활성화';
      decision.priority = 'MEDIUM';
    }
    
    return decision;
  }

  /**
   * 상세 REL 명령 생성
   */
  private generateDetailedRELCommands(
    runway: string,
    occupancy: RunwayOccupancy,
    approaches: AircraftApproachData[]
  ): RELCommand[] {
    const commands: RELCommand[] = [];
    
    approaches.forEach(approach => {
      // 접근 방향과 거리에 따른 REL 제어
      const urgency = this.calculateUrgency(approach);
      
      // 해당 진입점의 REL 활성화
      const relIds = this.getRELsForApproach(approach);
      relIds.forEach(relId => {
        commands.push({
          relId,
          command: 'RED_ON',
          intensity: this.calculateIntensity(urgency),
          flashPattern: this.getFlashPattern(urgency),
          activationDelay: this.calculateActivationDelay(approach),
          duration: this.calculateActivationDuration(approach)
        });
      });
      
      // 인근 REL들도 예방적 활성화
      const adjacentRELs = this.getAdjacentRELs(relIds[0]);
      adjacentRELs.forEach(adjREL => {
        commands.push({
          relId: adjREL,
          command: 'RED_ON',
          intensity: Math.max(0.7, this.calculateIntensity(urgency) - 0.2),
          flashPattern: 'steady',
          activationDelay: 1000,
          duration: this.calculateActivationDuration(approach) - 5000
        });
      });
    });
    
    return commands;
  }

  /**
   * 우선순위 계산
   */
  private calculatePriority(
    occupancy: RunwayOccupancy,
    approaches: AircraftApproachData[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let priorityScore = 0;
    
    // 점유 항공기 수
    priorityScore += occupancy.aircraft.length * 20;
    
    // 접근 항공기 위험도
    approaches.forEach(approach => {
      if (approach.distanceToThreshold < 100) priorityScore += 50;
      else if (approach.distanceToThreshold < 200) priorityScore += 30;
      else if (approach.distanceToThreshold < 300) priorityScore += 15;
      
      if (approach.estimatedLandingTime - Date.now() < 30000) priorityScore += 40;
      else if (approach.estimatedLandingTime - Date.now() < 60000) priorityScore += 25;
    });
    
    // 점유 항공기 상태
    occupancy.aircraft.forEach(aircraft => {
      if (aircraft.speed >= 50) priorityScore += 35;
      else if (aircraft.speed >= 30) priorityScore += 20;
      else priorityScore += 10;
    });
    
    if (priorityScore >= 100) return 'CRITICAL';
    if (priorityScore >= 70) return 'HIGH';
    if (priorityScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 보조 함수들
   */
  private isHeadingTowardsEntry(aircraft: TrackedAircraft, rel: RELConfiguration): boolean {
    const aircraftPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const relPos = rel.position.localCoords;
    
    // 항공기에서 REL로의 방향 벡터
    const dx = relPos.x - aircraftPos.x;
    const dy = relPos.y - aircraftPos.y;
    const angleToREL = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // 항공기 진행 방향과의 각도 차이
    const angleDiff = Math.abs(angleToREL - aircraft.heading);
    
    // 30도 이내면 접근 중으로 판단
    return angleDiff < 30 || angleDiff > 330;
  }

  private calculateApproachAngle(aircraft: TrackedAircraft, rel: RELConfiguration): number {
    const aircraftPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const relPos = rel.position.localCoords;
    
    const dx = relPos.x - aircraftPos.x;
    const dy = relPos.y - aircraftPos.y;
    
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  private assessApproachRisk(distance: number, timeToEntry: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (distance < 100 && timeToEntry < 30) return 'CRITICAL';
    if (distance < 200 && timeToEntry < 60) return 'HIGH';
    if (distance < 300 && timeToEntry < 90) return 'MEDIUM';
    return 'LOW';
  }

  private determineApproachPhase(distance: number): 'INITIAL' | 'INTERMEDIATE' | 'FINAL' | 'SHORT_FINAL' {
    if (distance < 100) return 'SHORT_FINAL';
    if (distance < 200) return 'FINAL';
    if (distance < 350) return 'INTERMEDIATE';
    return 'INITIAL';
  }

  private calculateConflictPotential(approach: RunwayApproachAnalysis): number {
    const riskScores = { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1.0 };
    return riskScores[approach.riskLevel];
  }

  private getAffectedRELs(runway: string, approaches: AircraftApproachData[]): string[] {
    const affectedRELs = new Set<string>();
    
    approaches.forEach(approach => {
      const relIds = this.getRELsForApproach(approach);
      relIds.forEach(id => affectedRELs.add(id));
    });
    
    return Array.from(affectedRELs);
  }

  private getAllRELsForRunway(runway: string): string[] {
    const relIds: string[] = [];
    
    this.relLights.forEach((rel, id) => {
      if (runway.includes(rel.runway)) {
        relIds.push(id);
      }
    });
    
    return relIds;
  }

  private getRELsForApproach(approach: AircraftApproachData): string[] {
    const relIds: string[] = [];
    
    this.relLights.forEach((rel, id) => {
      if (rel.runway === approach.targetRunway) {
        const distance = this.calculateDistanceFromAircraft(approach.aircraft, rel);
        if (distance < 300) {
          relIds.push(id);
        }
      }
    });
    
    return relIds;
  }

  private getAdjacentRELs(relId: string): string[] {
    const adjacentIds: string[] = [];
    const currentREL = this.relLights.get(relId);
    
    if (!currentREL) return adjacentIds;
    
    this.relLights.forEach((rel, id) => {
      if (id !== relId && rel.runway === currentREL.runway) {
        const distance = this.calculateDistance(
          currentREL.position.localCoords,
          rel.position.localCoords
        );
        if (distance < 400) {
          adjacentIds.push(id);
        }
      }
    });
    
    return adjacentIds;
  }

  private getSelectiveRELs(
    runway: string,
    occupancy: RunwayOccupancy | undefined,
    approaches: AircraftApproachData[]
  ): string[] {
    // 선택적 활성화 로직
    const selectiveRELs: string[] = [];
    
    if (approaches.length > 0) {
      approaches.forEach(approach => {
        if (approach.conflictPotential > 0.5) {
          const relIds = this.getRELsForApproach(approach);
          selectiveRELs.push(...relIds);
        }
      });
    }
    
    return selectiveRELs;
  }

  private isComplexScenario(
    occupancy: RunwayOccupancy | undefined,
    approaches: AircraftApproachData[]
  ): boolean {
    // 복합 시나리오 판단
    return (occupancy?.occupied && approaches.length === 0) ||
           (!occupancy?.occupied && approaches.length > 0) ||
           (approaches.length > 2);
  }

  private calculateUrgency(approach: AircraftApproachData): number {
    const timeUrgency = Math.max(0, 1 - (approach.estimatedLandingTime - Date.now()) / 120000);
    const distanceUrgency = Math.max(0, 1 - approach.distanceToThreshold / 500);
    return (timeUrgency + distanceUrgency) / 2;
  }

  private calculateIntensity(urgency: number): number {
    return Math.max(0.5, Math.min(1.0, 0.5 + urgency * 0.5));
  }

  private getFlashPattern(urgency: number): 'steady' | 'slow_flash' | 'medium_flash' | 'fast_flash' {
    if (urgency > 0.8) return 'fast_flash';
    if (urgency > 0.6) return 'medium_flash';
    if (urgency > 0.3) return 'slow_flash';
    return 'steady';
  }

  private calculateActivationDelay(approach: AircraftApproachData): number {
    if (approach.distanceToThreshold < 100) return 0;
    if (approach.distanceToThreshold < 200) return 500;
    if (approach.distanceToThreshold < 300) return 1000;
    return 2000;
  }

  private calculateActivationDuration(approach: AircraftApproachData): number {
    // 예상 통과 시간 + 여유 시간
    const passTime = approach.distanceToThreshold / (approach.approachSpeed * 0.514444);
    return (passTime + 30) * 1000; // 30초 여유
  }

  private calculateDistance(p1: PlaneCoordinate, p2: PlaneCoordinate): number {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow((p1.z || 0) - (p2.z || 0), 2)
    );
  }

  private calculateDistanceFromAircraft(aircraft: TrackedAircraft, rel: RELConfiguration): number {
    const aircraftPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    return this.calculateDistance(aircraftPos, rel.position.localCoords);
  }
}