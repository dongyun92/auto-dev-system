/**
 * RWSL 핵심 시스템 - 논문/상용제품 분석 기반 구현
 */

import { TrackedAircraft } from '../../types';

// 항공기 상태 정의 (FAA RWSL 표준)
export enum AircraftState {
  PARKED = 'PARKED',         // 속도 < 5kt
  TAXI_OUT = 'TAXI_OUT',     // 5kt ≤ 속도 < 34kt, 게이트→활주로
  LINEUP = 'LINEUP',         // 활주로 진입, 속도 < 10kt  
  TAKEOFF_ROLL = 'TO_ROLL',  // 활주로, 속도 ≥ 30kt (FAA 표준)
  AIRBORNE = 'AIRBORNE',     // 고도 > 50ft
  APPROACH = 'APPROACH',     // 고도 < 1500ft, 하강중, 속도 ≥ 80kt
  LANDING_ROLL = 'LDG_ROLL', // 활주로, 속도 < 80kt (FAA 표준)
  TAXI_IN = 'TAXI_IN',       // 5kt ≤ 속도 < 34kt, 활주로→게이트
  EMERGENCY = 'EMERGENCY'    // 7700 스쿼크
}

// 센서 융합 설정
export interface SensorFusionConfig {
  sources: {
    adsb: { weight: number; latency: number };
    mlat: { weight: number; latency: number };
    radar: { weight: number; latency: number };
  };
  fusionRate: number; // Hz
  confidenceThreshold: number;
  kalmanFilter: {
    processNoise: number;
    measurementNoise: number;
  };
}

// 등화 그룹 정의 (RWSL 표준)
export interface LightGroup {
  id: string; // "14L_REL_A1"
  runway: string;
  type: 'REL' | 'THL' | 'RIL';
  position: {
    taxiway?: string;
    distance?: number; // from threshold
  };
  fixtures: Light[];
  control: {
    mode: 'INDIVIDUAL' | 'GROUP' | 'CASCADE';
    priority: number; // 1-10
    override: boolean;
  };
}

// 개별 등화
export interface Light {
  id: string;
  position: { lat: number; lng: number };
  state: 'ON' | 'OFF' | 'FAULT';
  intensity: number; // 0-100%
}

// Fail-Safe 모드 정의
export enum FailSafeMode {
  NORMAL = 'NORMAL',
  SENSOR_LOSS = 'SENSOR_LOSS',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  CPU_OVERLOAD = 'CPU_OVERLOAD',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE'
}

// RWSL 시스템 상태
export interface RWSLSystemState {
  mode: FailSafeMode;
  confidence: number;
  lastUpdate: number;
  activeLights: number;
  totalLights: number;
  cpuUsage: number;
  alerts: SystemAlert[];
}

export interface SystemAlert {
  id: string;
  type: 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// REL 활성화 규칙 (FAA 표준)
export interface RELActivationRules {
  highSpeedTraffic: {
    speedThreshold: number; // 30 knots (FAA)
    taxiSpeedThreshold: number; // 34 knots (FAA)
    landingSpeedThreshold: number; // 80 knots (FAA)
    scanRange: number; // meters
  };
  approachingAircraft: {
    distanceThreshold: number; // 1 mile (FAA)
    altitudeThreshold: number; // feet AGL
  };
  cascadeOff: {
    enabled: boolean;
    leadTime: number; // 2-3 seconds (FAA)
    sequence: 'PROGRESSIVE' | 'IMMEDIATE';
  };
}

// THL 충돌 감지 설정
export interface THLConflictDetection {
  departureWindow: {
    positionTolerance: number; // meters from threshold
    headingTolerance: number; // degrees
    speedThreshold: number; // knots
  };
  conflictWindow: number; // seconds (T_conf)
  separationBuffer: number; // seconds
  anticipatedSeparation: {
    enabled: boolean;
    clearanceTime: number; // seconds after rotation
  };
}

// RIL 교차점 로직
export interface RILIntersectionLogic {
  conflictThreshold: number; // seconds
  intersectionPoints: Array<{
    id: string;
    position: { lat: number; lng: number };
    runways: string[];
  }>;
}

/**
 * RWSL 핵심 엔진
 */
export class RWSLCore {
  private state: RWSLSystemState;
  private config: RWSLConfig;
  private lightGroups: Map<string, LightGroup>;
  
