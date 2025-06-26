import { CoordinateSystem } from './CoordinateSystem';
import { PlaneCoordinate, GeographicCoordinate } from '../../types/coordinates';

export class LocalTangentPlane extends CoordinateSystem {
  private cosLat: number;
  private readonly EARTH_RADIUS = 6371000; // 미터 단위

  constructor(origin: GeographicCoordinate) {
    super(origin);
    this.cosLat = Math.cos(origin.lat * Math.PI / 180);
  }

  toPlane(lat: number, lng: number): PlaneCoordinate {
    const dLat = (lat - this.origin.lat) * Math.PI / 180;
    const dLng = (lng - this.origin.lng) * Math.PI / 180;
    
    const x = dLng * this.cosLat * this.EARTH_RADIUS;  // 동쪽 방향 (m)
    const y = dLat * this.EARTH_RADIUS;                 // 북쪽 방향 (m)
    
    return { x, y };
  }

  toWGS84(x: number, y: number): GeographicCoordinate {
    const lat = this.origin.lat + (y / this.EARTH_RADIUS) * 180 / Math.PI;
    const lng = this.origin.lng + (x / (this.EARTH_RADIUS * this.cosLat)) * 180 / Math.PI;
    
    return { lat, lng };
  }

  // 평면좌표에서 두 점 사이의 각도 계산 (도 단위)
  bearingDegrees(from: PlaneCoordinate, to: PlaneCoordinate): number {
    const radians = this.bearing(from, to);
    const degrees = radians * 180 / Math.PI;
    return (degrees + 360) % 360;
  }

  // 한 점에서 특정 방향과 거리로 이동한 위치 계산
  translate(point: PlaneCoordinate, bearing: number, distance: number): PlaneCoordinate {
    const x = point.x + distance * Math.sin(bearing);
    const y = point.y + distance * Math.cos(bearing);
    return { x, y };
  }

  // 선분과 점 사이의 최단 거리
  distanceToLine(point: PlaneCoordinate, lineStart: PlaneCoordinate, lineEnd: PlaneCoordinate): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  // 부채꼴 영역 내에 점이 있는지 확인
  isInSector(point: PlaneCoordinate, center: PlaneCoordinate, centerBearing: number, sectorAngle: number, innerRadius: number, outerRadius: number): boolean {
    const dist = this.distance(center, point);
    
    // 거리 확인
    if (dist < innerRadius || dist > outerRadius) {
      return false;
    }

    // 각도 확인
    const pointBearing = this.bearing(center, point);
    let angleDiff = Math.abs(pointBearing - centerBearing);
    
    // 각도 차이를 -π ~ π 범위로 정규화
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff;
    }

    return angleDiff <= sectorAngle / 2;
  }

  // 직사각형 영역 내에 점이 있는지 확인
  isInRectangle(point: PlaneCoordinate, rectCenter: PlaneCoordinate, length: number, width: number, heading: number): boolean {
    // 직사각형 중심에서 점까지의 벡터
    const dx = point.x - rectCenter.x;
    const dy = point.y - rectCenter.y;

    // heading에 대한 회전 변환 (역회전)
    const cos = Math.cos(-heading);
    const sin = Math.sin(-heading);
    
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // 직사각형 범위 확인
    return Math.abs(localX) <= width / 2 && Math.abs(localY) <= length / 2;
  }
}