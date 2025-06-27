import { RELConfiguration } from '../../types/rwsl';
import rwslLightPositions from '../../data/rwslLightPositions.json';
import { CoordinateSystem } from '../coordinates';

// 김포공항 좌표계 (임시)
const gimpoCoordinateSystem = new CoordinateSystem(37.5587, 126.7905);

// JSON 데이터를 RELConfiguration 형식으로 변환
function convertToRELConfiguration(): RELConfiguration[] {
  const configurations: RELConfiguration[] = [];
  
  console.log('[RWSL] REL 데이터 로드 시작:', {
    hasREL: !!rwslLightPositions.lights.REL,
    hasDeparture: !!rwslLightPositions.lights.REL?.departure,
    hasArrival: !!rwslLightPositions.lights.REL?.arrival,
    departureCount: rwslLightPositions.lights.REL?.departure?.length || 0,
    arrivalCount: rwslLightPositions.lights.REL?.arrival?.length || 0
  });
  
  // Departure RELs
  if (rwslLightPositions.lights.REL?.departure) {
    rwslLightPositions.lights.REL.departure.forEach(rel => {
      const localCoords = gimpoCoordinateSystem.toPlane(rel.position.lat, rel.position.lng);
      configurations.push({
        id: rel.id,
        type: 'REL' as const,
        runway: determineRunway(rel.taxiway),
        taxiway: rel.taxiway,
        position: {
          lat: rel.position.lat,
          lon: rel.position.lng,
          localCoords: localCoords
        },
        purpose: `${determineRunway(rel.taxiway)} 진입`,
        coverageArea: 200,
        direction: 'from_west' as const // 실제 방향은 추후 계산 필요
      });
    });
  }
  
  // Arrival RELs
  if (rwslLightPositions.lights.REL?.arrival) {
    rwslLightPositions.lights.REL.arrival.forEach(rel => {
      const localCoords = gimpoCoordinateSystem.toPlane(rel.position.lat, rel.position.lng);
      configurations.push({
        id: rel.id,
        type: 'REL' as const,
        runway: determineRunway(rel.taxiway),
        taxiway: rel.taxiway,
        position: {
          lat: rel.position.lat,
          lon: rel.position.lng,
          localCoords: localCoords
        },
        purpose: `${determineRunway(rel.taxiway)} 진입`,
        coverageArea: 200,
        direction: 'from_east' as const // 실제 방향은 추후 계산 필요
      });
    });
  }
  
  console.log('[RWSL] REL 구성 완료:', configurations.length, '개');
  if (configurations.length > 0) {
    console.log('[RWSL] 첫 번째 REL 예시:', configurations[0]);
  }
  
  return configurations;
}

// 유도로 이름으로 활주로 결정 (간단한 로직)
function determineRunway(taxiway: string): '14L' | '32R' | '14R' | '32L' {
  // 김포공항 유도로 체계에 따라 매핑
  // A, B, C 계열은 14L/32R (북쪽 활주로)
  // D, E, F, G, W 계열은 14R/32L (남쪽 활주로)
  
  // 서쪽 끝 유도로들 (14L, 14R 방향)
  const westEndTaxiways = ['A', 'A1', 'A2', 'A3', 'D', 'D1', 'D2', 'D3'];
  // 동쪽 끝 유도로들 (32R, 32L 방향)
  const eastEndTaxiways = ['C', 'C1', 'C2', 'C3', 'G', 'G1', 'G2'];
  
  // 북쪽 활주로 (14L/32R)
  const northRunwayTaxiways = ['A', 'A1', 'A2', 'A3', 'A4', 'A5', 'B', 'B1', 'B2', 'B3', 'B4', 'C', 'C1', 'C2', 'C3'];
  // 남쪽 활주로 (14R/32L)
  const southRunwayTaxiways = ['D', 'D1', 'D2', 'D3', 'E', 'E1', 'E2', 'F', 'F1', 'F2', 'G', 'G1', 'G2', 'W', 'W1', 'W2'];
  
  // 유도로 위치에 따라 활주로 방향 결정
  if (northRunwayTaxiways.includes(taxiway)) {
    if (westEndTaxiways.includes(taxiway)) {
      return '14L'; // 서쪽에서 동쪽으로
    } else {
      return '32R'; // 동쪽에서 서쪽으로
    }
  } else if (southRunwayTaxiways.includes(taxiway)) {
    if (westEndTaxiways.includes(taxiway)) {
      return '14R'; // 서쪽에서 동쪽으로
    } else {
      return '32L'; // 동쪽에서 서쪽으로
    }
  }
  
  console.log('[RWSL] 알 수 없는 유도로:', taxiway, '- 기본값 14L 사용');
  return '14L'; // 기본값
}

export const gimpoRELConfigurations: RELConfiguration[] = convertToRELConfiguration();