  constructor(config: RWSLConfig) {
    this.config = config;
    this.lightGroups = new Map();
    this.state = {
      mode: FailSafeMode.NORMAL,
      confidence: 1.0,
      lastUpdate: Date.now(),
      activeLights: 0,
      totalLights: 0,
      cpuUsage: 0,
      alerts: []
    };
  }
  
  /**
   * 항공기 상태 분류
   */
  classifyAircraftState(aircraft: TrackedAircraft, history?: TrackedAircraft[]): AircraftState {
    // 긴급 상황 우선
    if (aircraft.squawk === '7700') {
      return AircraftState.EMERGENCY;
    }
    
    // 공중
    if (aircraft.altitude > 50) {
      if (aircraft.altitude < 1500 && (aircraft.verticalSpeed || 0) < -100) {
        return AircraftState.APPROACH;
      }
      return AircraftState.AIRBORNE;
    }
    
    // 지상 - FAA 표준 속도 임계값
    if (aircraft.speed < 5) {
      return AircraftState.PARKED;
    }
    
    // 활주로 상태 확인 필요
    const onRunway = this.isOnRunway(aircraft);
    
    if (onRunway) {
      if (aircraft.speed >= 30) {
        // FAA: 30kt 이상 = 고속 이동
        // 가속 중이면 이륙, 감속 중이면 착륙
        const acceleration = this.calculateAcceleration(aircraft, history);
        return acceleration > 0 ? AircraftState.TAKEOFF_ROLL : AircraftState.LANDING_ROLL;
      } else if (aircraft.speed < 10) {
        return AircraftState.LINEUP;
      }
    }
    
    // 택시 상태 (FAA: 5-34kt)
    if (aircraft.speed < 34) {
      // 방향 판단 로직 필요 (게이트→활주로 or 활주로→게이트)
      return AircraftState.TAXI_OUT; // 단순화
    }
    
    // 34kt 이상이지만 활주로에 없으면 택시 상태로 간주
    return AircraftState.TAXI_OUT;
  }
  
  /**
   * 센서 융합 신뢰도 계산
   */
  calculateConfidence(sources: SensorData[]): number {
    if (sources.length === 0) return 0;
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    sources.forEach(source => {
      const age = Date.now() - source.timestamp;
      const freshness = Math.max(0, 1 - age / 5000); // 5초 이상 오래된 데이터는 신뢰도 0
      
      const weight = this.config.sensorFusion.sources[source.type]?.weight || 0;
      weightedSum += source.confidence * freshness * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Fail-Safe 모드 결정
   */
  determineFailSafeMode(): FailSafeMode {
    const now = Date.now();
    const dataAge = now - this.state.lastUpdate;
    
    // 센서 손실
    if (dataAge > 2000) {
      return FailSafeMode.SENSOR_LOSS;
    }
    
    // 부분 실패
    if (this.state.confidence < 0.5) {
      return FailSafeMode.PARTIAL_FAILURE;
    }
    
    // CPU 과부하
    if (this.state.cpuUsage > 85) {
      return FailSafeMode.CPU_OVERLOAD;
    }
    
    return FailSafeMode.NORMAL;
  }
  
  /**
   * 활주로 위치 확인
   */
  private isOnRunway(aircraft: TrackedAircraft): boolean {
    // 실제 구현에서는 활주로 다각형과 항공기 위치 비교
    // 여기서는 단순화
    return aircraft.assignedRunway !== undefined;
  }
  
  /**
   * 가속도 계산
   */
  private calculateAcceleration(
    current: TrackedAircraft, 
    history?: TrackedAircraft[]
  ): number {
    if (!history || history.length < 2) return 0;
    
    const prev = history[history.length - 2];
    const dt = (current.timestamp || Date.now()) - (prev.timestamp || Date.now());
    
    if (dt === 0) return 0;
    
    const dv = (current.speed - prev.speed) * 0.514; // kt to m/s
    return dv / (dt / 1000); // m/s²
  }
}

// 타입 정의들
export interface RWSLConfig {
  airport: string;
  runways: RunwayConfig[];
  sensorFusion: SensorFusionConfig;
  relRules: RELActivationRules;
  thlDetection: THLConflictDetection;
  rilLogic: RILIntersectionLogic;
}

export interface RunwayConfig {
  id: string;
  thresholds: {
    start: { lat: number; lng: number };
    end: { lat: number; lng: number };
  };
  lightGroups: {
    rel: string[];
    thl: string[];
    ril?: string[];
  };
}

export interface SensorData {
  type: 'adsb' | 'mlat' | 'radar';
  timestamp: number;
  confidence: number;
  data: any;
}