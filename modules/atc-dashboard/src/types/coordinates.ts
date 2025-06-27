export interface PlaneCoordinate {
  x: number;  // 동쪽 방향 (미터)
  y: number;  // 북쪽 방향 (미터)
  z?: number; // 고도 (미터) - 선택적
}

export interface GeographicCoordinate {
  lat: number;
  lng: number;
}

export interface CoordinateSystem {
  // WGS-84 → 평면좌표 변환
  toPlane(lat: number, lng: number): PlaneCoordinate;
  // 평면좌표 → WGS-84 변환
  toWGS84(x: number, y: number): GeographicCoordinate;
  // 거리 계산 (미터 단위)
  distance(p1: PlaneCoordinate, p2: PlaneCoordinate): number;
  // 방향 계산 (라디안)
  bearing(from: PlaneCoordinate, to: PlaneCoordinate): number;
}

export enum ProjectionType {
  UTM = 'UTM',
  TM = 'TM',
  LOCAL_TANGENT = 'LOCAL_TANGENT'
}