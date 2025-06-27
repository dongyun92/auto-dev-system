/**
 * 김포공항 RWSL 통합 시스템
 * 모든 구성 요소를 통합하여 실시간 RWSL 제어
 */

import {
  RWSLSystemStatus,
  ConflictEvent,
  RunwayOccupancy,
  RELControlDecision,
  THLControlDecision,
  RWSLState,
  LightStateInfo,
  RWSLConflict,
  PerformanceMetrics
} from '../../types/rwsl';
import { TrackedAircraft } from '../../types';
import { CoordinateSystem } from '../coordinates';
import { PlaneCoordinate } from '../../types/coordinates';
import { GimpoCollisionDetector } from './GimpoCollisionDetector';
import { GimpoRELController } from './GimpoRELController';
import { GimpoTHLController } from './GimpoTHLController';
import { SpatialIndex } from './SpatialIndex';

interface ProcessingResult {
  conflicts: ConflictEvent[];
  relDecisions: RELControlDecision[];
  thlDecisions: THLControlDecision[];
  processingTime: number;
}

export class GimpoRWSLSystem {
  private coordinateSystem: CoordinateSystem;
  private collisionDetector: GimpoCollisionDetector;
  private relController: GimpoRELController;
  private thlController: GimpoTHLController;
  private spatialIndex: SpatialIndex;
  
  // 시스템 상태
  private currentState: RWSLState;
  private systemStatus: RWSLSystemStatus;
  private performanceMetrics: PerformanceMetrics;
  
  // 설정
  private processingInterval: number = 1000; // 1초
  private maxProcessingTime: number = 900; // 900ms (1초 이내 처리 목표)
  private lightActivationThreshold: number = 0.7; // 70% 신뢰도 이상일 때 활성화
  
  constructor(coordinateSystem: CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
    
    // 하위 시스템 초기화
    this.collisionDetector = new GimpoCollisionDetector(coordinateSystem);
    this.relController = new GimpoRELController(coordinateSystem);
    this.thlController = new GimpoTHLController(coordinateSystem);
    this.spatialIndex = new SpatialIndex();
    
    // 상태 초기화
    this.currentState = {
      rel: new Map(),
      thl: new Map(),
      conflicts: [],
      lastUpdate: Date.now(),
      systemStatus: 'ONLINE'
    };
    
    this.systemStatus = this.initializeSystemStatus();
    this.performanceMetrics = this.initializePerformanceMetrics();
  }
  
  private initializeSystemStatus(): RWSLSystemStatus {
    return {
      collisionDetection: {
        activeConflicts: [],
        processingTime: 0,
        lastUpdate: new Date()
      },
      relStatus: {
        activeLights: 0,
        totalLights: 24,
        decisions: []
      },
      thlStatus: {
        activeLights: 0,
        totalLights: 8,
        decisions: []
      },
      systemHealth: {
        status: 'ONLINE',
        uptime: 0,
        errorCount: 0,
        performanceScore: 100
      },
      timestamp: new Date()
    };
  }
  
  private initializePerformanceMetrics(): PerformanceMetrics {
    return {
      avgProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: Infinity,
      avgConflictsPerCycle: 0,
      avgAccuracy: 0.95, // 목표 95%
      totalDetections: 0,
      detectionRate: 0,
      falsePositiveRate: 0,
      falseNegativeRate: 0
    };
  }
  
