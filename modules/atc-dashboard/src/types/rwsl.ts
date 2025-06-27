/**
 * 김포공항 RWSL 시스템 타입 정의
 * 설계 문서 기반 구현
 */

import { TrackedAircraft } from './index';
import { PlaneCoordinate } from './coordinates';

// ==================== 기본 타입 ====================

export type RunwayDirection = '14L' | '32R' | '14R' | '32L';
export type LightType = 'REL' | 'THL' | 'RIL';
export type LightState = 'OFF' | 'ON' | 'FLASHING';
export type ConflictSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';
export type SystemStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';

// ==================== 충돌 감지 타입 ====================

export enum ConflictType {
  RUNWAY_INTRUSION = 'runway_intrusion',
  CROSSING_TRAFFIC = 'crossing_traffic',
  WAKE_TURBULENCE = 'wake_turbulence',
  SIMULTANEOUS_TAKEOFF = 'simultaneous_takeoff',
  HEAD_ON = 'head_on'
}

export interface ConflictEvent {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  aircraftInvolved: string[];
  runwayInvolved: string[];
  predictedTime: Date;
  confidence: number;
  recommendedAction: string;
  estimatedSeparation: number; // meters
}

export interface RunwayOccupancy {
  runway: RunwayDirection;
  occupied: boolean;
  aircraft: TrackedAircraft[];
  occupancyType: 'TAKEOFF' | 'LANDING' | 'TAXI' | 'LINEUP' | null;
  occupancyDetails?: {
    entryTime: number;
    estimatedExitTime: number;
    operationType: string;
    positionOnRunway: number;
  };
}

// ==================== 등화 시스템 타입 ====================

export interface LightPosition {
  id: string;
  type: LightType;
  runway: RunwayDirection;
  taxiway?: string;
  position: {
    lat: number;
    lon: number;
    localCoords: PlaneCoordinate;
  };
  purpose: string;
  coverageArea: number; // meters
  direction?: string;
}

export interface RELConfiguration extends LightPosition {
  type: 'REL';
  direction: 'from_west' | 'from_east';
}

export interface THLConfiguration extends LightPosition {
  type: 'THL';
  coverageArea: number;
  direction: 'eastbound' | 'westbound';
}

export interface RILConfiguration extends LightPosition {
  type: 'RIL';
  intersectionId: string;
}

// ==================== 제어 시스템 타입 ====================

export interface RELControlDecision {
  runway: string;
  controlAction: 'NO_ACTION' | 'ACTIVATE_RED' | 'DEACTIVATE_ALL' | 'SELECTIVE_ACTIVATION';
  affectedRELLights: string[];
  reasoning: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detailedCommands?: RELCommand[];
}

export interface RELCommand {
  relId: string;
  command: 'RED_ON' | 'RED_OFF' | 'FLASH';
  intensity?: number;
  flashPattern?: 'steady' | 'slow_flash' | 'medium_flash' | 'fast_flash';
  activationDelay?: number;
  duration?: number;
}

export interface THLControlDecision {
  runway: string;
  controlAction: 'NO_ACTION' | 'ACTIVATE_RED' | 'SELECTIVE_ACTIVATION' | 'INTERSECTION_HOLD';
  affectedTHLLights: string[];
  reasoning: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  conflictScenarios?: ConflictAnalysis[];
  detailedCommands?: THLCommand[];
}

export interface THLCommand {
  thlId: string;
  command: 'RED_ON' | 'RED_OFF' | 'AMBER_FLASH' | 'SEQUENCE_FLASH';
  intensity?: number;
  flashPattern?: string;
  activationDelay?: number;
  duration?: number;
  priority?: string;
}

// ==================== 분석 타입 ====================

export interface AircraftApproachData {
  aircraft: TrackedAircraft;
  targetRunway: string;
  distanceToThreshold: number;
  estimatedLandingTime: number;
  approachSpeed: number;
  approachPhase: 'INITIAL' | 'INTERMEDIATE' | 'FINAL' | 'SHORT_FINAL';
  conflictPotential: number;
}

