import { RWSLEngine } from '../RWSLEngine';
import { AirportConfig } from '../../../types/airport';
import { TrackedAircraft } from '../../../types';
import { ProjectionType } from '../../../types/coordinates';

describe('RWSLEngine', () => {
  let engine: RWSLEngine;
  let mockAirportConfig: AirportConfig;

  beforeEach(() => {
    // 테스트용 공항 설정
    mockAirportConfig = {
      id: 'TEST',
      name: 'Test Airport',
      referencePoint: { lat: 37.5592, lng: 126.7912 },
      projection: ProjectionType.LOCAL_TANGENT,
      runways: [
        {
          id: '09/27',
          name: '09/27',
          width: 45,
          directions: {
            '09': {
              id: '09',
              threshold: { lat: 37.5592, lng: 126.7812 }
            },
            '27': {
              id: '27',
              threshold: { lat: 37.5592, lng: 126.8012 }
            }
          }
        }
      ],
      rwsl: {
        rel: {
          enabled: true,
          detectionRange: { inner: 50, outer: 200 },
          sectorAngle: 90,
          activationDelay: 2000
        },
        thl: {
          enabled: true,
          detectionArea: { length: 100, width: 60 },
          activationDelay: 1500
        },
        lights: {
          rel: {
            '09': [
              { id: 'REL-09-1', offset: { x: 0, y: 50 } }
            ]
          },
          thl: {
            '09': [
              { id: 'THL-09-1', offset: { x: 0, y: 50 } }
            ]
          }
        }
      }
    };

    engine = new RWSLEngine(mockAirportConfig);
  });

  describe('초기화', () => {
    it('엔진이 올바르게 초기화되어야 함', () => {
      expect(engine).toBeDefined();
      expect(engine.getState()).toBeDefined();
      expect(engine.getState().systemStatus).toBe('ONLINE');
    });

    it('등화가 초기화되어야 함', () => {
      const state = engine.getState();
      expect(state.rel.size).toBeGreaterThan(0);
      expect(state.thl.size).toBeGreaterThan(0);
    });
  });

  describe('항공기 업데이트', () => {
    it('항공기 위치가 업데이트되어야 함', () => {
      const aircraft: TrackedAircraft[] = [
        {
          id: 1,
          callsign: 'TEST001',
          latitude: 37.5592,
          longitude: 126.7850,
          altitude: 0,
          speed: 140,
          heading: 90,
          isEmergency: false,
          isActive: true,
          lastRadarContact: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          flightPhase: 'TAKEOFF',
          assignedRunway: '09'
        }
      ];

      engine.updateAircraft(aircraft);
      const state = engine.calculateRWSLState();
      
      expect(state.lastUpdate).toBeGreaterThan(0);
    });
  });

  describe('REL 감지', () => {
    it('부채꼴 영역 내 항공기를 감지해야 함', () => {
      const aircraft: TrackedAircraft[] = [
        {
          id: 1,
          callsign: 'TEST001',
          latitude: 37.5597,  // 임계값에서 북쪽으로 약 55m
          longitude: 126.7812, // 임계값과 동일한 경도
          altitude: 10,
          speed: 140,
          heading: 90,
          isEmergency: false,
          isActive: true,
          lastRadarContact: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          flightPhase: 'TAKEOFF',
          assignedRunway: '09'
        }
      ];

      engine.updateAircraft(aircraft);
      const state = engine.calculateRWSLState();
      
      // REL 등화 중 하나가 활성화되어야 함
      const activeLights = Array.from(state.rel.values()).filter(light => light.active);
      expect(activeLights.length).toBeGreaterThan(0);
    });
  });

  describe('THL 감지', () => {
    it('활주로에 항공기가 있고 접근 항공기가 있을 때 활성화되어야 함', () => {
      const aircraft: TrackedAircraft[] = [
        {
          id: 1,
          callsign: 'RUNWAY001',
          latitude: 37.5592,
          longitude: 126.7850,
          altitude: 0,
          speed: 140,
          heading: 90,
          isEmergency: false,
          isActive: true,
          lastRadarContact: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          flightPhase: 'TAKEOFF',
          assignedRunway: '09'
        },
        {
          id: 2,
          callsign: 'APPROACH001',
          latitude: 37.5592,
          longitude: 126.7820,
          altitude: 100,
          speed: 120,
          heading: 90,
          isEmergency: false,
          isActive: true,
          lastRadarContact: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          flightPhase: 'LANDING',
          assignedRunway: '09'
        }
      ];

      engine.updateAircraft(aircraft);
      const state = engine.calculateRWSLState();
      
      // THL 등화가 활성화되어야 함
      const activeLights = Array.from(state.thl.values()).filter(light => light.active);
      expect(activeLights.length).toBeGreaterThan(0);
    });
  });

  describe('좌표 변환', () => {
    it('WGS-84와 평면좌표 간 변환이 올바르게 동작해야 함', () => {
      const coordSystem = engine.getCoordinateSystem();
      
      // 공항 기준점
      const refPoint = mockAirportConfig.referencePoint;
      const planeCoord = coordSystem.toPlane(refPoint.lat, refPoint.lng);
      
      // 기준점은 원점이어야 함
      expect(Math.abs(planeCoord.x)).toBeLessThan(0.001);
      expect(Math.abs(planeCoord.y)).toBeLessThan(0.001);
      
      // 역변환 테스트
      const wgs84 = coordSystem.toWGS84(planeCoord.x, planeCoord.y);
      expect(Math.abs(wgs84.lat - refPoint.lat)).toBeLessThan(0.00001);
      expect(Math.abs(wgs84.lng - refPoint.lng)).toBeLessThan(0.00001);
    });

    it('거리 계산이 올바르게 동작해야 함', () => {
      const coordSystem = engine.getCoordinateSystem();
      
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };
      
      const distance = coordSystem.distance(p1, p2);
      expect(distance).toBe(100);
    });
  });
});