  /**
   * 메인 처리 함수 - 매 사이클마다 호출
   */
  public processRWSL(aircraftData: TrackedAircraft[]): RWSLState {
    const startTime = performance.now();
    
    try {
      // 1. 공간 인덱스 업데이트
      this.updateSpatialIndex(aircraftData);
      
      // 2. 충돌 감지
      const conflicts = this.collisionDetector.detectConflicts(aircraftData);
      
      // 3. 활주로 점유 상태 계산
      const runwayOccupancy = this.calculateRunwayOccupancy(aircraftData);
      
      // 4. REL 제어 결정
      const relDecisions = this.relController.processRunwayOccupancy(
        aircraftData,
        runwayOccupancy
      );
      
      // 5. THL 제어 결정
      const thlDecisions = this.thlController.processTakeoffHoldScenarios(aircraftData);
      
      // 6. 등화 상태 업데이트
      this.updateLightStates(relDecisions, thlDecisions);
      
      // 7. 충돌 상태 업데이트
      this.updateConflictStates(conflicts);
      
      // 8. 시스템 상태 업데이트
      const processingTime = performance.now() - startTime;
      this.updateSystemStatus({
        conflicts,
        relDecisions,
        thlDecisions,
        processingTime
      });
      
      // 9. 성능 메트릭 업데이트
      this.updatePerformanceMetrics(processingTime, conflicts.length);
      
      // 10. 최종 상태 반환
      this.currentState.lastUpdate = Date.now();
      this.currentState.systemStatus = this.determineSystemHealth();
      
      return this.currentState;
      
    } catch (error) {
      console.error('RWSL 처리 중 오류:', error);
      this.handleProcessingError(error);
      return this.currentState;
    }
  }
  
  /**
   * 공간 인덱스 업데이트
   */
  private updateSpatialIndex(aircraftData: TrackedAircraft[]): void {
    const aircraftPositions = new Map<string, PlaneCoordinate>();
    
    aircraftData.forEach(aircraft => {
      if (aircraft.isActive) {
        const planeCoords = this.coordinateSystem.toPlane(
          aircraft.latitude,
          aircraft.longitude
        );
        aircraftPositions.set(aircraft.id.toString(), planeCoords);
      }
    });
    
    this.spatialIndex.updateAllAircraft(aircraftPositions);
  }
  
  /**
   * 활주로 점유 상태 계산
   */
  private calculateRunwayOccupancy(aircraftData: TrackedAircraft[]): Map<string, RunwayOccupancy> {
    const occupancyMap = new Map<string, RunwayOccupancy>();
    
    // 각 활주로별 점유 확인
    ['14L_32R', '14R_32L'].forEach(runway => {
      const occupancy: RunwayOccupancy = {
        runway: runway as any,
        occupied: false,
        aircraft: [],
        occupancyType: null
      };
      
      aircraftData.forEach(aircraft => {
        if (this.isOnRunway(aircraft, runway)) {
          occupancy.occupied = true;
          occupancy.aircraft.push(aircraft);
          
          // 점유 타입 결정
          if (!occupancy.occupancyType) {
            occupancy.occupancyType = this.determineOccupancyType(aircraft);
          }
          
          // 점유 상세 정보
          if (!occupancy.occupancyDetails) {
            const localPos = this.coordinateSystem.toPlane(
              aircraft.latitude,
              aircraft.longitude
            );
            
            occupancy.occupancyDetails = {
              entryTime: Date.now() - 10000, // 추정값
              estimatedExitTime: Date.now() + this.estimateRunwayExitTime(aircraft),
              operationType: occupancy.occupancyType,
              positionOnRunway: localPos.x
            };
          }
        }
      });
      
      occupancyMap.set(runway, occupancy);
    });
    
    return occupancyMap;
  }
  
  /**
   * 등화 상태 업데이트
   */
  private updateLightStates(
    relDecisions: RELControlDecision[],
    thlDecisions: THLControlDecision[]
  ): void {
    // REL 업데이트
    relDecisions.forEach(decision => {
      if (decision.controlAction === 'ACTIVATE_RED') {
        decision.affectedRELLights.forEach(lightId => {
          const lightInfo: LightStateInfo = {
            id: lightId,
            type: 'REL',
            active: true,
            reason: decision.reasoning,
            activatedAt: Date.now(),
            position: this.getLightPosition(lightId, 'REL'),
            runwayDirection: decision.runway
          };
          this.currentState.rel.set(lightId, lightInfo);
        });
      } else if (decision.controlAction === 'DEACTIVATE_ALL') {
        decision.affectedRELLights.forEach(lightId => {
          const existing = this.currentState.rel.get(lightId);
          if (existing) {
            existing.active = false;
            existing.deactivatedAt = Date.now();
          }
        });
      }
    });
    
    // THL 업데이트
    thlDecisions.forEach(decision => {
      if (decision.controlAction === 'ACTIVATE_RED' || 
          decision.controlAction === 'SELECTIVE_ACTIVATION') {
        decision.affectedTHLLights.forEach(lightId => {
          const lightInfo: LightStateInfo = {
            id: lightId,
            type: 'THL',
            active: true,
            reason: decision.reasoning,
            activatedAt: Date.now(),
            position: this.getLightPosition(lightId, 'THL'),
            runwayDirection: decision.runway
          };
          this.currentState.thl.set(lightId, lightInfo);
        });
      }
    });
    
    // 타임아웃된 등화 비활성화
    this.deactivateTimedOutLights();
  }
  
