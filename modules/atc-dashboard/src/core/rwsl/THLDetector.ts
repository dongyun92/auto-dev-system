import { CoordinateSystem, LocalTangentPlane, PlaneCoordinate } from '../coordinates';
import { AirportConfig } from '../airport';
import { DetectionResult } from '../../types/rwsl';
import { TrackedAircraftWithPlane } from '../../utils/coordinateHelpers';

export class THLDetector {
  private coordinateSystem: CoordinateSystem;
  private airport: AirportConfig;
  private runwayThresholds: Map<string, PlaneCoordinate>;
  private runwayHeadings: Map<string, number>;

  constructor(coordinateSystem: CoordinateSystem, airport: AirportConfig) {
    this.coordinateSystem = coordinateSystem;
    this.airport = airport;
    this.runwayThresholds = new Map();
    this.runwayHeadings = new Map();
    
    // 활주로 임계값 및 방향 계산
    this.initializeRunwayData();
  }

  private initializeRunwayData(): void {
    this.airport.runways.forEach(runway => {
      Object.entries(runway.directions).forEach(([dirId, direction]) => {
        // 임계값 평면좌표 변환
        const thresholdPlane = this.coordinateSystem.toPlane(
          direction.threshold.lat,
          direction.threshold.lng
        );
        this.runwayThresholds.set(dirId, thresholdPlane);

        // 활주로 방향 계산
        const match = dirId.match(/^(\d+)/);
        if (match) {
          const heading = parseInt(match[1]) * 10;
          this.runwayHeadings.set(dirId, heading);
        }
      });
    });
  }

  detect(
    runwayDirection: string,
    aircraft: TrackedAircraftWithPlane[]
  ): DetectionResult {
    if (!this.airport.rwsl.thl.enabled) {
      return { detected: false };
    }

    const config = this.airport.rwsl.thl;
    const threshold = this.runwayThresholds.get(runwayDirection);
    const heading = this.runwayHeadings.get(runwayDirection);

    if (!threshold || heading === undefined) {
      return { detected: false };
    }

    const headingRad = heading * Math.PI / 180;
    const detectedAircraft: string[] = [];
    let minTimeToConflict = Infinity;

    // LocalTangentPlane의 isInRectangle 메서드 사용
    const ltpSystem = this.coordinateSystem as LocalTangentPlane;

    // THL 감지 영역 중심 (임계값으로부터 전방)
    const detectionCenter = ltpSystem.translate(
      threshold,
      headingRad,
      300  // ICAO standard takeoff position distance
    );

    // 활주로에 있는 항공기 확인
    const runwayAircraft = aircraft.filter(ac => 
      ac.planePosition && 
      ac.assignedRunway?.includes(runwayDirection.replace(/[LR]$/, '')) &&
      ac.flightPhase === 'TAKEOFF'
    );

    // 접근 중인 항공기 확인
    aircraft.forEach(ac => {
      if (!ac.planePosition || ac.altitude > 200) { // 200ft 이상은 제외
        return;
      }

      // 직사각형 영역 내에 있는지 확인
      const inArea = ltpSystem.isInRectangle(
        ac.planePosition,
        detectionCenter,
        config.detectionArea.length,
        config.detectionArea.width,
        headingRad
      );

      if (inArea && (ac.flightPhase === 'LANDING' || ac.flightPhase === 'APPROACH')) {
        // 활주로에 다른 항공기가 있으면 THL 활성화
        if (runwayAircraft.length > 0) {
          detectedAircraft.push(ac.callsign);
          
          // 충돌 예상 시간 계산 (간단한 버전)
          const distance = this.coordinateSystem.distance(threshold, ac.planePosition);
          const approachSpeed = ac.speed * 0.514; // kt to m/s
          if (approachSpeed > 0) {
            const timeToThreshold = distance / approachSpeed;
            minTimeToConflict = Math.min(minTimeToConflict, timeToThreshold);
          }
        }
      }
    });

    if (detectedAircraft.length > 0) {
      return {
        detected: true,
        aircraft: detectedAircraft,
        timeToConflict: minTimeToConflict
      };
    }

    return { detected: false };
  }

  // 활주로에 항공기가 있는지 확인
  isRunwayOccupied(
    runwayDirection: string,
    aircraft: TrackedAircraftWithPlane[]
  ): boolean {
    const threshold = this.runwayThresholds.get(runwayDirection);
    if (!threshold) return false;

    // 활주로 전체 길이 확인 (임계값으로부터 2000m)
    return aircraft.some(ac => {
      if (!ac.planePosition || ac.altitude > 50) return false;
      
      const distance = this.coordinateSystem.distance(threshold, ac.planePosition);
      return distance < 2000 && ac.assignedRunway?.includes(runwayDirection.replace(/[LR]$/, ''));
    });
  }

  // THL 활성화 조건 확인
  checkActivationConditions(
    runwayDirection: string,
    approachingAircraft: TrackedAircraftWithPlane[],
    runwayAircraft: TrackedAircraftWithPlane[]
  ): boolean {
    // 활주로에 항공기가 있고, 접근 중인 항공기가 있으면 활성화
    return runwayAircraft.length > 0 && approachingAircraft.length > 0;
  }
}