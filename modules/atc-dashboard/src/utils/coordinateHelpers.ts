import { CoordinateSystem } from '../core/coordinates';
import { PlaneCoordinate, GeographicCoordinate } from '../types/coordinates';
import { TrackedAircraft } from '../types';

// 마이그레이션된 헬퍼 함수들 - 평면좌표계 사용

// 가속도 계산 (이전 속도와 현재 속도 기반)
export const calculateAcceleration = (
  currentSpeed: number,
  previousSpeed: number,
  deltaTime: number // 초
): number => {
  if (deltaTime === 0) return 0;
  return (currentSpeed - previousSpeed) / deltaTime;
};

// 두 항공기 간 예상 충돌 시간 계산 (평면좌표 기반)
export const calculateTimeToConflictPlane = (
  aircraft1Pos: PlaneCoordinate,
  aircraft1Speed: number, // kt
  aircraft2Pos: PlaneCoordinate,
  aircraft2Speed: number, // kt
  conflictPoint: PlaneCoordinate,
  coordSystem: CoordinateSystem
): number => {
  // 각 항공기에서 충돌 지점까지의 거리
  const dist1 = coordSystem.distance(aircraft1Pos, conflictPoint);
  const dist2 = coordSystem.distance(aircraft2Pos, conflictPoint);
  
  // 속도를 m/s로 변환 (1 kt = 0.514 m/s)
  const speed1 = aircraft1Speed * 0.514;
  const speed2 = aircraft2Speed * 0.514;
  
  if (speed1 === 0 || speed2 === 0) return Infinity;
  
  const time1 = dist1 / speed1;
  const time2 = dist2 / speed2;
  
  // 비슷한 시간에 도착하면 충돌 가능
  return Math.abs(time1 - time2) < 5 ? Math.min(time1, time2) : Infinity;
};

// 활주로 교차점 계산 (평면좌표 기반)
export const findRunwayIntersectionPlane = (
  runway1Start: PlaneCoordinate,
  runway1End: PlaneCoordinate,
  runway2Start: PlaneCoordinate,
  runway2End: PlaneCoordinate
): PlaneCoordinate | null => {
  // 선분 교차 알고리즘
  const x1 = runway1Start.x, y1 = runway1Start.y;
  const x2 = runway1End.x, y2 = runway1End.y;
  const x3 = runway2Start.x, y3 = runway2Start.y;
  const x4 = runway2End.x, y4 = runway2End.y;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0000001) return null; // 평행
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }
  
  return null;
};

// 측풍 성분 계산
export const calculateCrosswindComponent = (
  windSpeed: number,
  windDirection: number,
  runwayHeading: number
): number => {
  const angle = Math.abs(windDirection - runwayHeading) * Math.PI / 180;
  return Math.abs(windSpeed * Math.sin(angle));
};

// 위치 추정 (평면좌표 기반, GPS 손실 시)
export const estimatePositionPlane = (
  lastKnownPosition: PlaneCoordinate,
  heading: number, // 도
  speed: number, // kt
  elapsedTime: number, // 초
  coordSystem: CoordinateSystem
): PlaneCoordinate => {
  // 이동 거리 (미터)
  const distance = speed * 0.514 * elapsedTime;
  
  // heading을 라디안으로 변환
  const headingRad = heading * Math.PI / 180;
  
  // 평면좌표에서 새 위치 계산
  const dx = distance * Math.sin(headingRad);
  const dy = distance * Math.cos(headingRad);
  
  return {
    x: lastKnownPosition.x + dx,
    y: lastKnownPosition.y + dy
  };
};

// 활주로 점유 시간 추적
export const updateRunwayOccupancy = (
  prevOccupancyTime: number,
  isOnRunway: boolean,
  deltaTime: number
): number => {
  if (isOnRunway) {
    // 활주로에 있음 - 시간 누적
    return prevOccupancyTime + deltaTime;
  }
  // 활주로 벗어남
  return 0;
};

// 공간 그리드 인덱스 키 생성 (평면좌표 기반)
export const getGridKeyPlane = (position: PlaneCoordinate, gridSize: number = 500): string => {
  const gridX = Math.floor(position.x / gridSize);
  const gridY = Math.floor(position.y / gridSize);
  return `${gridX},${gridY}`;
};

// 인접 그리드 키 반환 (평면좌표 기반)
export const getNearbyGridKeysPlane = (position: PlaneCoordinate, gridSize: number = 500): string[] => {
  const gridX = Math.floor(position.x / gridSize);
  const gridY = Math.floor(position.y / gridSize);
  const keys: string[] = [];
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      keys.push(`${gridX + dx},${gridY + dy}`);
    }
  }
  
  return keys;
};

// 평면좌표 캐시가 포함된 항공기 타입
export interface TrackedAircraftWithPlane extends TrackedAircraft {
  planePosition?: PlaneCoordinate;
}

// 항공기 위치를 평면좌표로 변환하고 캐시
export const getAircraftPlanePosition = (
  aircraft: TrackedAircraftWithPlane,
  coordSystem: CoordinateSystem
): PlaneCoordinate => {
  if (!aircraft.planePosition) {
    aircraft.planePosition = coordSystem.toPlane(aircraft.latitude, aircraft.longitude);
  }
  return aircraft.planePosition;
};

// 항공기 간 거리 계산 (평면좌표 사용)
export const calculateAircraftDistance = (
  aircraft1: TrackedAircraftWithPlane,
  aircraft2: TrackedAircraftWithPlane,
  coordSystem: CoordinateSystem
): number => {
  const pos1 = getAircraftPlanePosition(aircraft1, coordSystem);
  const pos2 = getAircraftPlanePosition(aircraft2, coordSystem);
  return coordSystem.distance(pos1, pos2);
};

// 항공기에서 점까지의 거리 (평면좌표 사용)
export const calculateDistanceToPoint = (
  aircraft: TrackedAircraftWithPlane,
  point: PlaneCoordinate,
  coordSystem: CoordinateSystem
): number => {
  const aircraftPos = getAircraftPlanePosition(aircraft, coordSystem);
  return coordSystem.distance(aircraftPos, point);
};

// 기존 WGS-84 기반 함수들 (하위 호환성)
export const calculateDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};