  /**
   * 충돌 상태 업데이트
   */
  private updateConflictStates(conflicts: ConflictEvent[]): void {
    const rwslConflicts: RWSLConflict[] = conflicts.map(conflict => ({
      id: conflict.id,
      type: this.mapConflictType(conflict.type),
      severity: conflict.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      involvedAircraft: conflict.aircraftInvolved,
      runway: conflict.runwayInvolved[0] || '',
      position: this.getConflictPosition(conflict),
      timestamp: conflict.predictedTime.getTime()
    }));
    
    this.currentState.conflicts = rwslConflicts;
  }
  
  /**
   * 시스템 상태 업데이트
   */
  private updateSystemStatus(result: ProcessingResult): void {
    this.systemStatus = {
      collisionDetection: {
        activeConflicts: result.conflicts,
        processingTime: result.processingTime,
        lastUpdate: new Date()
      },
      relStatus: {
        activeLights: Array.from(this.currentState.rel.values())
          .filter(light => light.active).length,
        totalLights: 24,
        decisions: result.relDecisions
      },
      thlStatus: {
        activeLights: Array.from(this.currentState.thl.values())
          .filter(light => light.active).length,
        totalLights: 8,
        decisions: result.thlDecisions
      },
      systemHealth: {
        status: result.processingTime < this.maxProcessingTime ? 'ONLINE' : 'DEGRADED',
        uptime: Date.now() - this.performanceMetrics.totalDetections * 1000,
        errorCount: this.systemStatus.systemHealth.errorCount,
        performanceScore: this.calculatePerformanceScore(result.processingTime)
      },
      timestamp: new Date()
    };
  }
  
  /**
   * 성능 메트릭 업데이트
   */
  private updatePerformanceMetrics(processingTime: number, conflictCount: number): void {
    const metrics = this.performanceMetrics;
    
    // 처리 시간 통계
    metrics.totalDetections++;
    metrics.avgProcessingTime = 
      (metrics.avgProcessingTime * (metrics.totalDetections - 1) + processingTime) / 
      metrics.totalDetections;
    metrics.maxProcessingTime = Math.max(metrics.maxProcessingTime, processingTime);
    metrics.minProcessingTime = Math.min(metrics.minProcessingTime, processingTime);
    
    // 충돌 통계
    metrics.avgConflictsPerCycle = 
      (metrics.avgConflictsPerCycle * (metrics.totalDetections - 1) + conflictCount) / 
      metrics.totalDetections;
    
    // 감지율 (실제 시스템에서는 실제 데이터와 비교 필요)
    metrics.detectionRate = 0.95; // 목표치
  }
  
  /**
   * 보조 함수들
   */
  private isOnRunway(aircraft: TrackedAircraft, runway: string): boolean {
    const localPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    
    const runwayBounds: Record<string, any> = {
      '14L_32R': { xMin: -1600, xMax: 1600, yMin: 25, yMax: 85 },
      '14R_32L': { xMin: -1600, xMax: 1600, yMin: -85, yMax: -25 }
    };
    
    const bounds = runwayBounds[runway];
    if (!bounds) return false;
    
    return localPos.x >= bounds.xMin && 
           localPos.x <= bounds.xMax &&
           localPos.y >= bounds.yMin && 
           localPos.y <= bounds.yMax;
  }
  
  private determineOccupancyType(aircraft: TrackedAircraft): 'TAKEOFF' | 'LANDING' | 'TAXI' | 'LINEUP' {
    if (aircraft.speed >= 50) {
      return (aircraft.verticalSpeed || 0) > 0 ? 'TAKEOFF' : 'LANDING';
    } else if (aircraft.speed >= 5) {
      return 'TAXI';
    } else {
      return 'LINEUP';
    }
  }
  