// 기존 하드코딩된 데이터는 주석 처리
/*
export const gimpoRELConfigurations: RELConfiguration[] = [
  // 14L 방향 진입점 (서쪽)
  { id: "REL_14L_A1", type: 'REL', runway: '14L', taxiway: "A1", position: { lat: 37.571500, lon: 126.780000, localCoords: { x: -1600, y: 100, z: 0 } }, purpose: "14L 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_14L_A2", type: 'REL', runway: '14L', taxiway: "A2", position: { lat: 37.569000, lon: 126.782000, localCoords: { x: -1400, y: 100, z: 0 } }, purpose: "14L 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_14L_A3", type: 'REL', runway: '14L', taxiway: "A3", position: { lat: 37.566500, lon: 126.784000, localCoords: { x: -1200, y: 100, z: 0 } }, purpose: "14L 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_14L_B1", type: 'REL', runway: '14L', taxiway: "B1", position: { lat: 37.564000, lon: 126.786000, localCoords: { x: -1000, y: 10, z: 0 } }, purpose: "14L 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_14L_B2", type: 'REL', runway: '14L', taxiway: "B2", position: { lat: 37.561500, lon: 126.788000, localCoords: { x: -800, y: 10, z: 0 } }, purpose: "14L 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_14L_C1", type: 'REL', runway: '14L', taxiway: "C1", position: { lat: 37.559000, lon: 126.790000, localCoords: { x: -600, y: 10, z: 0 } }, purpose: "14L 진입", coverageArea: 200, direction: "from_east" },
  
  // 32R 방향 진입점 (동쪽)
  { id: "REL_32R_A4", type: 'REL', runway: '32R', taxiway: "A4", position: { lat: 37.556500, lon: 126.792000, localCoords: { x: 600, y: 100, z: 0 } }, purpose: "32R 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_32R_A5", type: 'REL', runway: '32R', taxiway: "A5", position: { lat: 37.554000, lon: 126.794000, localCoords: { x: 800, y: 100, z: 0 } }, purpose: "32R 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_32R_B3", type: 'REL', runway: '32R', taxiway: "B3", position: { lat: 37.551500, lon: 126.796000, localCoords: { x: 1000, y: 10, z: 0 } }, purpose: "32R 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_32R_B4", type: 'REL', runway: '32R', taxiway: "B4", position: { lat: 37.549000, lon: 126.798000, localCoords: { x: 1200, y: 10, z: 0 } }, purpose: "32R 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_32R_C2", type: 'REL', runway: '32R', taxiway: "C2", position: { lat: 37.546500, lon: 126.800000, localCoords: { x: 1400, y: 10, z: 0 } }, purpose: "32R 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_32R_C3", type: 'REL', runway: '32R', taxiway: "C3", position: { lat: 37.544000, lon: 126.802000, localCoords: { x: 1600, y: 10, z: 0 } }, purpose: "32R 진입", coverageArea: 200, direction: "from_east" },
  
  // 14R 방향 진입점
  { id: "REL_14R_A1", type: 'REL', runway: '14R', taxiway: "A1", position: { lat: 37.571500, lon: 126.774000, localCoords: { x: -1600, y: -10, z: 0 } }, purpose: "14R 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_14R_A2", type: 'REL', runway: '14R', taxiway: "A2", position: { lat: 37.569000, lon: 126.776000, localCoords: { x: -1400, y: -10, z: 0 } }, purpose: "14R 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_14R_A3", type: 'REL', runway: '14R', taxiway: "A3", position: { lat: 37.566500, lon: 126.778000, localCoords: { x: -1200, y: -10, z: 0 } }, purpose: "14R 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_14R_B1", type: 'REL', runway: '14R', taxiway: "B1", position: { lat: 37.564000, lon: 126.780000, localCoords: { x: -1000, y: -100, z: 0 } }, purpose: "14R 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_14R_B2", type: 'REL', runway: '14R', taxiway: "B2", position: { lat: 37.561500, lon: 126.782000, localCoords: { x: -800, y: -100, z: 0 } }, purpose: "14R 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_14R_C1", type: 'REL', runway: '14R', taxiway: "C1", position: { lat: 37.559000, lon: 126.784000, localCoords: { x: -600, y: -100, z: 0 } }, purpose: "14R 진입", coverageArea: 200, direction: "from_east" },
  
  // 32L 방향 진입점
  { id: "REL_32L_A4", type: 'REL', runway: '32L', taxiway: "A4", position: { lat: 37.556500, lon: 126.786000, localCoords: { x: 600, y: -10, z: 0 } }, purpose: "32L 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_32L_A5", type: 'REL', runway: '32L', taxiway: "A5", position: { lat: 37.554000, lon: 126.788000, localCoords: { x: 800, y: -10, z: 0 } }, purpose: "32L 진입", coverageArea: 200, direction: "from_west" },
  { id: "REL_32L_B3", type: 'REL', runway: '32L', taxiway: "B3", position: { lat: 37.551500, lon: 126.790000, localCoords: { x: 1000, y: -100, z: 0 } }, purpose: "32L 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_32L_B4", type: 'REL', runway: '32L', taxiway: "B4", position: { lat: 37.549000, lon: 126.792000, localCoords: { x: 1200, y: -100, z: 0 } }, purpose: "32L 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_32L_C2", type: 'REL', runway: '32L', taxiway: "C2", position: { lat: 37.546500, lon: 126.794000, localCoords: { x: 1400, y: -100, z: 0 } }, purpose: "32L 진입", coverageArea: 200, direction: "from_east" },
  { id: "REL_32L_C3", type: 'REL', runway: '32L', taxiway: "C3", position: { lat: 37.544000, lon: 126.796000, localCoords: { x: 1600, y: -100, z: 0 } }, purpose: "32L 진입", coverageArea: 200, direction: "from_east" }
];
*/