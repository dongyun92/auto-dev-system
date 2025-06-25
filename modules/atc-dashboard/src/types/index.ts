export interface TrackedAircraft {
  id: number;
  callsign: string;
  flightNumber?: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  verticalSpeed?: number;
  squawk?: string;
  aircraftType?: string;
  registration?: string;
  origin?: string;
  destination?: string;
  flightPhase?: FlightPhase;
  assignedRunway?: string;
  approachSequence?: number;
  isEmergency: boolean;
  isActive: boolean;
  lastRadarContact: string;
  updatedAt: string;
  timestamp?: number; // 보간을 위한 타임스탬프 추가
}

export interface TrajectoryPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  verticalSpeed?: number;
  timestamp: string;
  pointType: 'ACTUAL' | 'PREDICTED' | 'INTERPOLATED';
  confidenceScore?: number;
}

export interface Trajectory {
  callsign: string;
  points: TrajectoryPoint[];
}

export interface Runway {
  id: number;
  runwayId: string;
  name: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  heading: number;
  length: number;
  width: number;
  status: RunwayStatus;
  isActive: boolean;
}

export interface DashboardState {
  aircraft: TrackedAircraft[];
  runways: Runway[];
  selectedAircraft?: TrackedAircraft;
  emergencyAlerts: EmergencyAlert[];
  systemStatus: SystemStatus;
}

export interface EmergencyAlert {
  id: string;
  callsign: string;
  type: 'EMERGENCY' | 'CONFLICT' | 'RUNWAY_INCURSION' | 'SYSTEM_FAILURE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface SystemStatus {
  radarStatus: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  communicationStatus: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  rwslStatus: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  lastUpdate: string;
}

export type FlightPhase = 
  | 'TAXI_OUT'
  | 'TAKEOFF'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'LANDING'
  | 'TAXI_IN'
  | 'PARKED';

export type RunwayStatus = 
  | 'OPERATIONAL'
  | 'CLOSED'
  | 'MAINTENANCE'
  | 'EMERGENCY';