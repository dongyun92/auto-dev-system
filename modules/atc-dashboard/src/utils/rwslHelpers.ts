// RWSL 시스템을 위한 헬퍼 함수들

import { TrackedAircraft } from '../types';

// 가속도 계산 (이전 속도와 현재 속도 기반)
export const calculateAcceleration = (
  currentSpeed: number,
  previousSpeed: number,
  deltaTime: number // 초
): number => {
  if (deltaTime === 0) return 0;
  return (currentSpeed - previousSpeed) / deltaTime;
};

// 두 항공기 간 예상 충돌 시간 계산
export const calculateTimeToConflict = (
  aircraft1: TrackedAircraft,
  aircraft2: TrackedAircraft,
  conflictPoint: { lat: number; lng: number }
): number => {
  // 각 항공기에서 충돌 지점까지의 거리
  const dist1 = calculateDistance(
    aircraft1.latitude, aircraft1.longitude,
    conflictPoint.lat, conflictPoint.lng
  );
  const dist2 = calculateDistance(
    aircraft2.latitude, aircraft2.longitude,
    conflictPoint.lat, conflictPoint.lng
  );
  
  // 속도를 m/s로 변환 (1 kt = 0.514 m/s)
  const speed1 = aircraft1.speed * 0.514;
  const speed2 = aircraft2.speed * 0.514;
  
  if (speed1 === 0 || speed2 === 0) return Infinity;
  
  const time1 = dist1 / speed1;
  const time2 = dist2 / speed2;
  
  // 비슷한 시간에 도착하면 충돌 가능
  return Math.abs(time1 - time2) < 5 ? Math.min(time1, time2) : Infinity;
};

// 활주로 교차점 계산
export const findRunwayIntersection = (
  runway1Start: { lat: number; lng: number },
  runway1End: { lat: number; lng: number },
  runway2Start: { lat: number; lng: number },
  runway2End: { lat: number; lng: number }
): { lat: number; lng: number } | null => {
  // 선분 교차 알고리즘
  const x1 = runway1Start.lng, y1 = runway1Start.lat;
  const x2 = runway1End.lng, y2 = runway1End.lat;
  const x3 = runway2Start.lng, y3 = runway2Start.lat;
  const x4 = runway2End.lng, y4 = runway2End.lat;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0000001) return null; // 평행
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      lng: x1 + t * (x2 - x1),
      lat: y1 + t * (y2 - y1)
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

// 위치 추정 (GPS 손실 시)
export const estimatePosition = (
  lastKnownPosition: { lat: number; lng: number },
  heading: number,
  speed: number,
  elapsedTime: number // 초
): { lat: number; lng: number } => {
  // 이동 거리 (미터)
  const distance = speed * 0.514 * elapsedTime;
  
  // 위경도 변환
  const headingRad = heading * Math.PI / 180;
  const latChange = (distance * Math.cos(headingRad)) / 111000;
  const lngChange = (distance * Math.sin(headingRad)) / (111000 * Math.cos(lastKnownPosition.lat * Math.PI / 180));
  
  return {
    lat: lastKnownPosition.lat + latChange,
    lng: lastKnownPosition.lng + lngChange
  };
};

// 거리 계산 (미터 단위)
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

// 공간 그리드 인덱스 키 생성
export const getGridKey = (lat: number, lng: number, gridSize: number = 500): string => {
  const gridLat = Math.floor(lat * 111000 / gridSize);
  const gridLng = Math.floor(lng * 111000 / gridSize);
  return `${gridLat},${gridLng}`;
};

// 주변 그리드 키 목록 생성
export const getNearbyGridKeys = (lat: number, lng: number, gridSize: number = 500): string[] => {
  const keys: string[] = [];
  const centerKey = getGridKey(lat, lng, gridSize);
  const [centerLat, centerLng] = centerKey.split(',').map(Number);
  
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      keys.push(`${centerLat + dLat},${centerLng + dLng}`);
    }
  }
  
  return keys;
};