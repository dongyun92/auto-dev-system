import { GeographicCoordinate, ProjectionType } from './coordinates';

// 활주로 방향별 설정
export interface RunwayDirection {
  id: string;  // 예: "14L", "32R"
  threshold: GeographicCoordinate;
  stopway?: number;  // 정지로 길이 (미터)
}

// 활주로 설정
export interface RunwayConfig {
  id: string;  // 예: "14L/32R"
  name: string;
  directions: {
    [key: string]: RunwayDirection;  // 예: { "14L": {...}, "32R": {...} }
  };
  width: number;  // 미터
}

// 등화 위치 설정
export interface LightPosition {
  id: string;
  offset: {  // 기준점으로부터의 오프셋 (미터)
    x: number;
    y: number;
  };
}

// REL 설정
export interface RELConfig {
  enabled: boolean;
  detectionRange: {
    inner: number;  // 미터
    outer: number;  // 미터
  };
  sectorAngle: number;  // 도
  activationDelay: number;  // 밀리초
}

// THL 설정
export interface THLConfig {
  enabled: boolean;
  detectionArea: {
    length: number;  // 미터
    width: number;   // 미터
  };
  activationDelay: number;  // 밀리초
}

// RWSL 설정
export interface RWSLConfig {
  rel: RELConfig;
  thl: THLConfig;
  lights: {
    rel: { [runwayDirection: string]: LightPosition[] };
    thl: { [runwayDirection: string]: LightPosition[] };
  };
}

// 공항 설정
export interface AirportConfig {
  id: string;  // ICAO 코드 (예: RKSS)
  name: string;
  referencePoint: GeographicCoordinate;  // 공항 기준점 (평면좌표 원점)
  projection: ProjectionType;
  runways: RunwayConfig[];
  rwsl: RWSLConfig;
  
  // 선택적 설정
  magneticVariation?: number;  // 자북 편차 (도)
  elevation?: number;  // 공항 고도 (미터)
  timeZone?: string;  // 시간대
}