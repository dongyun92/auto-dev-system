import { CoordinateSystem, LocalTangentPlane, PlaneCoordinate } from '../coordinates';
import { AirportConfig, AirportLoader } from '../airport';
import { TrackedAircraft } from '../../types';
import { RWSLState, LightState, RWSLConflict, DetectionResult } from '../../types/rwsl';
import { TrackedAircraftWithPlane, getAircraftPlanePosition } from '../../utils/coordinateHelpers';
import { RELDetector } from './RELDetector';
import { THLDetector } from './THLDetector';

export class RWSLEngine {
  private airport: AirportConfig;
  private coordinateSystem: CoordinateSystem;
  private relDetector: RELDetector;
  private thlDetector: THLDetector;
  private rwslState: RWSLState;
  private aircraftCache: Map<string, TrackedAircraftWithPlane>;

  constructor(airport: AirportConfig) {
    this.airport = airport;
    this.coordinateSystem = new LocalTangentPlane(airport.referencePoint);
    this.relDetector = new RELDetector(this.coordinateSystem, airport);
    this.thlDetector = new THLDetector(this.coordinateSystem, airport);
    this.aircraftCache = new Map();
    
    this.rwslState = {
      rel: new Map(),
      thl: new Map(),
      conflicts: [],
      lastUpdate: Date.now(),
      systemStatus: 'ONLINE'
    };

    // 초기 등화 상태 설정
    this.initializeLights();
  }

  // 등화 초기화
  private initializeLights(): void {
    // REL 등화 초기화
    Object.entries(this.airport.rwsl.lights.rel).forEach(([runwayDir, lights]) => {
      const runwayConfig = this.findRunwayDirection(runwayDir);
      if (!runwayConfig) return;

      const thresholdPlane = this.coordinateSystem.toPlane(
        runwayConfig.threshold.lat,
        runwayConfig.threshold.lng
      );

      lights.forEach(light => {
        const position: PlaneCoordinate = {
          x: thresholdPlane.x + light.offset.x,
          y: thresholdPlane.y + light.offset.y
        };

        this.rwslState.rel.set(light.id, {
          id: light.id,
          type: 'REL',
          active: false,
          position,
          runwayDirection: runwayDir
        });
      });
    });

    // THL 등화 초기화
    Object.entries(this.airport.rwsl.lights.thl).forEach(([runwayDir, lights]) => {
      const runwayConfig = this.findRunwayDirection(runwayDir);
      if (!runwayConfig) return;

      const thresholdPlane = this.coordinateSystem.toPlane(
        runwayConfig.threshold.lat,
        runwayConfig.threshold.lng
      );

      lights.forEach(light => {
        const position: PlaneCoordinate = {
          x: thresholdPlane.x + light.offset.x,
          y: thresholdPlane.y + light.offset.y
        };

        this.rwslState.thl.set(light.id, {
          id: light.id,
          type: 'THL',
          active: false,
          position,
          runwayDirection: runwayDir
        });
      });
    });
  }

  // 활주로 방향 찾기
  private findRunwayDirection(directionId: string): any {
    for (const runway of this.airport.runways) {
      if (runway.directions[directionId]) {
        return runway.directions[directionId];
      }
    }
    return null;
  }

  // 항공기 위치 업데이트
  updateAircraft(aircraft: TrackedAircraft[]): void {
    // 캐시 업데이트
    const currentAircraft = new Set<string>();
    
    aircraft.forEach(ac => {
      const cachedAircraft = this.aircraftCache.get(ac.callsign) || { ...ac };
      
      // 평면좌표 계산 및 캐시
      cachedAircraft.planePosition = this.coordinateSystem.toPlane(ac.latitude, ac.longitude);
      
      // 기타 속성 업데이트
      Object.assign(cachedAircraft, ac);
      
      this.aircraftCache.set(ac.callsign, cachedAircraft as TrackedAircraftWithPlane);
      currentAircraft.add(ac.callsign);
    });

    // 사라진 항공기 제거
    Array.from(this.aircraftCache.keys()).forEach(callsign => {
      if (!currentAircraft.has(callsign)) {
        this.aircraftCache.delete(callsign);
      }
    });
  }