export interface TakeoffReadyAnalysis {
  aircraft: TrackedAircraft;
  assignedRunway: string;
  positionOnRunway: PlaneCoordinate;
  readinessLevel: 'holding' | 'lineup_ready' | 'takeoff_ready' | 'rolling';
  estimatedTakeoffTime: number;
  takeoffClearanceStatus: boolean;
}

export interface ConflictAnalysis {
  hasConflict: boolean;
  severity: string;
  conflictDetails: ConflictDetail[];
  recommendedAction: string;
}

export interface ConflictDetail {
  approachingAircraft: string;
  takeoffAircraft: string;
  estimatedLandingTime: number;
  estimatedTakeoffTime: number;
  timeSeparation: number;
  minimumRequiredSeparation: number;
  severity: string;
}

// ==================== 시스템 상태 타입 ====================

export interface RWSLSystemStatus {
  collisionDetection: {
    activeConflicts: ConflictEvent[];
    processingTime: number;
    lastUpdate: Date;
  };
  relStatus: {
    activeLights: number;
    totalLights: number;
    decisions: RELControlDecision[];
  };
  thlStatus: {
    activeLights: number;
    totalLights: number;
    decisions: THLControlDecision[];
  };
  systemHealth: {
    status: SystemStatus;
    uptime: number;
    errorCount: number;
    performanceScore: number;
  };
  timestamp: Date;
}

export interface PerformanceMetrics {
  avgProcessingTime: number;
  maxProcessingTime: number;
  minProcessingTime: number;
  avgConflictsPerCycle: number;
  avgAccuracy: number;
  totalDetections: number;
  detectionRate: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
}

// ==================== 김포공항 설정 타입 ====================

export interface GimpoAirportConfig {
  runways: {
    '14L_32R': RunwayConfig;
    '14R_32L': RunwayConfig;
  };
  rwslLights: {
    rel: RELConfiguration[];
    thl: THLConfiguration[];
    ril: RILConfiguration[];
  };
  taxiways: TaxiwayConfig[];
  intersections: IntersectionConfig[];
  referencePoint: {
    lat: number;
    lon: number;
  };
}

export interface RunwayConfig {
  id: string;
  centerline: Array<{ lat: number; lon: number }>;
  width: number;
  length: number;
  protectionZone: number;
  threshold: {
    '14L'?: { lat: number; lon: number };
    '32R'?: { lat: number; lon: number };
    '14R'?: { lat: number; lon: number };
    '32L'?: { lat: number; lon: number };
  };
}

export interface TaxiwayConfig {
  id: string;
  segments: Array<{ lat: number; lon: number }>;
  width: number;
  connectedRunways: string[];
}

export interface IntersectionConfig {
  id: string;
  runways: string[];
  position: { lat: number; lon: number };
  criticalZoneRadius: number;
}

// ==================== 레거시 호환성 (기존 시스템과의 인터페이스) ====================

export interface RWSLState {
  rel: Map<string, LightStateInfo>;
  thl: Map<string, LightStateInfo>;
  conflicts: RWSLConflict[];
  lastUpdate: number;
  systemStatus: string;
}

export interface LightStateInfo {
  id: string;
  type: LightType;
  active: boolean;
  reason?: string;
  activatedAt?: number;
  deactivatedAt?: number;
  position: PlaneCoordinate;
  runwayDirection: string;
}

export interface RWSLConflict {
  id: string;
  type: 'RUNWAY_INCURSION' | 'TAKEOFF_HOLD' | 'INTERSECTION_CONFLICT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  involvedAircraft: string[];
  runway: string;
  position: PlaneCoordinate;
  timestamp: number;
}

export interface DetectionResult {
  detected: boolean;
  aircraft?: string[];
  distance?: number;
  timeToConflict?: number;
}