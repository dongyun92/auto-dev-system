import { CoordinateSystem as ICoordinateSystem, PlaneCoordinate, GeographicCoordinate } from '../../types/coordinates';

export abstract class CoordinateSystem implements ICoordinateSystem {
  protected origin: GeographicCoordinate;

  constructor(origin: GeographicCoordinate) {
    this.origin = origin;
  }

  abstract toPlane(lat: number, lng: number): PlaneCoordinate;
  abstract toWGS84(x: number, y: number): GeographicCoordinate;

  distance(p1: PlaneCoordinate, p2: PlaneCoordinate): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  bearing(from: PlaneCoordinate, to: PlaneCoordinate): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.atan2(dx, dy); // 북쪽을 기준으로 시계방향 라디안
  }
}