  private estimateRunwayExitTime(aircraft: TrackedAircraft): number {
    // 활주로 길이와 속도를 기반으로 추정
    const runwayLength = 3200; // meters
    const currentSpeed = aircraft.speed * 0.514444; // knots to m/s
    
    if (currentSpeed > 0) {
      return (runwayLength / currentSpeed) * 1000; // milliseconds
    }
    
    return 120000; // 기본값 2분
  }
  
  private getLightPosition(lightId: string, type: 'REL' | 'THL'): PlaneCoordinate {
    // 실제 구현에서는 설정 파일에서 가져와야 함
    // 여기서는 임시 위치 반환
    return { x: 0, y: 0, z: 0 };
  }
  
  private deactivateTimedOutLights(): void {
    const now = Date.now();
    const timeout = 30000; // 30초
    
    // REL 타임아웃 확인
    this.currentState.rel.forEach((light, id) => {
      if (light.active && light.activatedAt && (now - light.activatedAt) > timeout) {
        light.active = false;
        light.deactivatedAt = now;
      }
    });
    
    // THL 타임아웃 확인
    this.currentState.thl.forEach((light, id) => {
      if (light.active && light.activatedAt && (now - light.activatedAt) > timeout) {
        light.active = false;
        light.deactivatedAt = now;
      }
    });
  }
  
  private mapConflictType(type: string): 'RUNWAY_INCURSION' | 'TAKEOFF_HOLD' | 'INTERSECTION_CONFLICT' {
    const mapping: Record<string, any> = {
      'runway_intrusion': 'RUNWAY_INCURSION',
      'crossing_traffic': 'INTERSECTION_CONFLICT',
      'wake_turbulence': 'TAKEOFF_HOLD',
      'simultaneous_takeoff': 'TAKEOFF_HOLD',
      'head_on': 'RUNWAY_INCURSION'
    };
    
    return mapping[type] || 'RUNWAY_INCURSION';
  }
  
  private getConflictPosition(conflict: ConflictEvent): PlaneCoordinate {
    // 충돌 위치 계산 (중간점)
    // 실제 구현에서는 항공기 위치 기반 계산
    return { x: 0, y: 0, z: 0 };
  }
  
  private calculatePerformanceScore(processingTime: number): number {
    // 처리 시간 기반 점수 (0-100)
    const timeScore = Math.max(0, 100 - (processingTime / this.maxProcessingTime) * 50);
    
    // 정확도 기반 점수
    const accuracyScore = this.performanceMetrics.avgAccuracy * 50;
    
    return Math.round(timeScore + accuracyScore);
  }
  
  private determineSystemHealth(): string {
    const score = this.systemStatus.systemHealth.performanceScore;
    
    if (score >= 90) return 'ONLINE';
    if (score >= 70) return 'DEGRADED';
    if (score >= 50) return 'WARNING';
    return 'CRITICAL';
  }
  
  private handleProcessingError(error: any): void {
    console.error('RWSL 처리 오류:', error);
    
    this.systemStatus.systemHealth.errorCount++;
    this.systemStatus.systemHealth.status = 'DEGRADED';
    
    // 안전 모드: 모든 등화 활성화
    this.activateSafetyMode();
  }
  
  private activateSafetyMode(): void {
    // 안전을 위해 모든 REL과 THL 활성화
    console.warn('RWSL 안전 모드 활성화');
    
    // 실제 구현에서는 모든 등화 ID를 가져와서 활성화
    this.currentState.systemStatus = 'SAFETY_MODE';
  }
  
  /**
   * 외부 인터페이스
   */
  public getSystemStatus(): RWSLSystemStatus {
    return this.systemStatus;
  }
  
  public getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMetrics;
  }
  
  public getCurrentState(): RWSLState {
    return this.currentState;
  }
  
  public getNearbyAircraft(position: PlaneCoordinate, radius: number): string[] {
    return this.spatialIndex.getNearbyAircraft(position, radius);
  }
}