  // RWSL 상태 계산
  calculateRWSLState(): RWSLState {
    const aircraftList = Array.from(this.aircraftCache.values());
    
    // REL 검사
    this.rwslState.rel.forEach((light, lightId) => {
      const detection = this.relDetector.detect(
        light.runwayDirection,
        light.position,
        aircraftList
      );
      
      this.updateLightState(light, detection);
    });

    // THL 검사
    this.rwslState.thl.forEach((light, lightId) => {
      const detection = this.thlDetector.detect(
        light.runwayDirection,
        aircraftList
      );
      
      this.updateLightState(light, detection);
    });

    // 충돌 감지
    this.detectConflicts(aircraftList);

    this.rwslState.lastUpdate = Date.now();
    return this.rwslState;
  }

  // 등화 상태 업데이트
  private updateLightState(light: LightState, detection: DetectionResult): void {
    const shouldActivate = detection.detected;
    
    if (shouldActivate && !light.active) {
      // 활성화
      light.active = true;
      light.activatedAt = Date.now();
      light.reason = detection.aircraft ? 
        `Aircraft detected: ${detection.aircraft.join(', ')}` : 
        'Aircraft in detection zone';
    } else if (!shouldActivate && light.active) {
      // 비활성화
      light.active = false;
      light.deactivatedAt = Date.now();
      light.reason = undefined;
    }
  }

  // 충돌 감지
  private detectConflicts(aircraft: TrackedAircraftWithPlane[]): void {
    this.rwslState.conflicts = [];

    // 활주로별로 항공기 그룹화
    const runwayAircraft = new Map<string, TrackedAircraftWithPlane[]>();
    
    aircraft.forEach(ac => {
      if (ac.assignedRunway) {
        const list = runwayAircraft.get(ac.assignedRunway) || [];
        list.push(ac);
        runwayAircraft.set(ac.assignedRunway, list);
      }
    });

    // 각 활주로에서 충돌 검사
    runwayAircraft.forEach((acList, runway) => {
      if (acList.length >= 2) {
        // 간단한 충돌 검사 로직 (확장 필요)
        for (let i = 0; i < acList.length - 1; i++) {
          for (let j = i + 1; j < acList.length; j++) {
            const ac1 = acList[i];
            const ac2 = acList[j];
            
            const distance = this.coordinateSystem.distance(
              ac1.planePosition!,
              ac2.planePosition!
            );

            if (distance < 500) { // 500미터 이내
              this.rwslState.conflicts.push({
                id: `conflict-${Date.now()}-${i}-${j}`,
                type: 'RUNWAY_INCURSION',
                severity: distance < 200 ? 'CRITICAL' : 'HIGH',
                involvedAircraft: [ac1.callsign, ac2.callsign],
                runway,
                position: ac1.planePosition!,
                timestamp: Date.now()
              });
            }
          }
        }
      }
    });
  }

  // 특정 항공기의 REL 체크
  checkREL(runway: string, aircraft: TrackedAircraftWithPlane): boolean {
    const lights = Array.from(this.rwslState.rel.values())
      .filter(light => light.runwayDirection === runway);
    
    for (const light of lights) {
      const detection = this.relDetector.detect(
        runway,
        light.position,
        [aircraft]
      );
      
      if (detection.detected) {
        return true;
      }
    }
    
    return false;
  }

  // 특정 활주로의 THL 체크
  checkTHL(runway: string, aircraft: TrackedAircraftWithPlane[]): boolean {
    const detection = this.thlDetector.detect(runway, aircraft);
    return detection.detected;
  }

  // 좌표계 getter
  getCoordinateSystem(): CoordinateSystem {
    return this.coordinateSystem;
  }

  // 현재 상태 getter
  getState(): RWSLState {
    return this.rwslState;
  }

  // 시스템 리셋
  reset(): void {
    this.aircraftCache.clear();
    this.rwslState.rel.forEach(light => {
      light.active = false;
      light.reason = undefined;
    });
    this.rwslState.thl.forEach(light => {
      light.active = false;
      light.reason = undefined;
    });
    this.rwslState.conflicts = [];
  }
}