import { CoordinateSystem, LocalTangentPlane, PlaneCoordinate } from '../coordinates';
import { AirportConfig } from '../airport';
import { DetectionResult } from '../../types/rwsl';
import { TrackedAircraftWithPlane } from '../../utils/coordinateHelpers';

export class RELDetector {
  private coordinateSystem: CoordinateSystem;
  private airport: AirportConfig;
  private runwayHeadings: Map<string, number>;

  constructor(coordinateSystem: CoordinateSystem, airport: AirportConfig) {
    this.coordinateSystem = coordinateSystem;
    this.airport = airport;
    this.runwayHeadings = new Map();
    
    // 활주로 방향 계산 및 캐시
    this.calculateRunwayHeadings();
  }

  private calculateRunwayHeadings(): void {
    this.airport.runways.forEach(runway => {
      Object.entries(runway.directions).forEach(([dirId, direction]) => {
        // 활주로 방향 이름에서 heading 추출 (예: "14L" -> 140도)
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
    lightPosition: PlaneCoordinate,
    aircraft: TrackedAircraftWithPlane[]
  ): DetectionResult {
    if (!this.airport.rwsl.rel.enabled) {
      return { detected: false };
    }

    const config = this.airport.rwsl.rel;
    const runwayHeading = this.runwayHeadings.get(runwayDirection);
    
    if (runwayHeading === undefined) {
      return { detected: false };
    }

    // 활주로 heading을 라디안으로 변환
    const centerBearing = runwayHeading * Math.PI / 180;
    const sectorAngle = config.sectorAngle * Math.PI / 180;

    const detectedAircraft: string[] = [];
    let minDistance = Infinity;

    // LocalTangentPlane의 isInSector 메서드 사용
    const ltpSystem = this.coordinateSystem as LocalTangentPlane;

    aircraft.forEach(ac => {
      if (!ac.planePosition || ac.altitude > 50) { // 50ft 이상은 제외
        return;
      }

      // 부채꼴 영역 내에 있는지 확인
      const inSector = ltpSystem.isInSector(
        ac.planePosition,
        lightPosition,
        centerBearing,
        sectorAngle,
        config.detectionRange.inner,
        config.detectionRange.outer
      );

      if (inSector) {
        detectedAircraft.push(ac.callsign);
        const distance = this.coordinateSystem.distance(lightPosition, ac.planePosition);
        minDistance = Math.min(minDistance, distance);
      }
    });

    if (detectedAircraft.length > 0) {
      return {
        detected: true,
        aircraft: detectedAircraft,
        distance: minDistance
      };
    }

    return { detected: false };
  }

  // 특정 항공기가 REL 영역에 있는지 확인
  isAircraftInRELZone(
    aircraft: TrackedAircraftWithPlane,
    runwayDirection: string,
    lightPosition: PlaneCoordinate
  ): boolean {
    const result = this.detect(runwayDirection, lightPosition, [aircraft]);
    return result.detected;
  }

  // REL 활성화 조건 확인 (확장 가능)
  checkActivationConditions(
    runwayDirection: string,
    aircraft: TrackedAircraftWithPlane[]
  ): boolean {
    // 추가 조건 체크 가능
    // 예: 활주로에 이미 항공기가 있는지, 이륙 허가가 있는지 등
    
    // 기본적으로는 감지된 항공기가 있으면 활성화
    return aircraft.length > 0;
  }
}