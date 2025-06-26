/**
 * 활주로 점유 감지 시스템
 * FAA RWSL 표준 구현
 */

import { TrackedAircraft } from '../types';
import { RKSS_AIRPORT_DATA, Runway } from '../data/airportData';

export interface RunwayOccupancy {
  runway: string;
  occupied: boolean;
  aircraft: TrackedAircraft[];
  lastUpdate: number;
}

export class RunwayOccupancyDetector {
  private occupancyMap: Map<string, RunwayOccupancy> = new Map();
  
  constructor() {
    // 각 활주로에 대한 초기 상태 생성
    RKSS_AIRPORT_DATA.runways.forEach(runway => {
      this.occupancyMap.set(runway.id, {
        runway: runway.id,
        occupied: false,
        aircraft: [],
        lastUpdate: Date.now()
      });
    });
  }
  
  /**
   * 항공기 위치 업데이트 및 활주로 점유 감지
   */
  update(aircraft: TrackedAircraft[]): Map<string, RunwayOccupancy> {
    const now = Date.now();
    
    // 각 활주로별로 점유 상태 확인
    RKSS_AIRPORT_DATA.runways.forEach(runway => {
      const occupyingAircraft = this.detectRunwayOccupancy(runway, aircraft);
      
      this.occupancyMap.set(runway.id, {
        runway: runway.id,
        occupied: occupyingAircraft.length > 0,
        aircraft: occupyingAircraft,
        lastUpdate: now
      });
    });
    
    return this.occupancyMap;
  }
  
  /**
   * 특정 활주로의 점유 항공기 감지
   */
  private detectRunwayOccupancy(runway: Runway, aircraft: TrackedAircraft[]): TrackedAircraft[] {
    const occupyingAircraft: TrackedAircraft[] = [];
    
    aircraft.forEach(ac => {
      if (this.isOnRunway(ac, runway)) {
        occupyingAircraft.push(ac);
      }
    });
    
    return occupyingAircraft;
  }
  
  /**
   * 항공기가 활주로 상에 있는지 확인
   */
  private isOnRunway(aircraft: TrackedAircraft, runway: Runway): boolean {
    // 고도 확인 (지상에 있어야 함)
    if (aircraft.altitude > 50) return false;
    
    // 활주로 양 끝 임계값
    const threshold1 = Object.values(runway.thresholds)[0];
    const threshold2 = Object.values(runway.thresholds)[1];
    
    // 활주로 중심선에서의 수직 거리 계산
    const distanceFromCenterline = this.calculateDistanceFromLine(
      aircraft,
      threshold1,
      threshold2
    );
    
    // 활주로 폭의 절반 + 여유 (10m)
    const maxDistance = (runway.width / 2) + 10;
    
    if (distanceFromCenterline > maxDistance) return false;
    
    // 활주로 길이 방향 위치 확인
    const projection = this.projectPointOnLine(
      aircraft,
      threshold1,
      threshold2
    );
    
    // 활주로 범위 내에 있는지 확인 (약간의 여유 포함)
    return projection >= -0.05 && projection <= 1.05;
  }
  
  /**
   * 점과 직선 사이의 거리 계산 (미터)
   */
  private calculateDistanceFromLine(
    point: { latitude: number; longitude: number },
    lineStart: { lat: number; lng: number },
    lineEnd: { lat: number; lng: number }
  ): number {
    // 위도/경도를 미터 단위로 변환
    const lat1m = 111000; // 1도당 약 111km
    const lng1m = 111000 * Math.cos(point.latitude * Math.PI / 180);
    
    // 점의 좌표
    const px = point.longitude * lng1m;
    const py = point.latitude * lat1m;
    
    // 직선의 시작점과 끝점
    const x1 = lineStart.lng * lng1m;
    const y1 = lineStart.lat * lat1m;
    const x2 = lineEnd.lng * lng1m;
    const y2 = lineEnd.lat * lat1m;
    
    // 직선의 방향 벡터
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    // 점에서 직선까지의 수직 거리
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  }
  
  /**
   * 점을 직선에 투영한 위치 계산 (0-1 범위)
   */
  private projectPointOnLine(
    point: { latitude: number; longitude: number },
    lineStart: { lat: number; lng: number },
    lineEnd: { lat: number; lng: number }
  ): number {
    const dx = lineEnd.lng - lineStart.lng;
    const dy = lineEnd.lat - lineStart.lat;
    const dpx = point.longitude - lineStart.lng;
    const dpy = point.latitude - lineStart.lat;
    
    return (dpx * dx + dpy * dy) / (dx * dx + dy * dy);
  }
  
  /**
   * 특정 활주로가 점유되어 있는지 확인
   */
  isRunwayOccupied(runwayId: string): boolean {
    return this.occupancyMap.get(runwayId)?.occupied || false;
  }
  
  /**
   * 특정 활주로의 점유 항공기 목록
   */
  getOccupyingAircraft(runwayId: string): TrackedAircraft[] {
    return this.occupancyMap.get(runwayId)?.aircraft || [];
  }
  
  /**
   * 활주로별 점유 상태 요약
   */
  getOccupancySummary(): { [key: string]: boolean } {
    const summary: { [key: string]: boolean } = {};
    
    this.occupancyMap.forEach((occupancy, runwayId) => {
      summary[runwayId] = occupancy.occupied;
    });
    
    return summary;
  }
}