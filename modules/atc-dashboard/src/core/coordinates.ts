/**
 * 좌표계 변환 시스템
 * Local Tangent Plane 좌표계 구현
 */

import { 
  PlaneCoordinate, 
  GeographicCoordinate, 
  CoordinateSystem as ICoordinateSystem 
} from '../types/coordinates';

export class CoordinateSystem implements ICoordinateSystem {
  private originLat: number;
  private originLng: number;
  private cosLat: number;
  private metersPerDegreeLat: number;
  private metersPerDegreeLng: number;

  constructor(originLat: number, originLng: number) {
    this.originLat = originLat;
    this.originLng = originLng;
    
    // 사전 계산된 값들
    this.cosLat = Math.cos(originLat * Math.PI / 180);
    
    // WGS84 타원체 파라미터
    const a = 6378137.0; // 장반경 (미터)
    const f = 1 / 298.257223563; // 편평률
    const e2 = 2 * f - f * f; // 제1이심률의 제곱
    
    // 위도 1도당 미터
    const latRad = originLat * Math.PI / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    const M = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(latRad) * Math.sin(latRad), 1.5);
    
    this.metersPerDegreeLat = M * Math.PI / 180;
    this.metersPerDegreeLng = N * this.cosLat * Math.PI / 180;
  }

  /**
   * WGS84 좌표를 평면 좌표로 변환
   */
  toPlane(lat: number, lng: number): PlaneCoordinate {
    const dLat = lat - this.originLat;
    const dLng = lng - this.originLng;
    
    return {
      x: dLng * this.metersPerDegreeLng,
      y: dLat * this.metersPerDegreeLat,
      z: 0
    };
  }

  /**
   * 평면 좌표를 WGS84 좌표로 변환
   */
  toWGS84(x: number, y: number): GeographicCoordinate {
    const dLng = x / this.metersPerDegreeLng;
    const dLat = y / this.metersPerDegreeLat;
    
    return {
      lat: this.originLat + dLat,
      lng: this.originLng + dLng
    };
  }

  /**
   * 두 평면 좌표 사이의 거리 계산 (미터)
   */
  distance(p1: PlaneCoordinate, p2: PlaneCoordinate): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = (p2.z || 0) - (p1.z || 0);
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 두 평면 좌표 사이의 방위각 계산 (라디안)
   */
  bearing(from: PlaneCoordinate, to: PlaneCoordinate): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    return Math.atan2(dx, dy);
  }

  /**
   * 방위각을 도 단위로 변환 (0-360)
   */
  bearingDegrees(from: PlaneCoordinate, to: PlaneCoordinate): number {
    const rad = this.bearing(from, to);
    const deg = rad * 180 / Math.PI;
    return (deg + 360) % 360;
  }

  /**
   * 특정 지점에서 거리와 방향으로 새 위치 계산
   */
  projectPoint(from: PlaneCoordinate, distance: number, bearingRad: number): PlaneCoordinate {
    return {
      x: from.x + distance * Math.sin(bearingRad),
      y: from.y + distance * Math.cos(bearingRad),
      z: from.z || 0
    };
  }

  /**
   * 원점 정보 반환
   */
  getOrigin(): GeographicCoordinate {
    return {
      lat: this.originLat,
      lng: this.originLng
    };
  }
}