import { PlaneCoordinate } from './coordinates';

// RWSL 등화 상태
export interface LightState {
  id: string;
  type: 'REL' | 'THL' | 'RIL';
  active: boolean;
  reason?: string;
  activatedAt?: number;
  deactivatedAt?: number;
  position: PlaneCoordinate;
  runwayDirection: string;
}

// RWSL 충돌 정보
export interface RWSLConflict {
  id: string;
  type: 'RUNWAY_INCURSION' | 'TAKEOFF_HOLD' | 'INTERSECTION_CONFLICT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  involvedAircraft: string[];
  runway: string;
  position: PlaneCoordinate;
  timestamp: number;
}

// RWSL 시스템 상태
export interface RWSLState {
  rel: Map<string, LightState>;
  thl: Map<string, LightState>;
  conflicts: RWSLConflict[];
  lastUpdate: number;
  systemStatus: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
}

// RWSL 감지 결과
export interface DetectionResult {
  detected: boolean;
  aircraft?: string[];
  distance?: number;
  timeToConflict?: number;
}