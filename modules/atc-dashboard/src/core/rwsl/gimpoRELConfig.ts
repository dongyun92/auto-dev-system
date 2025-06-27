import { RELConfiguration } from '../../types/rwsl';

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