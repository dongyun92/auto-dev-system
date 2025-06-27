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
  private lastAircraftData: TrackedAircraft[] = [];
  private lastConflictEvents: ConflictEvent[] = [];
  
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
    
    // 항공기 데이터 저장
    this.lastAircraftData = aircraftData;
    
    try {
      // 1. 공간 인덱스 업데이트
      this.updateSpatialIndex(aircraftData);
      
      // 2. 충돌 감지
      const conflicts = this.collisionDetector.detectConflicts(aircraftData);
      this.lastConflictEvents = conflicts; // 충돌 이벤트 저장
      
      // 3. 도착 항공기 접근 감지 (부채꼴 영역)
      const approachingAircraft = this.checkApproachingAircraft(aircraftData);
      
      // 4. 활주로 점유 상태 계산
      const runwayOccupancy = this.calculateRunwayOccupancy(aircraftData);
      
      // 5. REL 제어 결정 (접근 항공기 정보 포함)
      const relDecisions = this.relController.processRunwayOccupancy(
        aircraftData,
        runwayOccupancy
      );
      
      // 접근 항공기별 REL 활성화
      this.processApproachingAircraftREL(approachingAircraft);
      
      // Airborne 항공기 REL 소등 처리
      this.processAirborneAircraft(aircraftData);
      
      // 속도 기준 REL 소등 처리
      this.processSpeedBasedRELDeactivation(aircraftData);
      
      // 6. THL 제어 결정
      const thlDecisions = this.thlController.processTakeoffHoldScenarios(aircraftData);
      
      // 7. 등화 상태 업데이트
      this.updateLightStates(relDecisions, thlDecisions);
      
      // 8. 충돌 상태 업데이트
      this.updateConflictStates(conflicts);
      
      // 9. 시스템 상태 업데이트
      const processingTime = performance.now() - startTime;
      this.updateSystemStatus({
        conflicts,
        relDecisions,
        thlDecisions,
        processingTime
      });
      
      // 10. 성능 메트릭 업데이트
      this.updatePerformanceMetrics(processingTime, conflicts.length);
      
      // 11. 최종 상태 반환
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
      
      if (occupancy.occupied) {
        console.log(`[RWSL] ${runway} 점유 상태:`, {
          occupied: true,
          aircraftCount: occupancy.aircraft.length,
          type: occupancy.occupancyType
        });
      }
      
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
    
    // 실제 활주로 끝점 위치
    let start, end, width;
    
    if (runway === '14L_32R') {
      start = this.coordinateSystem.toPlane(37.5705, 126.7784); // 14L
      end = this.coordinateSystem.toPlane(37.5478, 126.8070);   // 32R
      width = 45; // 14L/32R 폭
    } else if (runway === '14R_32L') {
      start = this.coordinateSystem.toPlane(37.5683, 126.7755); // 14R
      end = this.coordinateSystem.toPlane(37.5481, 126.8009);   // 32L
      width = 60; // 14R/32L 폭
    } else {
      return false;
    }
    
    // 활주로 벡터
    const runwayVector = {
      x: end.x - start.x,
      y: end.y - start.y
    };
    const runwayLength = Math.sqrt(runwayVector.x * runwayVector.x + runwayVector.y * runwayVector.y);
    
    // 정규화된 활주로 방향 벡터
    const runwayDir = {
      x: runwayVector.x / runwayLength,
      y: runwayVector.y / runwayLength
    };
    
    // 항공기 위치 벡터 (활주로 시작점 기준)
    const aircraftVector = {
      x: localPos.x - start.x,
      y: localPos.y - start.y
    };
    
    // 활주로 방향으로의 투영 (활주로를 따른 거리)
    const projection = aircraftVector.x * runwayDir.x + aircraftVector.y * runwayDir.y;
    
    // 활주로 길이 내에 있는지 확인 (약간의 여유 추가)
    const lengthMargin = 50; // 50m 여유
    if (projection < -lengthMargin || projection > runwayLength + lengthMargin) {
      return false;
    }
    
    // 활주로에 수직인 거리 (Cross product의 크기)
    const perpDistance = Math.abs(aircraftVector.x * (-runwayDir.y) + aircraftVector.y * runwayDir.x);
    
    // 활주로 폭 내에 있는지 확인
    const halfWidth = width / 2 + 10; // 10m 여유
    const isInBounds = perpDistance <= halfWidth;
    
    if (isInBounds) {
      console.log(`[RWSL] 항공기 ${aircraft.callsign} 활주로 ${runway} 위에 있음:`, {
        x: localPos.x.toFixed(0),
        y: localPos.y.toFixed(0),
        altitude: aircraft.altitude,
        speed: aircraft.speed
      });
    }
    
    return isInBounds;
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
    // 김포공항 교차점별 REL 위치 (평면 좌표계)
    const relPositions: Record<string, PlaneCoordinate> = {
      // 유도로 A 교차점들
      'REL_A_14L': { x: -500, y: 800, z: 0 },   // A와 14L 교차점
      'REL_A_32R': { x: 500, y: -800, z: 0 },   // A와 32R 교차점  
      'REL_A_14R': { x: -400, y: 600, z: 0 },   // A와 14R 교차점
      'REL_A_32L': { x: 400, y: -600, z: 0 },   // A와 32L 교차점
      
      // 유도로 B 교차점들
      'REL_B_14L': { x: -200, y: 800, z: 0 },   // B와 14L 교차점
      'REL_B_32R': { x: 200, y: -800, z: 0 },   // B와 32R 교차점
      'REL_B_14R': { x: -100, y: 600, z: 0 },   // B와 14R 교차점
      'REL_B_32L': { x: 100, y: -600, z: 0 },   // B와 32L 교차점
      
      // 유도로 C 교차점들
      'REL_C_14L': { x: 100, y: 800, z: 0 },    // C와 14L 교차점
      'REL_C_32R': { x: -100, y: -800, z: 0 },  // C와 32R 교차점
      'REL_C_14R': { x: 200, y: 600, z: 0 },    // C와 14R 교차점
      'REL_C_32L': { x: -200, y: -600, z: 0 },  // C와 32L 교차점
      
      // 유도로 D 교차점들
      'REL_D_14L': { x: 400, y: 800, z: 0 },    // D와 14L 교차점
      'REL_D_32R': { x: -400, y: -800, z: 0 },  // D와 32R 교차점
      'REL_D_14R': { x: 500, y: 600, z: 0 },    // D와 14R 교차점
      'REL_D_32L': { x: -500, y: -600, z: 0 },  // D와 32L 교차점
      
      // 유도로 E 교차점들  
      'REL_E_14L': { x: 700, y: 800, z: 0 },    // E와 14L 교차점
      'REL_E_32R': { x: -700, y: -800, z: 0 },  // E와 32R 교차점
      'REL_E_14R': { x: 800, y: 600, z: 0 },    // E와 14R 교차점
      'REL_E_32L': { x: -800, y: -600, z: 0 },  // E와 32L 교차점
    };
    
    return relPositions[lightId] || { x: 0, y: 0, z: 0 };
  }

  /**
   * 새로운 REL ID를 기존 rwslLines ID로 매핑
   */
  private mapNewRELIdToExisting(newRelId: string): string[] {
    // 새로운 교차점 기반 REL ID → 기존 rwslLines REL ID 매핑
    // rwslLightPositions.json에 실제 존재하는 ID들만 매핑
    const mapping: Record<string, string[]> = {
      // A 유도로 (G 유도로 지역)
      'REL_A_14L': ['REL_G2_D', 'REL_G1_D'],        // 14L 방향 출발 REL
      'REL_A_32R': ['REL_G1_A'],                     // 32R 방향 도착 REL (G1_A만 존재)
      'REL_A_14R': ['REL_G2_D'],                     // 14R 방향 
      'REL_A_32L': ['REL_G1_A'],                     // 32L 방향
      
      // B 유도로 (F 유도로 지역)
      'REL_B_14L': ['REL_F2_D'],                     // 14L 방향 출발 REL
      'REL_B_32R': [],                               // F2_A는 존재하지 않음
      'REL_B_14R': ['REL_F2_D'],                     // 14R 방향
      'REL_B_32L': [],                               // F2_A는 존재하지 않음
      
      // C 유도로 (E 유도로 지역)
      'REL_C_14L': ['REL_E2_D', 'REL_E1_D'],        // 14L 방향 출발 REL
      'REL_C_32R': ['REL_E1_A'],                     // 32R 방향 도착 REL (E1_A만 존재)
      'REL_C_14R': ['REL_E2_D'],                     // 14R 방향
      'REL_C_32L': ['REL_E1_A'],                     // 32L 방향
      
      // D 유도로 (D 유도로 지역)
      'REL_D_14L': ['REL_D1_D', 'REL_D3_D', 'REL_D2_D'], // 14L 방향 출발 REL
      'REL_D_32R': ['REL_D1_A'],                     // 32R 방향 도착 REL (D1_A만 존재)
      'REL_D_14R': ['REL_D1_D'],                     // 14R 방향
      'REL_D_32L': ['REL_D1_A'],                     // 32L 방향
      
      // E 유도로 (C/W/B/A 유도로 지역)
      'REL_E_14L': ['REL_C1_D', 'REL_C3_D', 'REL_C2_D', 'REL_W1_D', 'REL_W2_D', 'REL_B1_D', 'REL_B2_D', 'REL_A_D'], // 14L 방향 출발 REL
      'REL_E_32R': ['REL_C1_A', 'REL_B1_A'],        // 32R 방향 도착 REL
      'REL_E_14R': ['REL_C1_D', 'REL_B1_D', 'REL_B2_D', 'REL_A_D'], // 14R 방향
      'REL_E_32L': ['REL_C1_A', 'REL_B1_A'],        // 32L 방향
    };
    
    return mapping[newRelId] || [];
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
    // 충돌 위치 계산 - 관련 항공기들의 중간점
    if (conflict.aircraftInvolved && conflict.aircraftInvolved.length >= 2) {
      const positions: PlaneCoordinate[] = [];
      
      // 관련 항공기들의 위치 수집
      conflict.aircraftInvolved.forEach(callsign => {
        const aircraft = this.lastAircraftData?.find(ac => ac.callsign === callsign);
        if (aircraft) {
          const pos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
          positions.push(pos);
        }
      });
      
      // 중간점 계산
      if (positions.length >= 2) {
        const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
        const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
        const avgZ = positions.reduce((sum, pos) => sum + (pos.z || 0), 0) / positions.length;
        
        return { x: avgX, y: avgY, z: avgZ };
      }
    }
    
    // 기본값: 활주로 중심점
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

  /**
   * 활주로 점유 정보 가져오기
   */
  public getRunwayOccupancy(): Map<string, RunwayOccupancy> {
    // 마지막으로 처리된 항공기 데이터로 활주로 점유 상태 계산
    return this.calculateRunwayOccupancy(this.lastAircraftData);
  }

  /**
   * 충돌 이벤트 가져오기
   */
  public getConflicts(): ConflictEvent[] {
    return this.lastConflictEvents;
  }

  /**
   * 활주로 임계점 좌표 가져오기
   */
  private getThresholdPosition(threshold: string): PlaneCoordinate {
    switch (threshold) {
      case '14L':
        return this.coordinateSystem.toPlane(37.5705, 126.7784);
      case '32R':
        return this.coordinateSystem.toPlane(37.5478, 126.8070);
      case '14R':
        return this.coordinateSystem.toPlane(37.5683, 126.7755);
      case '32L':
        return this.coordinateSystem.toPlane(37.5481, 126.8009);
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * 활주로 임계점 접근 헤딩 가져오기 (도 단위)
   */
  private getThresholdHeading(threshold: string): number {
    switch (threshold) {
      case '14L':
      case '14R':
        return 140; // 14 방향으로 접근
      case '32R':
      case '32L':
        return 320; // 32 방향으로 접근
      default:
        return 0;
    }
  }

  /**
   * 임계점에서 활주로 이름 가져오기
   */
  private getRunwayFromThreshold(threshold: string): string {
    switch (threshold) {
      case '14L':
      case '32R':
        return '14L_32R';
      case '14R':
      case '32L':
        return '14R_32L';
      default:
        return '';
    }
  }

  /**
   * 항공기가 특정 임계점의 부채꼴 접근 영역 내에 있는지 확인
   */
  private isInApproachSector(aircraft: TrackedAircraft, threshold: string): boolean {
    const thresholdPos = this.getThresholdPosition(threshold);
    const expectedHeading = this.getThresholdHeading(threshold);
    const aircraftPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    
    // 1. 고도 확인 (500 feet AGL 이하)
    if (aircraft.altitude > 500) {
      return false;
    }
    
    // 2. 임계점까지 거리 계산
    const distance = Math.sqrt(
      Math.pow(aircraftPos.x - thresholdPos.x, 2) + 
      Math.pow(aircraftPos.y - thresholdPos.y, 2)
    );
    
    // 3. 1마일(1609미터) 이내 확인
    const oneNauticalMile = 1852; // 1해리 = 1852미터
    if (distance > oneNauticalMile) {
      return false;
    }
    
    // 4. 항공기에서 임계점으로의 방향 계산
    const bearing = Math.atan2(
      thresholdPos.y - aircraftPos.y,
      thresholdPos.x - aircraftPos.x
    ) * 180 / Math.PI;
    
    // 5. 항공기 헤딩과 예상 접근 헤딩 비교
    const headingDifference = this.normalizeHeading(aircraft.heading - expectedHeading);
    
    // 6. 항공기에서 임계점으로의 방향과 예상 접근 방향 비교
    const bearingDifference = this.normalizeHeading(bearing - expectedHeading);
    
    // 7. ±15도 이내 확인 (헤딩과 방향 모두)
    const allowedAngle = 15;
    const isHeadingAligned = Math.abs(headingDifference) <= allowedAngle;
    const isBearingAligned = Math.abs(bearingDifference) <= allowedAngle;
    
    if (isHeadingAligned && isBearingAligned) {
      console.log(`[RWSL] 항공기 ${aircraft.callsign} ${threshold} 접근 영역 진입:`, {
        distance: distance.toFixed(0) + 'm',
        heading: aircraft.heading + '°',
        expectedHeading: expectedHeading + '°',
        headingDiff: headingDifference.toFixed(1) + '°',
        bearing: bearing.toFixed(1) + '°',
        bearingDiff: bearingDifference.toFixed(1) + '°'
      });
    }
    
    return isHeadingAligned && isBearingAligned;
  }

  /**
   * 헤딩 차이를 -180도에서 +180도 사이로 정규화
   */
  private normalizeHeading(heading: number): number {
    while (heading > 180) heading -= 360;
    while (heading < -180) heading += 360;
    return heading;
  }

  /**
   * 도착 항공기별 활주로 접근 감지 및 REL 활성화
   */
  public checkApproachingAircraft(aircraftData: TrackedAircraft[]): Map<string, string[]> {
    const approachingAircraft = new Map<string, string[]>();
    
    // 각 항공기에 대해 접근 영역 확인
    aircraftData.forEach(aircraft => {
      if (!aircraft.isActive) return;
      
      // 각 활주로 임계점 확인
      const thresholds = ['14L', '32R', '14R', '32L'];
      
      thresholds.forEach(threshold => {
        if (this.isInApproachSector(aircraft, threshold)) {
          const runway = this.getRunwayFromThreshold(threshold);
          
          if (!approachingAircraft.has(runway)) {
            approachingAircraft.set(runway, []);
          }
          
          approachingAircraft.get(runway)?.push(aircraft.callsign);
        }
      });
    });
    
    return approachingAircraft;
  }

  /**
   * 접근 항공기별 REL 활성화 처리 (임계점별)
   */
  private processApproachingAircraftREL(approachingAircraft: Map<string, string[]>): void {
    // 모든 REL 먼저 비활성화 (이전 상태 정리)
    this.deactivateAllREL();
    
    // 각 활주로별로 실제 접근하는 임계점 확인하여 정확한 REL만 활성화
    this.lastAircraftData.forEach(aircraft => {
      if (!aircraft.isActive) return;
      
      const thresholds = ['14L', '32R', '14R', '32L'];
      
      thresholds.forEach(threshold => {
        if (this.isInApproachSector(aircraft, threshold)) {
          const runway = this.getRunwayFromThreshold(threshold);
          console.log(`[RWSL] ${aircraft.callsign} → ${threshold} 임계점 접근 감지 (${runway} 활주로)`);
          
          // 해당 임계점의 REL만 활성화 (다른 활주로 REL은 영향받지 않음)
          this.activateRELForThreshold(threshold, [aircraft.callsign]);
        }
      });
    });
  }

  /**
   * 특정 활주로의 REL 등화 활성화
   */
  private activateRELForRunway(runway: string, aircraftList: string[]): void {
    // REL 등화 ID들을 가져와서 활성화
    // 실제 구현에서는 rwslLightPositions에서 해당 활주로의 REL을 찾아야 함
    const relLightIds = this.getRELLightIdsForRunway(runway);
    
    relLightIds.forEach(lightId => {
      const lightInfo: LightStateInfo = {
        id: lightId,
        type: 'REL',
        active: true,
        reason: `접근 항공기 감지: ${aircraftList.join(', ')}`,
        activatedAt: Date.now(),
        position: this.getLightPosition(lightId, 'REL'),
        runwayDirection: runway
      };
      
      this.currentState.rel.set(lightId, lightInfo);
    });
    
    console.log(`[RWSL] ${runway} REL 활성화: ${relLightIds.length}개 등화`);
  }

  /**
   * 특정 임계점별 REL 등화 ID 목록 가져오기 (교차점별 정밀 매핑)
   */
  private getRELLightIdsForThreshold(threshold: string): string[] {
    const relIds: string[] = [];
    
    // 각 임계점별로 정확히 교차하는 REL만 반환
    switch (threshold) {
      case '14L':
        // 14L 방향 접근 시 - 14L과 교차하는 REL만
        relIds.push('REL_A_14L', 'REL_B_14L', 'REL_C_14L', 'REL_D_14L', 'REL_E_14L');
        break;
      case '32R':
        // 32R 방향 접근 시 - 32R과 교차하는 REL만
        relIds.push('REL_A_32R', 'REL_B_32R', 'REL_C_32R', 'REL_D_32R', 'REL_E_32R');
        break;
      case '14R':
        // 14R 방향 접근 시 - 14R과 교차하는 REL만  
        relIds.push('REL_A_14R', 'REL_B_14R', 'REL_C_14R', 'REL_D_14R', 'REL_E_14R');
        break;
      case '32L':
        // 32L 방향 접근 시 - 32L과 교차하는 REL만
        relIds.push('REL_A_32L', 'REL_B_32L', 'REL_C_32L', 'REL_D_32L', 'REL_E_32L');
        break;
    }
    
    console.log(`[RWSL] ${threshold} 임계점 교차 REL: ${relIds.join(', ')}`);
    return relIds;
  }

  /**
   * 활주로별 REL 등화 ID 목록 가져오기 (레거시 호환)
   */
  private getRELLightIdsForRunway(runway: string): string[] {
    // 활주로 전체 REL (양방향 모든 교차점)
    const relIds: string[] = [];
    
    if (runway === '14L_32R') {
      // 14L/32R 활주로 - 양방향 모든 교차 REL
      relIds.push(
        'REL_A_14L', 'REL_B_14L', 'REL_C_14L', 'REL_D_14L', 'REL_E_14L', // 14L 방향
        'REL_A_32R', 'REL_B_32R', 'REL_C_32R', 'REL_D_32R', 'REL_E_32R'  // 32R 방향
      );
    } else if (runway === '14R_32L') {
      // 14R/32L 활주로 - 양방향 모든 교차 REL
      relIds.push(
        'REL_A_14R', 'REL_B_14R', 'REL_C_14R', 'REL_D_14R', 'REL_E_14R', // 14R 방향
        'REL_A_32L', 'REL_B_32L', 'REL_C_32L', 'REL_D_32L', 'REL_E_32L'  // 32L 방향
      );
    }
    
    return relIds;
  }

  /**
   * 특정 임계점의 REL 등화 활성화
   */
  private activateRELForThreshold(threshold: string, aircraftList: string[]): void {
    const relLightIds = this.getRELLightIdsForThreshold(threshold);
    
    relLightIds.forEach(lightId => {
      // 새로운 REL ID로 상태 저장
      const lightInfo: LightStateInfo = {
        id: lightId,
        type: 'REL',
        active: true,
        reason: `${threshold} 접근: ${aircraftList.join(', ')}`,
        activatedAt: Date.now(),
        position: this.getLightPosition(lightId, 'REL'),
        runwayDirection: threshold
      };
      
      this.currentState.rel.set(lightId, lightInfo);
      
      // 시각화를 위해 기존 REL ID들도 활성화
      const existingRelIds = this.mapNewRELIdToExisting(lightId);
      existingRelIds.forEach(existingId => {
        const existingLightInfo: LightStateInfo = {
          id: existingId,
          type: 'REL',
          active: true,
          reason: `${threshold} 접근: ${aircraftList.join(', ')} (매핑: ${lightId})`,
          activatedAt: Date.now(),
          position: this.getLightPosition(existingId, 'REL'),
          runwayDirection: threshold
        };
        
        this.currentState.rel.set(existingId, existingLightInfo);
      });
    });
    
    console.log(`[RWSL] ${threshold} 임계점 REL 활성화: ${relLightIds.length}개 등화 - ${relLightIds.join(', ')}`);
    
    // 매핑된 기존 REL ID들도 로그
    relLightIds.forEach(lightId => {
      const existingIds = this.mapNewRELIdToExisting(lightId);
      if (existingIds.length > 0) {
        console.log(`[RWSL] 매핑된 기존 REL 활성화: ${lightId} → ${existingIds.join(', ')}`);
      }
    });
  }

  /**
   * 모든 REL 비활성화
   */
  private deactivateAllREL(): void {
    let deactivatedCount = 0;
    this.currentState.rel.forEach((light, id) => {
      if (light.active) {
        light.active = false;
        light.deactivatedAt = Date.now();
        deactivatedCount++;
      }
    });
    
    if (deactivatedCount > 0) {
      console.log(`[RWSL] 모든 REL 비활성화: ${deactivatedCount}개 등화 소등`);
    }
  }

  /**
   * 항공기 Airborne 상태 감지
   */
  private isAirborne(aircraft: TrackedAircraft): boolean {
    // Airborne 조건: 50+ knots + 500+ fpm 상승률 + 100+ feet AGL
    const hasSpeed = aircraft.speed >= 50;
    const hasClimbRate = (aircraft.verticalSpeed || 0) >= 500; // fpm
    const hasAltitude = aircraft.altitude >= 100;
    
    return hasSpeed && hasClimbRate && hasAltitude;
  }

  /**
   * 개선된 항공기 상태 분류
   */
  private determineAdvancedAircraftState(aircraft: TrackedAircraft): string {
    const speed = aircraft.speed;
    const verticalSpeed = aircraft.verticalSpeed || 0;
    const altitude = aircraft.altitude;
    
    // Airborne 확인
    if (this.isAirborne(aircraft)) {
      return 'AIRBORNE';
    }
    
    // 지상 상태 분류
    if (speed >= 80) {
      return verticalSpeed > 0 ? 'TAKEOFF_ROLLING' : 'LANDING_ROLLOUT';
    } else if (speed >= 34) {
      return verticalSpeed > 0 ? 'TAKEOFF_ROLLING' : 'LANDING_TAXI';
    } else if (speed >= 5) {
      return 'TAXI';
    } else {
      return 'LINEUP';
    }
  }

  /**
   * Airborne 항공기 REL 소등 처리
   */
  private processAirborneAircraft(aircraftData: TrackedAircraft[]): void {
    aircraftData.forEach(aircraft => {
      if (!aircraft.isActive) return;
      
      if (this.isAirborne(aircraft)) {
        console.log(`[RWSL] ${aircraft.callsign} Airborne 감지 - 모든 REL 소등`);
        
        // Airborne 항공기와 관련된 모든 REL 소등
        this.deactivateRELForAircraft(aircraft.callsign);
      }
    });
  }

  /**
   * 착륙 항공기 속도 기준 REL 소등 처리 (FAA 기준)
   */
  private processSpeedBasedRELDeactivation(aircraftData: TrackedAircraft[]): void {
    aircraftData.forEach(aircraft => {
      if (!aircraft.isActive) return;
      
      const state = this.determineAdvancedAircraftState(aircraft);
      
      // 착륙 항공기 34kt 임계값 - 완전 소등 (택시 상태 전환)
      if ((state === 'LANDING_TAXI' || state === 'TAXI') && aircraft.speed <= 34) {
        console.log(`[RWSL] ${aircraft.callsign} 34kt 이하 택시 상태 (${aircraft.speed}kt) - 모든 REL 완전 소등`);
        this.deactivateAllRELForLandingAircraft(aircraft);
      }
      // 착륙 항공기 80kt 임계값 - 30초 경로 밖 REL 소등 (1단계 소등)
      else if (state === 'LANDING_ROLLOUT' && aircraft.speed <= 80) {
        console.log(`[RWSL] ${aircraft.callsign} 80kt 이하 도달 (${aircraft.speed}kt) - 30초 경로 밖 REL 소등`);
        this.deactivate30SecondPathRELForLanding(aircraft);
      }
      
      // 2~3초 예측 소등 처리 (모든 착륙 항공기)
      if (state === 'LANDING_ROLLOUT' || state === 'LANDING_TAXI') {
        this.processAnticipatedRELDeactivation(aircraft);
      }
    });
  }

  /**
   * 특정 항공기와 관련된 REL 소등
   */
  private deactivateRELForAircraft(callsign: string): void {
    this.currentState.rel.forEach((light, id) => {
      if (light.active && light.reason?.includes(callsign)) {
        light.active = false;
        light.deactivatedAt = Date.now();
        console.log(`[RWSL] REL ${id} 소등 (${callsign} 관련)`);
      }
    });
  }

  /**
   * 착륙 항공기 완전 REL 소등 (34kt 이하 택시 상태)
   */
  private deactivateAllRELForLandingAircraft(aircraft: TrackedAircraft): void {
    // 해당 항공기가 착륙한 활주로의 모든 REL 소등
    const landingRunway = this.determineLandingRunway(aircraft);
    
    this.currentState.rel.forEach((light, id) => {
      if (light.active && light.reason?.includes(aircraft.callsign)) {
        light.active = false;
        light.deactivatedAt = Date.now();
        console.log(`[RWSL] REL ${id} 완전 소등 - ${aircraft.callsign} 택시 상태 (${landingRunway})`);
      }
    });
  }

  /**
   * 착륙 항공기 30초 경로 밖 REL 소등 (80kt 이하)
   */
  private deactivate30SecondPathRELForLanding(aircraft: TrackedAircraft): void {
    const aircraftPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const currentSpeed = aircraft.speed * 0.514444; // knots to m/s
    const heading = aircraft.heading * Math.PI / 180; // degrees to radians
    
    // 30초 후 예상 위치 계산
    const predictedDistance = currentSpeed * 30; // 30초 후 거리
    const predictedX = aircraftPos.x + Math.sin(heading) * predictedDistance;
    const predictedY = aircraftPos.y + Math.cos(heading) * predictedDistance;
    
    this.currentState.rel.forEach((light, id) => {
      if (!light.active || !light.reason?.includes(aircraft.callsign)) return;
      
      const lightPos = light.position;
      
      // 예상 경로와 REL 위치 간 거리 계산
      const distanceToPath = this.calculateDistanceToPath(
        aircraftPos, 
        { x: predictedX, y: predictedY }, 
        lightPos
      );
      
      // 30초 경로에서 200m 이상 떨어진 REL 소등
      if (distanceToPath > 200) {
        light.active = false;
        light.deactivatedAt = Date.now();
        console.log(`[RWSL] 30초 경로 밖 REL ${id} 소등 (경로 거리: ${distanceToPath.toFixed(0)}m)`);
      }
    });
  }

  /**
   * 2~3초 예측 REL 소등 (각 교차점 도달 전 미리 소등)
   */
  private processAnticipatedRELDeactivation(aircraft: TrackedAircraft): void {
    const aircraftPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    const currentSpeed = aircraft.speed * 0.514444; // knots to m/s
    const heading = aircraft.heading * Math.PI / 180; // degrees to radians
    
    // 2.5초 후 예상 위치 계산
    const anticipationTime = 2.5; // 2~3초 평균
    const anticipatedDistance = currentSpeed * anticipationTime;
    const anticipatedX = aircraftPos.x + Math.sin(heading) * anticipatedDistance;
    const anticipatedY = aircraftPos.y + Math.cos(heading) * anticipatedDistance;
    
    this.currentState.rel.forEach((light, id) => {
      if (!light.active || !light.reason?.includes(aircraft.callsign)) return;
      
      const lightPos = light.position;
      
      // 예상 위치와 REL 위치 간 거리
      const distanceToAnticipated = Math.sqrt(
        Math.pow(anticipatedX - lightPos.x, 2) + 
        Math.pow(anticipatedY - lightPos.y, 2)
      );
      
      // 2.5초 후 위치에서 50m 이내 REL은 미리 소등
      if (distanceToAnticipated <= 50) {
        light.active = false;
        light.deactivatedAt = Date.now();
        console.log(`[RWSL] 예측 소등 REL ${id} - ${aircraft.callsign} 2.5초 후 도달 예상`);
      }
    });
  }

  /**
   * 착륙 활주로 판단
   */
  private determineLandingRunway(aircraft: TrackedAircraft): string {
    // 항공기 위치를 기반으로 어떤 활주로에 착륙했는지 판단
    const aircraftPos = this.coordinateSystem.toPlane(aircraft.latitude, aircraft.longitude);
    
    // 각 활주로 중심선과의 거리 계산
    if (this.isOnRunway(aircraft, '14L_32R')) {
      return '14L_32R';
    } else if (this.isOnRunway(aircraft, '14R_32L')) {
      return '14R_32L';
    }
    
    // 기본값 (가장 가까운 활주로)
    return '14L_32R';
  }

  /**
   * 점과 선분 사이의 최단거리 계산
   */
  private calculateDistanceToPath(
    pathStart: { x: number; y: number }, 
    pathEnd: { x: number; y: number }, 
    point: { x: number; y: number }
  ): number {
    const A = point.x - pathStart.x;
    const B = point.y - pathStart.y;
    const C = pathEnd.x - pathStart.x;
    const D = pathEnd.y - pathStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // 시작점과 끝점이 같은 경우
      return Math.sqrt(A * A + B * B);
    }
    
    const param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = pathStart.x;
      yy = pathStart.y;
    } else if (param > 1) {
      xx = pathEnd.x;
      yy = pathEnd.y;
    } else {
      xx = pathStart.x + param * C;
      yy = pathStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
}