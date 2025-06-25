import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { TrackedAircraft, Runway } from '../types';
import {
  calculateAcceleration,
  calculateTimeToConflict,
  findRunwayIntersection,
  calculateCrosswindComponent,
  estimatePosition,
  calculateDistance as calculateDistanceHelper,
  updateRunwayOccupancy,
  getGridKey,
  getNearbyGridKeys
} from '../utils/rwslHelpers';
import {
  memoize,
  isInViewport,
  distanceSquared,
  optimizeCanvas,
  FPSMonitor
} from '../utils/performanceOptimization';

interface RadarDisplayProps {
  aircraft: TrackedAircraft[];
  runways: Runway[];
  selectedAircraft?: TrackedAircraft;
  onSelectAircraft?: (aircraft: TrackedAircraft) => void;
}

interface RWSLLine {
  id: string;
  type: 'REL' | 'THL' | 'RIL';
  points: Array<{x: number, y: number}>;
  active: boolean;
}

const RadarDisplay: React.FC<RadarDisplayProps> = ({
  aircraft,
  runways,
  selectedAircraft,
  onSelectAircraft
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.5);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [mapOffsetX, setMapOffsetX] = useState(-10.8);
  const [mapOffsetY, setMapOffsetY] = useState(21.8);
  const [mapRotation, setMapRotation] = useState(224.95); // 기존 SVG 맵 회전 각도
  const [mapScaleAdjust, setMapScaleAdjust] = useState(0.420);
  const [showOSMMap, setShowOSMMap] = useState(false); // OSM 기본값 false로 변경 (성능 개선)
  const [osmTiles, setOsmTiles] = useState<Map<string, HTMLImageElement>>(new Map());
  const tileLoadQueueRef = useRef<Set<string>>(new Set());
  const loadingTilesRef = useRef<Set<string>>(new Set());
  // 영구 타일 캐시 - 모든 줌 레벨의 타일을 보관
  const [tileCache, setTileCache] = useState<Map<string, HTMLImageElement>>(new Map());
  const lastZoomLevelRef = useRef<number>(14);
  const [isDrawingRWSL, setIsDrawingRWSL] = useState(false); // RWSL 그리기 모드
  const [drawingPoints, setDrawingPoints] = useState<Array<{x: number, y: number}>>([]);
  const [rwslLines, setRwslLines] = useState<RWSLLine[]>([]);
  const [selectedRWSLType, setSelectedRWSLType] = useState<'REL' | 'THL' | 'RIL'>('REL');
  
  // 시각화 옵션들 - 성능 개선을 위해 기본값 false
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showTrafficZones, setShowTrafficZones] = useState(false);
  const [showRunwayLines, setShowRunwayLines] = useState(false);
  const [showDistanceRings, setShowDistanceRings] = useState(false);
  const [showLightDirections, setShowLightDirections] = useState(false);
  const [showDetectionSectors, setShowDetectionSectors] = useState(false);
  const [showAircraftPaths, setShowAircraftPaths] = useState(false);
  const [showTakeoffPositions, setShowTakeoffPositions] = useState(false);
  const [showLightPositions, setShowLightPositions] = useState(false);
  
  // 김포공항 활주로 데이터 (centerline 포함) - 정확한 위치
  const localRunways = [
    {
      id: '14L/32R',
      name: '14L/32R',
      centerline: {
        start: { lat: 37.5705, lng: 126.7784 }, // 14L 임계값
        end: { lat: 37.5478, lng: 126.8070 }    // 32R 임계값 (수정됨)
      },
      takeoffPositions: {
        '14L': { lat: 37.5705, lng: 126.7784 }, // 14L 이륙 위치 (임계값)
        '32R': { lat: 37.5478, lng: 126.8070 }  // 32R 이륙 위치 (임계값)
      }
    },
    {
      id: '14R/32L',
      name: '14R/32L', 
      centerline: {
        start: { lat: 37.5683, lng: 126.7755 }, // 14R 임계값 
        end: { lat: 37.5481, lng: 126.8009 }    // 32L 임계값 (수정됨)
      },
      takeoffPositions: {
        '14R': { lat: 37.5683, lng: 126.7755 }, // 14R 이륙 위치 (임계값)
        '32L': { lat: 37.5481, lng: 126.8009 }  // 32L 이륙 위치 (임계값)
      }
    }
  ];
  
  // 항공기 표시 상태 - 보간 불필요 (0.1초 간격 데이터)
  const [displayedAircraft, setDisplayedAircraft] = useState<Map<number, TrackedAircraft>>(new Map());
  
  // 고급 RWSL을 위한 상태 추가
  const [aircraftHistory, setAircraftHistory] = useState<Map<number, Array<{aircraft: TrackedAircraft, timestamp: number}>>>(new Map());
  const [weatherData, setWeatherData] = useState<{windSpeed: number, windDirection: number}>({windSpeed: 0, windDirection: 0});
  const [systemHealthStatus, setSystemHealthStatus] = useState<{gpsHealth: boolean, radarHealth: boolean}>({gpsHealth: true, radarHealth: true});
  const [aircraftSpatialIndex, setAircraftSpatialIndex] = useState<Map<string, TrackedAircraft[]>>(new Map());
  const [runwayOccupancyTime, setRunwayOccupancyTime] = useState<Map<string, Map<number, number>>>(new Map());
  
  // 성능 모니터링
  const fpsMonitorRef = useRef(new FPSMonitor());
  const [showFPS, setShowFPS] = useState(false);
  const [currentFPS, setCurrentFPS] = useState(60);

  // Gimpo Airport center coordinates - 터미널과 활주로의 중심점
  // 활주로 14L/32R과 14R/32L의 중간 지점 계산
  const GIMPO_CENTER = { lat: 37.5587, lng: 126.7905 };
  const CANVAS_SIZE = { width: window.innerWidth - 300, height: window.innerHeight - 120 };
  
  // OSM 분석을 통한 김포공항 RWSL 자동 생성
  const generateGimpoRWSL = (): RWSLLine[] => {
    const rwslData: RWSLLine[] = [];
    
    // 사용자가 그린 THL 데이터 추가
    const userTHLs = [
      { id: 'THL_14L', points: [
        { x: 126.77842888338135, y: 37.57059038535074 },
        { x: 126.77961763925401, y: 37.56963416554981 }
      ]},
      { id: 'THL_14R', points: [
        { x: 126.77554851740578, y: 37.568305855855854 },
        { x: 126.77669917782396, y: 37.567393693693695 }
      ]},
      { id: 'THL_32L', points: [
        { x: 126.80087725228985, y: 37.548114414414414 },
        { x: 126.79959874071409, y: 37.549150450450455 }
      ]},
      { id: 'THL_32R', points: [
        { x: 126.80695728511675, y: 37.54785540540541 },
        { x: 126.80563615648848, y: 37.54893648648649 }
      ]}
    ];
    
    userTHLs.forEach(thl => {
      rwslData.push({
        id: thl.id,
        type: 'THL',
        points: thl.points,
        active: false
      });
    });
    
    // REL (Runway Entrance Lights) - 주요 유도로 교차점
    // D (Departure) - 이륙 방향
    const departureRELs = [
      // 32R 방향 유도로 (북서쪽)
      { name: 'A_D', holdPoint: { lat: 37.54842, lng: 126.80769 }, runwayEdge: { lat: 37.54785, lng: 126.80698 } },
      { name: 'B1_D', holdPoint: { lat: 37.54886, lng: 126.80186 }, runwayEdge: { lat: 37.54810, lng: 126.80092 } },
      { name: 'B2_D', holdPoint: { lat: 37.55097, lng: 126.80452 }, runwayEdge: { lat: 37.55039, lng: 126.80379 } },
      
      // 중간 지점 유도로
      { name: 'C1_D', holdPoint: { lat: 37.55440, lng: 126.79492 }, runwayEdge: { lat: 37.55495, lng: 126.79233 } },
      { name: 'C2_D', holdPoint: { lat: 37.55434, lng: 126.80034 }, runwayEdge: { lat: 37.55476, lng: 126.79832 } },
      { name: 'C3_D', holdPoint: { lat: 37.55754, lng: 126.79633 }, runwayEdge: { lat: 37.55590, lng: 126.79689 } },
      { name: 'D1_D', holdPoint: { lat: 37.55903, lng: 126.78908 }, runwayEdge: { lat: 37.55828, lng: 126.78814 } },
      { name: 'D2_D', holdPoint: { lat: 37.55958, lng: 126.79370 }, runwayEdge: { lat: 37.56002, lng: 126.79172 } },
      { name: 'D3_D', holdPoint: { lat: 37.56275, lng: 126.78976 }, runwayEdge: { lat: 37.56111, lng: 126.79034 } },
      
      // 14L 방향 유도로 (남동쪽)
      { name: 'E1_D', holdPoint: { lat: 37.56353, lng: 126.78340 }, runwayEdge: { lat: 37.56149, lng: 126.78408 } },
      { name: 'E2_D', holdPoint: { lat: 37.56634, lng: 126.78537 }, runwayEdge: { lat: 37.56570, lng: 126.78457 } },
      { name: 'F2_D', holdPoint: { lat: 37.56860, lng: 126.78237 }, runwayEdge: { lat: 37.56803, lng: 126.78165 } },
      { name: 'G1_D', holdPoint: { lat: 37.56907, lng: 126.77650 }, runwayEdge: { lat: 37.56832, lng: 126.77557 } },
      { name: 'G2_D', holdPoint: { lat: 37.57116, lng: 126.77914 }, runwayEdge: { lat: 37.57059, lng: 126.77843 } },
      
      // 14R/32L 평행 활주로 유도로
      { name: 'W1_D', holdPoint: { lat: 37.55253, lng: 126.79391 }, runwayEdge: { lat: 37.55310, lng: 126.79462 } },
      { name: 'W2_D', holdPoint: { lat: 37.55508, lng: 126.79070 }, runwayEdge: { lat: 37.55565, lng: 126.79141 } },
    ];
    
    // A (Arrival) - 착륙 방향 (활주로에서 주기장으로) - 필수 등화만 유지
    const arrivalRELs = [
      // 14L/14R에서 착륙 후 북쪽 주기장으로
      { name: 'B1_A', runwayEdge: { lat: 37.54980, lng: 126.80304 }, holdPoint: { lat: 37.55038, lng: 126.80379 } },
      
      // 중간 유도로를 통해 주기장으로
      { name: 'C1_A', runwayEdge: { lat: 37.55468, lng: 126.79677 }, holdPoint: { lat: 37.55529, lng: 126.79760 } },
      { name: 'D1_A', runwayEdge: { lat: 37.55985, lng: 126.79012 }, holdPoint: { lat: 37.56056, lng: 126.79104 } },
      
      // 32R/32L에서 착륙 후 남쪽 주기장으로
      { name: 'E1_A', runwayEdge: { lat: 37.56506, lng: 126.78376 }, holdPoint: { lat: 37.56570, lng: 126.78455 } },
      { name: 'G1_A', runwayEdge: { lat: 37.56983, lng: 126.77745 }, holdPoint: { lat: 37.57058, lng: 126.77840 } }
    ];
    
    // Departure RELs 추가 - 활주로 침범 방지
    departureRELs.forEach(taxiway => {
      // holdPoint에서 runwayEdge 방향으로 70%만 그리기 (활주로 침범 방지)
      const adjustedRunwayEdge = {
        lat: taxiway.holdPoint.lat + (taxiway.runwayEdge.lat - taxiway.holdPoint.lat) * 0.7,
        lng: taxiway.holdPoint.lng + (taxiway.runwayEdge.lng - taxiway.holdPoint.lng) * 0.7
      };
      
      rwslData.push({
        id: `REL_${taxiway.name}`,
        type: 'REL',
        points: [
          { x: taxiway.holdPoint.lng, y: taxiway.holdPoint.lat },
          { x: adjustedRunwayEdge.lng, y: adjustedRunwayEdge.lat }
        ],
        active: false
      });
    });
    
    // Arrival RELs 추가
    arrivalRELs.forEach(taxiway => {
      // 특정 등화들의 holdPoint 쪽 끝점을 30% 줄이기 (반대방향)
      if (['G1_A', 'E1_A', 'D1_A', 'C1_A', 'B1_A'].includes(taxiway.name)) {
        // holdPoint에서 runwayEdge 방향으로 30% 이동한 지점을 새로운 끝점으로
        const adjustedHoldPoint = {
          lat: taxiway.holdPoint.lat + (taxiway.runwayEdge.lat - taxiway.holdPoint.lat) * 0.3,
          lng: taxiway.holdPoint.lng + (taxiway.runwayEdge.lng - taxiway.holdPoint.lng) * 0.3
        };
        
        rwslData.push({
          id: `REL_${taxiway.name}`,
          type: 'REL',
          points: [
            { x: taxiway.runwayEdge.lng, y: taxiway.runwayEdge.lat },
            { x: adjustedHoldPoint.lng, y: adjustedHoldPoint.lat }
          ],
          active: false
        });
      } else {
        // 나머지는 활주로 침범 방지 - runwayEdge에서 holdPoint 방향으로 70%만 그리기
        const adjustedRunwayEdge = {
          lat: taxiway.runwayEdge.lat + (taxiway.holdPoint.lat - taxiway.runwayEdge.lat) * 0.7,
          lng: taxiway.runwayEdge.lng + (taxiway.holdPoint.lng - taxiway.runwayEdge.lng) * 0.7
        };
        
        rwslData.push({
          id: `REL_${taxiway.name}`,
          type: 'REL',
          points: [
            { x: adjustedRunwayEdge.lng, y: adjustedRunwayEdge.lat },
            { x: taxiway.holdPoint.lng, y: taxiway.holdPoint.lat }
          ],
          active: false
        });
      }
    });
    
    return rwslData;
  };
  
  // 두 지점 사이의 위치 보간
  const interpolateLatLng = (start: {lat: number, lng: number}, end: {lat: number, lng: number}, ratio: number) => {
    return {
      x: start.lng + (end.lng - start.lng) * ratio,
      y: start.lat + (end.lat - start.lat) * ratio
    };
  };

  // 항공기 이력 업데이트 (가속도 계산용) - 데이터 도착 시 즉시 갱신
  useEffect(() => {
    const now = Date.now();
    
    setAircraftHistory(prev => {
      const newHistory = new Map(prev);
      
      aircraft.forEach(ac => {
        const history = newHistory.get(ac.id) || [];
        history.push({ aircraft: ac, timestamp: now });
        
        // 최근 3초 데이터만 유지
        const threeSecondsAgo = now - 3000;
        const filtered = history.filter(h => h.timestamp > threeSecondsAgo);
        
        newHistory.set(ac.id, filtered);
      });
      
      // 사라진 항공기 데이터 정리
      const activeIds = new Set(aircraft.map(ac => ac.id));
      newHistory.forEach((_, id) => {
        if (!activeIds.has(id)) {
          newHistory.delete(id);
        }
      });
      
      return newHistory;
    });
  }, [aircraft]);
  
  // 공간 인덱싱 업데이트 - 데이터 도착 시 즉시 갱신
  useEffect(() => {
    const index = new Map<string, TrackedAircraft[]>();
    
    aircraft.forEach(ac => {
      const keys = getNearbyGridKeys(ac.latitude, ac.longitude);
      keys.forEach(key => {
        const list = index.get(key) || [];
        list.push(ac);
        index.set(key, list);
      });
    });
    
    setAircraftSpatialIndex(index);
  }, [aircraft]);
  
  // 김포공항 활주로 정의 (14L/32R, 14R/32L) - 상수로 정의하여 재생성 방지
  const GIMPO_RUNWAYS = useMemo(() => [
    {
      id: '14L/32R',
      threshold14L: { lat: 37.57070, lng: 126.77840 },
      threshold32R: { lat: 37.54785, lng: 126.80698 },
      centerline: { start: { lat: 37.57070, lng: 126.77840 }, end: { lat: 37.54785, lng: 126.80698 } }
    },
    {
      id: '14R/32L',
      threshold14R: { lat: 37.56840, lng: 126.77570 },
      threshold32L: { lat: 37.54555, lng: 126.80428 },
      centerline: { start: { lat: 37.56840, lng: 126.77570 }, end: { lat: 37.54555, lng: 126.80428 } }
    }
  ], []);

  // 활주로-유도로 종속성 매핑 (김포공항 실제 구조 기반) - 상수로 정의
  const RUNWAY_TAXIWAY_MAPPING = useMemo(() => ({
    '14L/32R': {
      connectedRELs: [
        'REL_G1_A', 'REL_G2_D', 'REL_F2_D', 'REL_E1_A', 'REL_E2_D', 
        'REL_D1_A', 'REL_D2_D', 'REL_D3_D', 'REL_C1_A', 'REL_C2_D', 
        'REL_C3_D', 'REL_B2_D', 'REL_B1_D', 'REL_B1_A', 'REL_A_D'  // REL_B1_A 추가
      ],
      thresholdTHLs: ['THL_14L', 'THL_32R']
    },
    '14R/32L': {
      connectedRELs: [
        'REL_B1_D', 'REL_W1_D', 'REL_C1_D', 'REL_W2_D', 
        'REL_D1_D', 'REL_E1_D', 'REL_G1_D'
      ],
      thresholdTHLs: ['THL_14R', 'THL_32L']
    }
  }), []);

  // RWSL 자동화 시스템 - 항공기 위치 기반 등화 제어 (고급 기능 포함)
  const updateRWSLAutomation = useCallback((aircraftList: TrackedAircraft[], currentRwslLines: RWSLLine[]) => {
    if (!aircraftList.length || !currentRwslLines.length) return currentRwslLines;
    
    // 성능 측정 (개발 모드에서만)
    const startTime = performance.now();

    const updatedLines = currentRwslLines.map(line => ({ ...line }));

    const runways = GIMPO_RUNWAYS;
    const runwayTaxiwayMapping = RUNWAY_TAXIWAY_MAPPING;

    // 거리 계산 함수 (헬퍼 함수 사용)
    const calculateDistance = calculateDistanceHelper;
    
    // 항공기 가속도 계산
    const getAircraftAcceleration = (aircraftId: number): number => {
      const history = aircraftHistory.get(aircraftId);
      if (!history || history.length < 2) return 0;
      
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      const deltaTime = (latest.timestamp - previous.timestamp) / 1000; // 초 단위
      
      return calculateAcceleration(
        latest.aircraft.speed * 0.514, // kt to m/s
        previous.aircraft.speed * 0.514,
        deltaTime
      );
    };
    
    // GPS 손실 시 위치 추정
    const getEstimatedPosition = (aircraft: TrackedAircraft): {lat: number, lng: number} => {
      if (systemHealthStatus.gpsHealth) {
        return { lat: aircraft.latitude, lng: aircraft.longitude };
      }
      
      // GPS 손실 시 마지막 알려진 위치에서 추정
      const history = aircraftHistory.get(aircraft.id);
      if (!history || history.length < 2) {
        return { lat: aircraft.latitude, lng: aircraft.longitude };
      }
      
      const lastKnown = history[history.length - 2];
      const elapsedTime = (Date.now() - lastKnown.timestamp) / 1000;
      
      return estimatePosition(
        { lat: lastKnown.aircraft.latitude, lng: lastKnown.aircraft.longitude },
        aircraft.heading,
        aircraft.speed,
        elapsedTime
      );
    };

    // 활주로 점유 확인 (고도 50ft 이하, 활주로 중심선 200m 이내)
    const getRunwayOccupancy = () => {
      const occupancy: { [key: string]: boolean } = { '14L/32R': false, '14R/32L': false };
      
      aircraftList.forEach(aircraft => {
        if (aircraft.altitude <= 50) { // 지상 항공기만 체크
          runways.forEach(runway => {
            const distToCenter = calculateDistance(
              aircraft.latitude, aircraft.longitude,
              (runway.centerline.start.lat + runway.centerline.end.lat) / 2,
              (runway.centerline.start.lng + runway.centerline.end.lng) / 2
            );
            
            if (distToCenter <= 400) { // 활주로 중심선 400m 이내 (활주로 폭 + 여유)
              occupancy[runway.id] = true;
            }
          });
        }
      });
      
      return occupancy;
    };

    // 유도로에서 활주로로 접근하는 항공기 감지
    const getApproachingAircraft = () => {
      return aircraftList.filter(aircraft => {
        if (aircraft.altitude > 50) return false; // 지상 항공기만
        if (aircraft.speed < 5) return false; // 정지 상태 제외
        
        // 활주로로 향하는 항공기 감지 (간단한 로직)
        const isApproaching = runways.some(runway => {
          const distToThreshold14 = calculateDistance(
            aircraft.latitude, aircraft.longitude,
            runway.threshold14L?.lat || runway.threshold14R?.lat || 0,
            runway.threshold14L?.lng || runway.threshold14R?.lng || 0
          );
          const distToThreshold32 = calculateDistance(
            aircraft.latitude, aircraft.longitude,
            runway.threshold32R?.lat || runway.threshold32L?.lat || 0,
            runway.threshold32R?.lng || runway.threshold32L?.lng || 0
          );
          
          return (distToThreshold14 <= 500 || distToThreshold32 <= 500) && aircraft.speed > 5;
        });
        
        return isApproaching;
      });
    };

    const runwayOccupancy = getRunwayOccupancy();
    const approachingAircraft = getApproachingAircraft();

    // 활주로별 이착륙 트래픽 감지
    const getActiveRunwayTrafficByRunway = () => {
      const runwayTraffic: { [key: string]: TrackedAircraft[] } = {
        '14L/32R': [],
        '14R/32L': []
      };

      aircraftList.forEach(aircraft => {
        // 이륙 단계 판단
        // 1. 이륙 준비: 이륙 위치에서 정렬, 속도 < 30kt
        // 2. 이륙 진행: 이륙 위치를 통과하여 가속 중
        // 3. 초기 상승: 고도 50-500ft, 상승률 > 100fpm
        
        let isTakeoffPhase = false;
        let takeoffRunway = '';
        
        // 각 활주로의 이륙 위치 확인
        for (const runway of localRunways) {
          const takeoffPositions = runway.takeoffPositions || {};
          
          for (const [posName, pos] of Object.entries(takeoffPositions)) {
            const distToTakeoffPos = calculateDistance(
              aircraft.latitude, aircraft.longitude,
              pos.lat, pos.lng
            );
            
            // 이륙 방향 확인
            const expectedHeading = posName.includes('14') ? 143 : 323;
            let headingDiff = Math.abs(aircraft.heading - expectedHeading);
            if (headingDiff > 180) headingDiff = 360 - headingDiff;
            const isAligned = headingDiff <= 15; // 15도 이내 정렬
            
            if (isAligned) {
              if (distToTakeoffPos < 50 && aircraft.speed < 30) {
                // 이륙 준비 단계
                isTakeoffPhase = true;
                takeoffRunway = runway.id;
                break;
              } else if (aircraft.speed >= 30 && aircraft.altitude <= 100) {
                // 이륙 위치를 통과한 후 가속 중
                // 이륙 방향으로 이동 중인지 확인
                const runwayVector = {
                  lat: runway.centerline.end.lat - runway.centerline.start.lat,
                  lng: runway.centerline.end.lng - runway.centerline.start.lng
                };
                
                // 현재 위치가 이륙 위치보다 활주로 중심 쪽에 있는지 확인
                const fromTakeoffPos = {
                  lat: aircraft.latitude - pos.lat,
                  lng: aircraft.longitude - pos.lng
                };
                
                const dotProduct = fromTakeoffPos.lat * runwayVector.lat + 
                                 fromTakeoffPos.lng * runwayVector.lng;
                
                if (dotProduct > 0) {
                  // 이륙 위치를 통과함
                  isTakeoffPhase = true;
                  takeoffRunway = runway.id;
                  break;
                }
              }
            }
          }
          if (isTakeoffPhase) break;
        }
        
        // 초기 상승 단계도 포함
        if (!isTakeoffPhase && aircraft.altitude > 50 && aircraft.altitude <= 500 && 
            (aircraft.verticalSpeed || 0) > 100) {
          isTakeoffPhase = true;
        }
        
        // 착륙 단계: 낮은 고도에서 하강 중이고 착륙 속도 범위
        const isLandingPhase = aircraft.altitude <= 1500 && 
                              (aircraft.verticalSpeed || 0) < -100 &&
                              aircraft.speed >= 80 && aircraft.speed <= 180;

        if (isTakeoffPhase || isLandingPhase) {
          // 어느 활주로에 가까운지 판단
          localRunways.forEach(runway => {
            // 활주로 양끝 임계값 사용
            const dist14 = calculateDistance(
              aircraft.latitude, aircraft.longitude,
              runway.centerline.start.lat, runway.centerline.start.lng
            );
            const dist32 = calculateDistance(
              aircraft.latitude, aircraft.longitude,
              runway.centerline.end.lat, runway.centerline.end.lng
            );
            const distToRunway = Math.min(dist14, dist32);
            
            if (isTakeoffPhase) {
              // 이륙: 활주로 직사각형 영역 내에 있는지 확인
              // 활주로 중심선에서의 수직 거리 계산
              // 점과 직선 사이의 거리 계산
              const distToLine = (() => {
                const A = aircraft.longitude - runway.centerline.start.lng;
                const B = aircraft.latitude - runway.centerline.start.lat;
                const C = runway.centerline.end.lng - runway.centerline.start.lng;
                const D = runway.centerline.end.lat - runway.centerline.start.lat;
                
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                let param = -1;
                
                if (lenSq !== 0) param = dot / lenSq;
                
                let xx, yy;
                
                if (param < 0) {
                  xx = runway.centerline.start.lng;
                  yy = runway.centerline.start.lat;
                } else if (param > 1) {
                  xx = runway.centerline.end.lng;
                  yy = runway.centerline.end.lat;
                } else {
                  xx = runway.centerline.start.lng + param * C;
                  yy = runway.centerline.start.lat + param * D;
                }
                
                const dx = aircraft.longitude - xx;
                const dy = aircraft.latitude - yy;
                return Math.sqrt(dx * dx + dy * dy);
              })();
              
              // 활주로 폭의 절반 (약 30m) + 여유 10m = 40m
              const runwayHalfWidth = 40 / 111000; // degrees
              
              // 활주로 시작점과 끝점 사이에 있는지 확인
              const runwayVector = {
                x: runway.centerline.end.lng - runway.centerline.start.lng,
                y: runway.centerline.end.lat - runway.centerline.start.lat
              };
              const toAircraftVector = {
                x: aircraft.longitude - runway.centerline.start.lng,
                y: aircraft.latitude - runway.centerline.start.lat
              };
              
              const dotProduct = runwayVector.x * toAircraftVector.x + runwayVector.y * toAircraftVector.y;
              const runwayLengthSq = runwayVector.x * runwayVector.x + runwayVector.y * runwayVector.y;
              const projection = dotProduct / runwayLengthSq;
              
              // 활주로 영역 내에 있으면 할당
              if (distToLine <= runwayHalfWidth && projection >= -0.1 && projection <= 1.1) {
                runwayTraffic[runway.id].push(aircraft);
              }
            } else if (isLandingPhase) {
              // 착륙: 활주로 중심선 연장선까지의 거리로 판단
              
              // 점과 직선 사이의 거리 계산 함수
              const distanceToLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
                const A = px - x1;
                const B = py - y1;
                const C = x2 - x1;
                const D = y2 - y1;
                
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                let param = -1;
                
                if (lenSq !== 0) param = dot / lenSq;
                
                let xx, yy;
                
                if (param < 0) {
                  // 연장선상의 점이 선분 밖 (시작점 쪽)
                  xx = x1;
                  yy = y1;
                } else if (param > 1) {
                  // 연장선상의 점이 선분 밖 (끝점 쪽)
                  xx = x2;
                  yy = y2;
                } else {
                  // 연장선상의 수직점
                  xx = x1 + param * C;
                  yy = y1 + param * D;
                }
                
                const dx = px - xx;
                const dy = py - yy;
                return Math.sqrt(dx * dx + dy * dy);
              };
              
              // 활주로 중심선 연장선까지의 거리 (도 단위를 미터로 변환)
              const distToExtendedCenterline = distanceToLine(
                aircraft.longitude, aircraft.latitude,
                runway.centerline.start.lng, runway.centerline.start.lat,
                runway.centerline.end.lng, runway.centerline.end.lat
              ) * 111000; // 대략적인 변환 (1도 ≈ 111km)
              
              // 활주로 연장선에서 500m 이내이고, 활주로에서 10km 이내일 때
              if (distToExtendedCenterline <= 500 && distToRunway <= 10000) {
                // 김포공항 활주로 실제 방향 (자북 기준)
                // 14L/14R: 143도, 32L/32R: 323도
                const approachFrom14 = dist14 < dist32;
                const expectedHeading = approachFrom14 ? 143 : 323;
                
                let headingDiff = Math.abs(aircraft.heading - expectedHeading);
                if (headingDiff > 180) headingDiff = 360 - headingDiff;
                
                // heading이 ±45도 이내일 때만
                if (headingDiff <= 45) {
                  runwayTraffic[runway.id].push(aircraft);
                }
              }
            }
          });
        }
      });

      return runwayTraffic;
    };

    const runwayTrafficByRunway = getActiveRunwayTrafficByRunway();

    // 디버깅을 위한 종속성 출력 (개발 모드에서만) - 성능 개선을 위해 비활성화
    // CPU 사용률이 높을 때는 주석 처리하세요
    /*
    if (process.env.NODE_ENV === 'development') {
      console.log('=== RWSL 자동화 디버깅 ===');
      console.log('전체 항공기 수:', aircraftList.length);
      
      // 활주로 실제 방향 출력
      console.log('\n=== 김포공항 활주로 방향 (자북 기준) ===');
      console.log('14L/14R: 143° (남동→북서)');
      console.log('32L/32R: 323° (북서→남동)');
      
      // 활주로별 트래픽 상세 분석
      Object.keys(runwayTaxiwayMapping).forEach(runwayId => {
        const mapping = runwayTaxiwayMapping[runwayId as keyof typeof runwayTaxiwayMapping];
        const traffic = runwayTrafficByRunway[runwayId];
        console.log(`\n${runwayId} 활주로:`);
        console.log(`  - 연결된 REL: ${mapping.connectedRELs.join(', ')}`);
        console.log(`  - THL: ${mapping.thresholdTHLs.join(', ')}`);
        console.log(`  - 현재 트래픽: ${traffic.length}대`);
        
        if (traffic.length > 0) {
          traffic.forEach(aircraft => {
            const isTakeoff = (aircraft.altitude <= 50 && aircraft.speed >= 30) ||
                             (aircraft.altitude > 50 && aircraft.altitude <= 500 && 
                              (aircraft.verticalSpeed || 0) > 100);
            const isLanding = aircraft.altitude <= 1500 && 
                             (aircraft.verticalSpeed || 0) < -100 &&
                             aircraft.speed >= 80 && aircraft.speed <= 180;
            
            // 착륙 시 활주로 정렬 정보
            let alignmentInfo = '';
            if (isLanding) {
              // 해당 활주로 찾기
              const runway = localRunways.find(r => r.id === runwayId);
              if (runway) {
                // 점과 직선 사이의 거리 계산
                const distanceToLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
                  const A = px - x1;
                  const B = py - y1;
                  const C = x2 - x1;
                  const D = y2 - y1;
                  const dot = A * C + B * D;
                  const lenSq = C * C + D * D;
                  let param = -1;
                  if (lenSq !== 0) param = dot / lenSq;
                  let xx, yy;
                  if (param < 0) {
                    xx = x1; yy = y1;
                  } else if (param > 1) {
                    xx = x2; yy = y2;
                  } else {
                    xx = x1 + param * C;
                    yy = y1 + param * D;
                  }
                  const dx = px - xx;
                  const dy = py - yy;
                  return Math.sqrt(dx * dx + dy * dy);
                };
                
                const distToExtendedCenterline = distanceToLine(
                  aircraft.longitude, aircraft.latitude,
                  runway.centerline.start.lng, runway.centerline.start.lat,
                  runway.centerline.end.lng, runway.centerline.end.lat
                ) * 111000;
                
                // 김포공항 활주로 실제 방향 (자북 기준)
                const runwayHeading = runwayId.includes('14') ? 143 : 323;
                let headingDiff = Math.abs(aircraft.heading - runwayHeading);
                if (headingDiff > 180) headingDiff = 360 - headingDiff;
                alignmentInfo = `, 중심선거리=${Math.round(distToExtendedCenterline)}m, hdg차이=${Math.round(headingDiff)}°`;
              }
            }
            
            // 이륙 위치 정보 추가
            let takeoffPositionInfo = '';
            if (isTakeoff && traffic.length > 0) {
              const runway = localRunways.find(r => r.id === runwayId);
              if (runway) {
                const dist14 = calculateDistance(
                  aircraft.latitude, aircraft.longitude,
                  runway.centerline.start.lat, runway.centerline.start.lng
                );
                const dist32 = calculateDistance(
                  aircraft.latitude, aircraft.longitude,
                  runway.centerline.end.lat, runway.centerline.end.lng
                );
                const nearestEnd = dist14 < dist32 ? `14측=${Math.round(dist14)}m` : `32측=${Math.round(dist32)}m`;
                takeoffPositionInfo = `, ${nearestEnd}`;
              }
            }
            
            console.log(`    - ${aircraft.callsign}: 고도=${aircraft.altitude}ft, 속도=${aircraft.speed}kt, VS=${aircraft.verticalSpeed || 0}fpm, hdg=${aircraft.heading}°, 이륙=${isTakeoff}, 착륙=${isLanding}${alignmentInfo}${takeoffPositionInfo}`);
          });
        }
      });
      
      // REL별 상태 분석
      console.log('\n=== REL 상태 분석 ===');
      updatedLines.filter(line => line.type === 'REL').forEach(line => {
        let relevantRunway = '';
        Object.keys(runwayTaxiwayMapping).forEach(runwayId => {
          if (runwayTaxiwayMapping[runwayId as keyof typeof runwayTaxiwayMapping].connectedRELs.includes(line.id)) {
            relevantRunway = runwayId;
          }
        });
        
        const hasActiveTraffic = relevantRunway ? runwayTrafficByRunway[relevantRunway].length > 0 : false;
        
        // 접근 항공기 확인 - 좌표 수정 (x=lng, y=lat)
        const lightPosition = {
          lat: (line.points[0].y + line.points[1].y) / 2,
          lng: (line.points[0].x + line.points[1].x) / 2
        };
        
        const nearbyAircraft = aircraftList.filter(aircraft => {
          if (aircraft.altitude > 50) return false;
          if (aircraft.speed < 10 || aircraft.speed > 50) return false;
          
          const distance = calculateDistance(
            aircraft.latitude, aircraft.longitude,
            lightPosition.lat, lightPosition.lng
          );
          
          // REL 감지 영역 내에 있는지
          return distance >= 50 && distance <= 200;
        });
        
        console.log(`${line.id}: 활주로=${relevantRunway}, 트래픽=${hasActiveTraffic}, 근처항공기=${nearbyAircraft.length}대, 활성=${line.active}`);
        if (nearbyAircraft.length > 0) {
          nearbyAircraft.forEach(ac => {
            const dist = calculateDistance(ac.latitude, ac.longitude, lightPosition.lat, lightPosition.lng);
            const dLng = lightPosition.lng - ac.longitude;
            const dLat = lightPosition.lat - ac.latitude;
            const bearingToREL = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
            let headingDiff = Math.abs(ac.heading - bearingToREL);
            if (headingDiff > 180) headingDiff = 360 - headingDiff;
            console.log(`  근처: ${ac.callsign} (${Math.round(dist)}m, ${ac.speed}kt, hdg=${ac.heading}°, REL방향=${Math.round(bearingToREL)}°, 차이=${Math.round(headingDiff)}°)`);
          });
        }
      });
      
      console.log('\n=== 활성화된 등화 ===');
      const activeLights = updatedLines.filter(line => line.active);
      if (activeLights.length === 0) {
        console.log('활성화된 등화 없음');
      } else {
        activeLights.forEach(line => {
          console.log(`🔴 ${line.id} (${line.type}) - 활성화`);
        });
      }
    }
    */

    // THL (Takeoff Hold Lights) 제어 로직 - 활주로별 종속성 및 날씨 고려
    updatedLines.forEach(line => {
      if (line.type === 'THL') {
        // 해당 THL이 어떤 활주로에 속하는지 확인
        let relevantRunway = '';
        Object.keys(runwayTaxiwayMapping).forEach(runwayId => {
          if (runwayTaxiwayMapping[runwayId as keyof typeof runwayTaxiwayMapping].thresholdTHLs.includes(line.id)) {
            relevantRunway = runwayId;
          }
        });

        if (relevantRunway) {
          // 해당 활주로에 트래픽이 있는지 확인
          const hasActiveTraffic = runwayTrafficByRunway[relevantRunway].length > 0;

          // THL 근처에 대기 중인 항공기 확인 (직사각형 영역)
          const waitingAircraft = aircraftList.filter(aircraft => {
            if (aircraft.altitude > 50 || aircraft.speed > 30) return false; // 지상 대기 중만
            const position = getEstimatedPosition(aircraft);
            const thlMidpoint = {
              lat: (line.points[0].y + line.points[1].y) / 2,
              lng: (line.points[0].x + line.points[1].x) / 2
            };
            
            // THL 임계값 근처인지 확인 (직사각형 영역)
            // THL 위치에서 활주로 방향으로 100m x 활주로 폭 영역
            const runwayWidth = 60; // 활주로 폭 60m
            const waitingAreaLength = 100; // 임계값에서 100m
            
            // 활주로 방향 벡터 (예: 14L THL의 경우 143도 방향)
            const runwayHeading = line.id.includes('14') ? 143 : 323;
            const headingRad = runwayHeading * Math.PI / 180;
            const runwayVector = {
              lat: Math.cos(headingRad),
              lng: Math.sin(headingRad)
            };
            
            // 항공기에서 THL까지의 벡터
            const toAircraft = {
              lat: position.lat - thlMidpoint.lat,
              lng: position.lng - thlMidpoint.lng
            };
            
            // 활주로 방향 투영 (진행 방향)
            const alongRunway = toAircraft.lat * runwayVector.lat + toAircraft.lng * runwayVector.lng;
            // 활주로 수직 방향 투영
            const acrossRunway = Math.abs(toAircraft.lat * (-runwayVector.lng) + toAircraft.lng * runwayVector.lat);
            
            // 직사각형 영역 내에 있는지 확인
            const alongRunwayMeters = alongRunway * 111000; // degrees to meters
            const acrossRunwayMeters = acrossRunway * 111000;
            
            // THL 위치에서 활주로 방향으로 -100m부터 0m 범위 (임계값 전 100m)
            return alongRunwayMeters >= -waitingAreaLength && alongRunwayMeters <= 0 && 
                   acrossRunwayMeters <= runwayWidth / 2;
          });
          
          const hasWaitingAircraft = waitingAircraft.length > 0;
          
          // THL 활성화 조건:
          // 활주로에 트래픽이 있고 대기 중인 항공기가 있을 때
          line.active = hasActiveTraffic && hasWaitingAircraft;
        } else {
          line.active = false; // 매핑되지 않은 THL은 비활성화
        }
      }
    });

    // REL (Runway Entrance Lights) 제어 로직 - 고급 알고리즘
    updatedLines.forEach(line => {
      if (line.type === 'REL') {
        // 해당 REL이 어떤 활주로에 연결되어 있는지 확인
        let relevantRunway = '';
        Object.keys(runwayTaxiwayMapping).forEach(runwayId => {
          if (runwayTaxiwayMapping[runwayId as keyof typeof runwayTaxiwayMapping].connectedRELs.includes(line.id)) {
            relevantRunway = runwayId;
          }
        });

        if (relevantRunway) {
          const runwayTraffic = runwayTrafficByRunway[relevantRunway];
          
          // 디버깅: REL과 활주로 매핑 확인 (주석 처리)
          /*
          if (line.id === 'REL_B1_D' || line.id === 'REL_B2_D') {
            console.log(`🔍 ${line.id} 매핑: 활주로=${relevantRunway}, 트래픽=${runwayTraffic.length}대`);
          }
          */
          
          // 이륙 중인 항공기 확인 (이륙 의도 감지 + 가속도 고려)
          const takeoffAircraft = runwayTraffic.filter(aircraft => {
            // 지상에 있고
            if (aircraft.altitude > 100) return false;
            
            // 활주로에 있는 항공기 중에서
            const runway = localRunways.find(r => r.id === relevantRunway);
            if (!runway) return false;
            
            // GPS 손실 대응
            const position = getEstimatedPosition(aircraft);
            
            // 활주로 방향 확인 (14 또는 32)
            const heading14 = 143;
            const heading32 = 323;
            let headingDiff14 = Math.abs(aircraft.heading - heading14);
            if (headingDiff14 > 180) headingDiff14 = 360 - headingDiff14;
            let headingDiff32 = Math.abs(aircraft.heading - heading32);
            if (headingDiff32 > 180) headingDiff32 = 360 - headingDiff32;
            
            // 어느 방향으로 이륙하는지 확인
            const isTakeoff14Direction = headingDiff14 <= headingDiff32;
            
            // 이륙 방향에 따른 이륙 위치 확인
            let isAtTakeoffPosition = false;
            if (isTakeoff14Direction) {
              // 14 방향 이륙: 32R/32L 끝점에서 진행 방향 500m 이내
              const dist32 = calculateDistance(
                position.lat, position.lng,
                runway.centerline.end.lat, runway.centerline.end.lng
              );
              isAtTakeoffPosition = dist32 <= 500;
            } else {
              // 32 방향 이륙: 14L/14R 끝점에서 진행 방향 500m 이내
              const dist14 = calculateDistance(
                position.lat, position.lng,
                runway.centerline.start.lat, runway.centerline.start.lng
              );
              isAtTakeoffPosition = dist14 <= 500;
            }
            
            // 이륙 방향과 정렬 확인 (이미 위에서 계산됨)
            const isAligned = isTakeoff14Direction ? 
              (headingDiff14 <= 10) : 
              (headingDiff32 <= 10);
            
            // 가속도 확인
            const acceleration = getAircraftAcceleration(aircraft.id);
            const isAccelerating = acceleration > 0.5; // 0.5 m/s² 이상
            
            // 이륙 의도 판단 (향상된 로직):
            // 1. 이미 30kt 이상으로 이륙 롤 중이거나
            // 2. 이륙 위치에서 정렬되어 있고 전진 시작 (5kt 이상)
            // 3. 가속 중인 경우 추가 점수
            return (aircraft.speed >= 30) || 
                   (isAtTakeoffPosition && isAligned && aircraft.speed >= 5) ||
                   (isAtTakeoffPosition && isAligned && isAccelerating);
          });

          if (takeoffAircraft.length > 0) {
            // 기본값: 비활성
            line.active = false;
            
            // 각 이륙 항공기에 대해 REL 활성화 판단
            takeoffAircraft.forEach(aircraft => {
              const relMidpoint = {
                lat: (line.points[0].y + line.points[1].y) / 2,
                lng: (line.points[0].x + line.points[1].x) / 2
              };
              
              // 항공기에서 REL로의 벡터
              const toREL = {
                lat: relMidpoint.lat - aircraft.latitude,
                lng: relMidpoint.lng - aircraft.longitude
              };
              
              // 항공기 진행 방향 벡터 (heading 사용)
              const aircraftHeadingRad = aircraft.heading * Math.PI / 180;
              const aircraftDirection = {
                lat: Math.cos(aircraftHeadingRad),
                lng: Math.sin(aircraftHeadingRad)
              };
              
              // 항공기가 REL로 향하고 있는지 확인 (내적 > 0)
              const dotProduct = toREL.lat * aircraftDirection.lat + toREL.lng * aircraftDirection.lng;
              
              // 모든 REL은 기본적으로 활성화 (차단 신호)
              line.active = true;
              
              // 하지만 고속 트래픽이 REL로 접근 중이면 안전 통과를 위해 미리 소등
              takeoffAircraft.forEach(ac => {
                // 항공기에서 REL로의 벡터
                const toREL = {
                  lat: relMidpoint.lat - ac.latitude,
                  lng: relMidpoint.lng - ac.longitude
                };
                
                // 항공기 진행 방향
                const headingRad = ac.heading * Math.PI / 180;
                const direction = {
                  lat: Math.cos(headingRad),
                  lng: Math.sin(headingRad)
                };
                
                // 항공기가 REL로 향하고 있는지 (내적 > 0)
                const dotProduct = toREL.lat * direction.lat + toREL.lng * direction.lng;
                
                if (dotProduct > 0) {
                  // REL까지의 거리
                  const distance = calculateDistance(
                    ac.latitude, ac.longitude,
                    relMidpoint.lat, relMidpoint.lng
                  );
                  
                  // FAA 기준: 항공기가 REL에 도달하기 2-3초 전에 소등
                  const aircraftSpeedMs = ac.speed * 0.514; // knots to m/s
                  const timeToReachREL = aircraftSpeedMs > 0 ? distance / aircraftSpeedMs : Infinity;
                  const anticipatedSeparationTime = 2.5; // 2-3초의 중간값
                  
                  if (timeToReachREL <= anticipatedSeparationTime) {
                    line.active = false; // 안전 통과를 위해 미리 소등
                  }
                }
              });
            });
            
            // Airborne (고도 > 200ft) 항공기가 있으면 모든 REL 소등
            if (takeoffAircraft.some(aircraft => aircraft.altitude > 200)) {
              line.active = false;
            }
          } else {
            // 활주로에 고속 트래픽(30kt 이상)이 없을 때만 유도로 택시 감지
            const hasHighSpeedTraffic = runwayTraffic.some(aircraft => 
              aircraft.speed >= 30 && aircraft.altitude < 100
            );
            
            if (!hasHighSpeedTraffic) {
              // 활주로에 고속 트래픽이 없을 때만 유도로 택시 감지
            // 이륙 항공기가 없으면 접근하는 유도로 항공기 확인 (공간 인덱싱 활용)
            const relMidpoint = {
              lat: (line.points[0].y + line.points[1].y) / 2,
              lng: (line.points[0].x + line.points[1].x) / 2
            };
            
            // REL 주변 그리드의 항공기만 검사 (성능 최적화)
            const nearbyAircraft: TrackedAircraft[] = [];
            const gridKeys = getNearbyGridKeys(relMidpoint.lat, relMidpoint.lng);
            gridKeys.forEach(key => {
              const gridAircraft = aircraftSpatialIndex.get(key) || [];
              nearbyAircraft.push(...gridAircraft);
            });
            
            // REL 방향 벡터 계산
            const relVector = {
              x: line.points[1].x - line.points[0].x,
              y: line.points[1].y - line.points[0].y
            };
            
            // D = Departure (TO RWY), A = Arrival (FROM RWY)
            const isDepartureREL = line.id.endsWith('D');
            
            // REL 방향 계산 (시각화와 동일하게)
            const length = Math.sqrt(relVector.x * relVector.x + relVector.y * relVector.y);
            const relNormalized = {
              x: relVector.x / length,
              y: relVector.y / length
            };
            
            // 등화 방향 (시각화의 toRunwayVector와 동일)
            const perpVector = isDepartureREL ? 
              { x: -relNormalized.y, y: relNormalized.x } :  // 왼쪽 90도
              { x: relNormalized.y, y: -relNormalized.x };   // 오른쪽 90도
            
            const toRunwayVector = isDepartureREL ? 
              { x: perpVector.y, y: -perpVector.x } :   // TO RWY(D)
              { x: -perpVector.y, y: perpVector.x };     // FROM RWY(A)
            
            // REL 감지 방향 (도 단위)
            const detectionDirection = Math.atan2(toRunwayVector.y, toRunwayVector.x) * 180 / Math.PI;
            
            // REL 주변 항공기 확인 (부채꼴 감지 영역)
            let hasObstacle = false;
            
            nearbyAircraft.forEach(aircraft => {
              if (aircraft.altitude > 50) return; // 지상 항공기만
              if (aircraft.speed < 10 || aircraft.speed > 50) return; // 택시 속도만
              
              const distance = calculateDistanceHelper(
                aircraft.latitude, aircraft.longitude,
                relMidpoint.lat, relMidpoint.lng
              );
              
              // REL 감지 영역: 50-200m 반경
              if (distance >= 50 && distance <= 200) {
                // 항공기가 감지 영역(부채꼴) 내에 있는지 확인
                const dLng = aircraft.longitude - relMidpoint.lng;
                const dLat = aircraft.latitude - relMidpoint.lat;
                const bearingFromREL = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
                
                // 감지 방향과의 각도 차이
                let angleDiff = Math.abs(bearingFromREL - detectionDirection);
                if (angleDiff > 180) angleDiff = 360 - angleDiff;
                
                // 부채꼴 영역 내에 있으면 활성화 (±45도 = 90도 섹터)
                if (angleDiff <= 45) {
                  hasObstacle = true;
                }
              }
            });
            
            // 장애물이 있으면 REL 활성화 (정지 신호)
            line.active = hasObstacle;
            }
          }
        } else {
          line.active = false; // 매핑되지 않은 REL은 비활성화
        }
      }
    });

    // RIL (Runway Intersection Lights) 제어 로직 - 충돌 예측 포함
    updatedLines.forEach(line => {
      if (line.type === 'RIL') {
        // 교차 활주로에서 동시에 운용 중인 항공기 확인
        const runway1Traffic = runwayTrafficByRunway['14L/32R'] || [];
        const runway2Traffic = runwayTrafficByRunway['14R/32L'] || [];
        
        // 두 활주로 모두에 트래픽이 있는 경우
        if (runway1Traffic.length > 0 && runway2Traffic.length > 0) {
          // 충돌 가능성 계산
          let minTimeToConflict = Infinity;
          
          runway1Traffic.forEach(ac1 => {
            runway2Traffic.forEach(ac2 => {
              // 교차점 위치 (김포공항 활주로 교차점)
              const intersectionPoint = { lat: 37.5581, lng: 126.7912 };
              
              const timeToConflict = calculateTimeToConflict(
                ac1, ac2, intersectionPoint
              );
              
              if (timeToConflict < minTimeToConflict) {
                minTimeToConflict = timeToConflict;
              }
            });
          });
          
          // 15초 이내 충돌 예상시 RIL 활성화
          line.active = minTimeToConflict < 15;
        } else {
          // 기본 로직: 어느 활주로든 이착륙 활동이 있을 때 활성화
          const hasAnyRunwayTraffic = runway1Traffic.length > 0 || runway2Traffic.length > 0;
          line.active = hasAnyRunwayTraffic;
        }
      }
    });
    
    // 활주로 점유 시간 추적
    const now = Date.now();
    setRunwayOccupancyTime(prev => {
      const newOccupancy = new Map(prev);
      
      Object.entries(runwayTrafficByRunway).forEach(([runwayId, traffic]) => {
        const runwayMap = newOccupancy.get(runwayId) || new Map();
        
        traffic.forEach(aircraft => {
          const prevTime = runwayMap.get(aircraft.id) || 0;
          const newTime = prevTime + 0.1; // 0.1초 증가
          runwayMap.set(aircraft.id, newTime);
          
          // 긴급 상황: 60초 이상 활주로 점유
          if (newTime > 60) {
            // console.warn(`경고: ${aircraft.callsign}이 ${runwayId} 활주로를 ${newTime}초간 점유 중`);
          }
        });
        
        // 활주로를 벗어난 항공기 제거
        Array.from(runwayMap.keys()).forEach(aircraftId => {
          if (!traffic.find(ac => ac.id === aircraftId)) {
            runwayMap.delete(aircraftId);
          }
        });
        
        newOccupancy.set(runwayId, runwayMap);
      });
      
      return newOccupancy;
    });
    
    // 성능 측정 결과 (개발 모드에서만)
    const endTime = performance.now();
    // 성능 측정 로그 비활성화 (성능 개선)

    return updatedLines;
  }, [aircraftHistory, systemHealthStatus, weatherData, aircraftSpatialIndex, localRunways]);

  // RWSL 초기화 - 앱 시작 시 한 번만 실행
  useEffect(() => {
    if (rwslLines.length === 0) {
      const initialRwslLines = generateGimpoRWSL();
      setRwslLines(initialRwslLines);
      
      // 디버깅: 생성된 REL 확인 (로그 비활성화)
      // const b1d = initialRwslLines.find(l => l.id === 'REL_B1_D');
      // const b2d = initialRwslLines.find(l => l.id === 'REL_B2_D');
      // console.log('🔍 REL_B1_D 존재:', !!b1d);
      // console.log('🔍 REL_B2_D 존재:', !!b2d);
      // console.log('🔍 전체 REL 목록:', initialRwslLines.filter(l => l.type === 'REL').map(l => l.id));
    }
  }, []);


  // RWSL 자동화를 위한 상태 업데이트 - 데이터 도착 시 즉시 갱신
  useEffect(() => {
    if (aircraft.length > 0 && rwslLines.length > 0) {
      const updatedRwslLines = updateRWSLAutomation(aircraft, rwslLines);
      
      // 상태가 변경된 경우에만 업데이트
      const hasChanges = updatedRwslLines.some((line, index) => 
        line.active !== rwslLines[index]?.active
      );
      
      if (hasChanges) {
        setRwslLines(updatedRwslLines);
      }
    }
  }, [aircraft, rwslLines, updateRWSLAutomation]);

  // Load Gimpo airport vector map
  useEffect(() => {
    const img = new Image();
    img.src = '/rkss-map.svg';
    img.onload = () => {
      setMapImage(img);
    };
  }, []);
  
  // OSM 토글 시 타일 정리
  useEffect(() => {
    if (!showOSMMap) {
      // OSM이 꺼지면 로딩 큐만 정리, 캐시는 유지
      loadingTilesRef.current.clear();
      tileLoadQueueRef.current.clear();
      // 타일 캐시는 유지하여 다시 켤 때 빠르게 표시
    }
  }, [showOSMMap]);
  
  // OSM 타일 계산 함수
  const latLngToTile = (lat: number, lng: number, zoom: number) => {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
  };
  
  // OSM 타일 로드 - 개선된 캐싱 전략
  const loadOSMTile = useCallback((tileX: number, tileY: number, zoom: number) => {
    const key = `${zoom}/${tileX}/${tileY}`;
    
    // 영구 캐시에서 먼저 확인
    if (tileCache.has(key)) {
      // 캐시에 있으면 현재 타일 맵에 추가
      if (!osmTiles.has(key)) {
        setOsmTiles(prev => {
          const newMap = new Map(prev);
          newMap.set(key, tileCache.get(key)!);
          return newMap;
        });
      }
      return;
    }
    
    // 이미 로딩 중이면 스킵
    if (loadingTilesRef.current.has(key)) return;
    
    // 동시 로딩 제한 (최대 16개로 증가 - 더 빠른 로딩)
    if (loadingTilesRef.current.size >= 16) {
      tileLoadQueueRef.current.add(key);
      return;
    }
    
    loadingTilesRef.current.add(key);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // 여러 서브도메인 사용하여 로드 분산
    const subdomain = ['a', 'b', 'c'][Math.floor(Math.random() * 3)];
    img.src = `https://${subdomain}.tile.openstreetmap.org/${key}.png`;
    
    img.onload = () => {
      // 영구 캐시와 현재 타일 맵 모두에 저장
      setTileCache(prev => {
        const newCache = new Map(prev);
        newCache.set(key, img);
        return newCache;
      });
      
      setOsmTiles(prev => {
        const newMap = new Map(prev);
        newMap.set(key, img);
        return newMap;
      });
      
      loadingTilesRef.current.delete(key);
      
      // 대기 중인 타일 로드
      const next = Array.from(tileLoadQueueRef.current)[0];
      if (next) {
        tileLoadQueueRef.current.delete(next);
        const [z, x, y] = next.split('/').map(Number);
        loadOSMTile(x, y, z);
      }
    };
    
    img.onerror = () => {
      loadingTilesRef.current.delete(key);
      // 에러는 무시 (조용히 실패)
    };
  }, [tileCache, osmTiles]); // 의존성 업데이트
  
  // 영구 캐시 정리 - 매우 많은 타일이 쌓였을 때만 (1000개 이상)
  useEffect(() => {
    if (tileCache.size < 1000) return; // 1000개 이상일 때만 정리
    
    // 가장 오래된 타일부터 제거 (FIFO)
    setTileCache(prev => {
      const newCache = new Map();
      const entries = Array.from(prev.entries());
      // 최근 500개만 유지
      entries.slice(-500).forEach(([key, img]) => {
        newCache.set(key, img);
      });
      return newCache;
    });
  }, [tileCache.size]);
  
  // 줌 레벨 변경 감지 및 캐시에서 타일 복원
  useEffect(() => {
    if (!showOSMMap) return;
    
    const zoom = Math.max(12, Math.min(17, Math.floor(14 + Math.log2(scale))));
    
    // 줌 레벨이 변경되었을 때
    if (zoom !== lastZoomLevelRef.current) {
      lastZoomLevelRef.current = zoom;
      
      // 현재 줌 레벨의 타일을 캐시에서 복원
      const restoredTiles = new Map();
      tileCache.forEach((img, key) => {
        const [z] = key.split('/').map(Number);
        if (z === zoom) {
          restoredTiles.set(key, img);
        }
      });
      
      // 복원된 타일로 osmTiles 업데이트
      setOsmTiles(prev => {
        const newMap = new Map(restoredTiles);
        // 기존 타일 중 현재 줌 레벨의 타일만 유지
        prev.forEach((img, key) => {
          const [z] = key.split('/').map(Number);
          if (z === zoom && !newMap.has(key)) {
            newMap.set(key, img);
          }
        });
        return newMap;
      });
    }
  }, [scale, showOSMMap, tileCache]);
  
  // 항공기 데이터 업데이트 - 0.1초 간격 데이터이므로 보간 불필요
  useEffect(() => {
    const newDisplayed = new Map<number, TrackedAircraft>();
    aircraft.forEach(ac => {
      newDisplayed.set(ac.id, ac);
    });
    setDisplayedAircraft(newDisplayed);
  }, [aircraft]);
  

  // 표시할 항공기 데이터
  const displayAircraft = Array.from(displayedAircraft.values());
  
  const latLngToCanvas = (lat: number, lng: number) => {
    // 정확한 좌표 변환 - 김포공항 위도에서의 실제 거리 계산
    // 위도 1도 = 약 111km (어디서나 동일)
    // 경도 1도 = 약 111km * cos(위도) (위도에 따라 달라짐)
    
    // 김포공항 위도(37.5587°)에서의 경도 1도 거리
    const latRadians = GIMPO_CENTER.lat * Math.PI / 180;
    const kmPerDegreeLat = 111.0; // km
    const kmPerDegreeLng = 111.0 * Math.cos(latRadians); // 약 88.5km at 37.5°
    
    // 20km 범위를 800픽셀에 맞추기 (40픽셀/km)
    const pixelsPerKm = 40 * scale;
    const pixelsPerDegreeLat = kmPerDegreeLat * pixelsPerKm;
    const pixelsPerDegreeLng = kmPerDegreeLng * pixelsPerKm;
    
    const x = (lng - GIMPO_CENTER.lng) * pixelsPerDegreeLng + CANVAS_SIZE.width / 2 + panX;
    const y = (GIMPO_CENTER.lat - lat) * pixelsPerDegreeLat + CANVAS_SIZE.height / 2 + panY;
    return { x, y };
  };
  
  // Canvas 좌표를 위경도로 변환하는 역함수
  const canvasToLatLng = (x: number, y: number) => {
    const latRadians = GIMPO_CENTER.lat * Math.PI / 180;
    const kmPerDegreeLat = 111.0;
    const kmPerDegreeLng = 111.0 * Math.cos(latRadians);
    
    const pixelsPerKm = 40 * scale;
    const pixelsPerDegreeLat = kmPerDegreeLat * pixelsPerKm;
    const pixelsPerDegreeLng = kmPerDegreeLng * pixelsPerKm;
    
    const lng = ((x - CANVAS_SIZE.width / 2 - panX) / pixelsPerDegreeLng) + GIMPO_CENTER.lng;
    const lat = GIMPO_CENTER.lat - ((y - CANVAS_SIZE.height / 2 - panY) / pixelsPerDegreeLat);
    
    return { lat, lng };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 렌더링 성능 측정
    const renderStartTime = performance.now();

    // 캔버스 최적화 설정
    optimizeCanvas(ctx);
    
    // FPS 모니터링이 켜져있을 때만 업데이트
    if (showFPS && fpsMonitorRef.current) {
      fpsMonitorRef.current.update();
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);
    
    // Set canvas background
    ctx.fillStyle = '#0a0f1b';
    ctx.fillRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);
    
    // FPS 모니터링
    if (showFPS) {
      const fps = fpsMonitorRef.current.update();
      setCurrentFPS(fps);
    }
    
    // Draw OSM tiles if enabled
    if (showOSMMap) {
      ctx.save();
      ctx.globalAlpha = 0.3; // 더 투명하게 조정하여 항공기가 잘 보이도록
      
      // 현재 보이는 영역에 필요한 타일 계산
      const zoom = Math.max(12, Math.min(17, Math.floor(14 + Math.log2(scale)))); // 줌 레벨 제한
      const tileSize = 256;
      
      // 줌 레벨이 변경되었는지 확인
      if (zoom !== lastZoomLevelRef.current) {
        lastZoomLevelRef.current = zoom;
        
        // 줌 레벨 변경 시 현재 뷰포트에 필요한 타일만 osmTiles에 유지
        const topLeft = canvasToLatLng(-200, -200);
        const bottomRight = canvasToLatLng(CANVAS_SIZE.width + 200, CANVAS_SIZE.height + 200);
        const minTile = latLngToTile(topLeft.lat, topLeft.lng, zoom);
        const maxTile = latLngToTile(bottomRight.lat, bottomRight.lng, zoom);
        
        setOsmTiles(prev => {
          const newMap = new Map();
          // 현재 줌 레벨의 타일만 유지
          for (let tileX = minTile.x - 2; tileX <= maxTile.x + 2; tileX++) {
            for (let tileY = minTile.y - 2; tileY <= maxTile.y + 2; tileY++) {
              const key = `${zoom}/${tileX}/${tileY}`;
              if (tileCache.has(key)) {
                newMap.set(key, tileCache.get(key)!);
              }
            }
          }
          return newMap;
        });
      }
      
      // 화면의 실제 위경도 범위 계산 - pan 값 올바르게 적용
      const topLeft = canvasToLatLng(0, 0);
      const bottomRight = canvasToLatLng(CANVAS_SIZE.width, CANVAS_SIZE.height);
      
      // 필요한 타일 범위 계산
      const minTile = latLngToTile(topLeft.lat, topLeft.lng, zoom);
      const maxTile = latLngToTile(bottomRight.lat, bottomRight.lng, zoom);
      
      // 여유분을 두고 타일 로드 및 그리기 (화면 밖 2타일씩 추가)
      for (let tileX = minTile.x - 2; tileX <= maxTile.x + 2; tileX++) {
        for (let tileY = minTile.y - 2; tileY <= maxTile.y + 2; tileY++) {
          const key = `${zoom}/${tileX}/${tileY}`;
          
          // 타일 로드
          loadOSMTile(tileX, tileY, zoom);
          
          // 타일 그리기
          const tile = osmTiles.get(key) || tileCache.get(key);
          if (tile && tile.complete) {
            // 타일의 위경도 계산
            const n = Math.pow(2, zoom);
            const tileLngMin = (tileX / n) * 360 - 180;
            const tileLngMax = ((tileX + 1) / n) * 360 - 180;
            const tileLatMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI;
            const tileLatMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tileY + 1) / n))) * 180 / Math.PI;
            
            // 타일의 네 모서리 좌표 계산
            const topLeftPos = latLngToCanvas(tileLatMax, tileLngMin);
            const bottomRightPos = latLngToCanvas(tileLatMin, tileLngMax);
            
            const width = bottomRightPos.x - topLeftPos.x;
            const height = bottomRightPos.y - topLeftPos.y;
            
            ctx.drawImage(tile, topLeftPos.x, topLeftPos.y, width, height);
          }
        }
      }
      
      ctx.restore();
    }

    // Draw Gimpo airport map if loaded
    if (mapImage) {
      ctx.save();
      ctx.globalAlpha = 0.8; // 더 선명하게
      
      // 공항 크기 조정 - SVG 원본 비율 유지 (3606.23:1834.61 ≈ 1.97:1)
      const mapScale = scale * mapScaleAdjust;
      const mapWidth = 400 * mapScale;
      const mapHeight = 203 * mapScale;  // 400/1.97 ≈ 203
      
      // 김포공항 실제 중심점으로 SVG 배치
      const gimpoPos = latLngToCanvas(GIMPO_CENTER.lat, GIMPO_CENTER.lng);
      
      // 동적 각도 회전 적용
      ctx.translate(gimpoPos.x, gimpoPos.y);
      ctx.rotate((mapRotation * Math.PI) / 180); // 각도를 라디안으로 변환
      
      // 회전된 상태에서 이미지 그리기 - SVG 내부 중심점 보정
      // 국제선 청사(게이트 37, 38)가 우상단에 위치하도록 오프셋 조정
      // APJ732: 37.56789, 126.8008 (게이트 37)
      // CSN318: 37.568461, 126.801447 (게이트 38)
      // 김포공항 중심에서 게이트까지의 거리를 고려한 오프셋
      // 오프셋은 scale과 독립적으로 적용
      const gateOffsetX = 1; // 오프셋 최소화
      const gateOffsetY = 1; // 오프셋 최소화
      
      const offsetX = -mapWidth / 2 - gateOffsetX + mapOffsetX * scale;
      const offsetY = -mapHeight / 2 - gateOffsetY + mapOffsetY * scale;
      ctx.drawImage(mapImage, offsetX, offsetY, mapWidth, mapHeight);
      
      ctx.restore();
    }

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([5, 5]);
    for (let i = 0; i <= CANVAS_SIZE.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_SIZE.height);
      ctx.stroke();
    }
    for (let i = 0; i <= CANVAS_SIZE.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_SIZE.width, i);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw aircraft symbols first (without data blocks)
    displayAircraft.forEach((ac) => {
      const pos = latLngToCanvas(ac.latitude, ac.longitude);
      
      // 뷰포트 컬링 (성능 최적화)
      if (!isInViewport(pos.x, pos.y, CANVAS_SIZE.width, CANVAS_SIZE.height, 50)) {
        return;
      }

      // Draw aircraft symbol
      ctx.save();
      ctx.translate(pos.x, pos.y);
      // 푸시백 감지: 음수 속도는 푸시백
      const isPushback = ac.speed < -2;
      const displayHeading = isPushback ? (ac.heading + 180) % 360 : ac.heading;
      ctx.rotate((displayHeading * Math.PI) / 180);
      
      // Aircraft color based on status - 더 밝고 선명한 색상 사용
      let color = '#3b82f6'; // 더 밝은 파란색
      if (ac.isEmergency) color = '#dc2626'; // 더 선명한 빨간색
      else if (!ac.isActive || ac.speed === 0) color = '#9ca3af'; // 더 밝은 회색
      else if (ac.altitude < 1000) color = '#f59e0b'; // 더 선명한 노란색
      else if (ac.altitude > 10000) color = '#10b981'; // 더 선명한 초록색
      
      // Draw aircraft as empty circle with background for better visibility
      ctx.fillStyle = showOSMMap ? 'rgba(0, 0, 0, 0.5)' : 'transparent'; // OSM 사용시 반투명 검은 배경
      ctx.strokeStyle = selectedAircraft?.id === ac.id ? '#ffffff' : color;
      ctx.lineWidth = selectedAircraft?.id === ac.id ? 3 : 2; // 더 두꺼운 선
      
      // Empty circle for aircraft position
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, 2 * Math.PI); // 더 큰 원 (5px)
      ctx.fill(); // 배경 채우기
      ctx.stroke();
      
      // Direction indicator - speed-based length
      ctx.strokeStyle = selectedAircraft?.id === ac.id ? '#ffffff' : color;
      ctx.lineWidth = 2; // 더 두꺼운 방향선
      
      // 속도에 따른 방향선 길이 계산 (기본 5px + 속도에 따라 0-15px 추가)
      const baseLength = 5; // 기본 길이
      const speedLength = Math.min(15, Math.max(0, ac.speed * 0.03));
      const lineLength = baseLength + speedLength;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -lineLength); // 속도 기반 방향 표시선
      ctx.stroke();
      
      ctx.restore();
      
      // 항공기 예상 경로 표시
      if (showAircraftPaths && ac.speed > 10) {
        ctx.save();
        ctx.strokeStyle = selectedAircraft?.id === ac.id ? '#ffffff' : color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.globalAlpha = 0.5;
        
        // 현재 속도와 방향으로 1분 후 위치 예측
        const speedKmPerMin = ac.speed * 1.852 / 60; // knots to km/min
        const headingRad = ac.heading * Math.PI / 180;
        
        // 위경도 변환 (대략적)
        const latChange = speedKmPerMin * Math.cos(headingRad) / 111;
        const lngChange = speedKmPerMin * Math.sin(headingRad) / (111 * Math.cos(ac.latitude * Math.PI / 180));
        
        const futurePos = latLngToCanvas(
          ac.latitude + latChange,
          ac.longitude + lngChange
        );
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(futurePos.x, futurePos.y);
        ctx.stroke();
        
        // 30초 마크
        const halfwayPos = latLngToCanvas(
          ac.latitude + latChange / 2,
          ac.longitude + lngChange / 2
        );
        ctx.beginPath();
        ctx.arc(halfwayPos.x, halfwayPos.y, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.restore();
      }
    });

    // Draw range rings - 더 현실적인 거리로 수정
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    const center = latLngToCanvas(GIMPO_CENTER.lat, GIMPO_CENTER.lng);
    
    // 2km, 5km, 10km, 15km, 20km - 공항 레이더에 적합한 거리
    [2, 5, 10, 15, 20].forEach((km) => {
      // 1km = 약 0.009 도 (위도 기준)
      const radiusInDegrees = km * 0.009;
      const radiusInPixels = radiusInDegrees * 4000 * scale; // 80000 -> 4000으로 맞춤
      
      ctx.beginPath();
      ctx.arc(center.x, center.y, radiusInPixels, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Range label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`${km}km`, center.x + radiusInPixels - 20, center.y - 5);
    });
    ctx.setLineDash([]);
    
    // RWSL 등화 그리기 (항상 표시)
    rwslLines.forEach(line => {
        if (line.points.length < 1) return;
        
        ctx.save();
        
        // 타입에 따른 색상
        const colors = {
          'REL': { active: '#ff0000', inactive: '#00ff00' },
          'THL': { active: '#ff3333', inactive: '#00ff00' },
          'RIL': { active: '#ff6666', inactive: '#00ff00' }
        };
        
        const color = line.active ? colors[line.type].active : colors[line.type].inactive;
        
        if (line.active) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
        }
        
        if (line.points.length >= 2) {
          // REL, THL, RIL 모두 라인으로 표시
          ctx.strokeStyle = color;
          ctx.lineWidth = line.active ? 4 : 3;
          
          ctx.beginPath();
          const firstPoint = latLngToCanvas(line.points[0].y, line.points[0].x);
          ctx.moveTo(firstPoint.x, firstPoint.y);
          
          for (let i = 1; i < line.points.length; i++) {
            const point = latLngToCanvas(line.points[i].y, line.points[i].x);
            ctx.lineTo(point.x, point.y);
          }
          
          ctx.stroke();
          
          // 방향성 표시 (REL과 THL)
          if (showLightDirections && (line.type === 'REL' || line.type === 'THL')) {
            const start = latLngToCanvas(line.points[0].y, line.points[0].x);
            const end = latLngToCanvas(line.points[line.points.length - 1].y, line.points[line.points.length - 1].x);
            const midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
            
            // 등화 방향 벡터
            const lightVector = { x: end.x - start.x, y: end.y - start.y };
            const lightLength = Math.sqrt(lightVector.x * lightVector.x + lightVector.y * lightVector.y);
            lightVector.x /= lightLength;
            lightVector.y /= lightLength;
            
            if (line.type === 'REL') {
              // REL: 활주로 방향 표시
              // D = Departure (TO RWY), A = Arrival (FROM RWY)
              const isDepartureREL = line.id.endsWith('D');
              
              // 기존 perpVector 방향에서 90도 회전
              // FROM RWY(A)는 반시계방향 90도, TO RWY(D)는 시계방향 90도
              const perpVector = isDepartureREL ? 
                { x: -lightVector.y, y: lightVector.x } :  // 왼쪽 90도 (활주로 방향)
                { x: lightVector.y, y: -lightVector.x };   // 오른쪽 90도 (활주로 방향)
              
              // 화살표 방향: FROM RWY(A)는 perpVector를 반시계 90도, TO RWY(D)는 시계 90도 (180도 회전)
              const arrowVector = isDepartureREL ? 
                { x: perpVector.y, y: -perpVector.x } :   // TO RWY(D): perpVector를 시계방향 90도 + 180도
                { x: -perpVector.y, y: perpVector.x };     // FROM RWY(A): perpVector를 반시계방향 90도 + 180도
              
              // 화살표 그리기
              ctx.save();
              ctx.strokeStyle = line.active ? '#ffff00' : '#888888';
              ctx.fillStyle = line.active ? '#ffff00' : '#888888';
              ctx.lineWidth = 2;
              
              const arrowStart = { 
                x: midPoint.x - arrowVector.x * 15, 
                y: midPoint.y - arrowVector.y * 15 
              };
              const arrowEnd = { 
                x: midPoint.x + arrowVector.x * 25, 
                y: midPoint.y + arrowVector.y * 25 
              };
              
              // 화살표 선
              ctx.beginPath();
              ctx.moveTo(arrowStart.x, arrowStart.y);
              ctx.lineTo(arrowEnd.x, arrowEnd.y);
              ctx.stroke();
              
              // 화살표 머리
              ctx.beginPath();
              ctx.moveTo(arrowEnd.x, arrowEnd.y);
              ctx.lineTo(arrowEnd.x - arrowVector.x * 8 - arrowVector.y * 5, arrowEnd.y - arrowVector.y * 8 + arrowVector.x * 5);
              ctx.lineTo(arrowEnd.x - arrowVector.x * 8 + arrowVector.y * 5, arrowEnd.y - arrowVector.y * 8 - arrowVector.x * 5);
              ctx.closePath();
              ctx.fill();
              
              // 방향 텍스트
              ctx.font = '10px monospace';
              ctx.fillText(isDepartureREL ? 'TO RWY' : 'FROM RWY', arrowEnd.x + 5, arrowEnd.y);
              
              ctx.restore();
            } else if (line.type === 'THL') {
              // THL: 활주로 시작점 표시
              ctx.save();
              ctx.fillStyle = line.active ? '#ff0000' : '#888888';
              ctx.font = 'bold 12px monospace';
              
              // 삼각형으로 활주로 방향 표시
              ctx.beginPath();
              const triangleSize = 10;
              ctx.moveTo(midPoint.x + lightVector.x * triangleSize, midPoint.y + lightVector.y * triangleSize);
              ctx.lineTo(midPoint.x - lightVector.x * triangleSize - lightVector.y * triangleSize/2, 
                        midPoint.y - lightVector.y * triangleSize + lightVector.x * triangleSize/2);
              ctx.lineTo(midPoint.x - lightVector.x * triangleSize + lightVector.y * triangleSize/2, 
                        midPoint.y - lightVector.y * triangleSize - lightVector.x * triangleSize/2);
              ctx.closePath();
              ctx.fill();
              
              ctx.restore();
            }
          }
          
          // 등화 이름 표시
          if (line.id) {
            // 라인의 중점에 이름 표시
            const midPoint = latLngToCanvas(
              (line.points[0].y + line.points[line.points.length - 1].y) / 2,
              (line.points[0].x + line.points[line.points.length - 1].x) / 2
            );
            
            // 배경 박스
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const textWidth = ctx.measureText(line.id).width + 6;
            ctx.fillRect(midPoint.x - textWidth/2, midPoint.y - 10, textWidth, 16);
            
            // 텍스트
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(line.id, midPoint.x, midPoint.y + 2);
            ctx.textAlign = 'left'; // reset
          }
        }
        
        ctx.restore();
      });
    
    // 그리기 모드에서 현재 그리는 중인 라인 표시
    if (isDrawingRWSL && drawingPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      const firstPoint = latLngToCanvas(drawingPoints[0].y, drawingPoints[0].x);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < drawingPoints.length; i++) {
        const point = latLngToCanvas(drawingPoints[i].y, drawingPoints[i].x);
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 시각화 요소들 그리기
    
    // 활주로 중심선 시각화
    if (showRunwayLines) {
      ctx.save();
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      
      localRunways.forEach(runway => {
        const start = latLngToCanvas(runway.centerline.start.lat, runway.centerline.start.lng);
        const end = latLngToCanvas(runway.centerline.end.lat, runway.centerline.end.lng);
        
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        
        // 활주로 이름 표시 (양쪽 끝에 표시)
        const midPoint = {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2
        };
        
        // 중앙 이름
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.fillRect(midPoint.x - 30, midPoint.y - 8, 60, 16);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(runway.id, midPoint.x, midPoint.y + 4);
        
        // 시작점과 끝점에 방향 표시
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 8px monospace';
        
        // 시작점 (14L 또는 14R)
        const startLabel = runway.id.includes('14L') ? '14L' : '14R';
        ctx.fillRect(start.x - 15, start.y - 6, 30, 12);
        ctx.fillStyle = '#000000';
        ctx.fillText(startLabel, start.x, start.y + 2);
        
        // 끝점 (32R 또는 32L)  
        const endLabel = runway.id.includes('32R') ? '32R' : '32L';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(end.x - 15, end.y - 6, 30, 12);
        ctx.fillStyle = '#000000';
        ctx.fillText(endLabel, end.x, end.y + 2);
        
        // 좌표 디버깅 정보 표시
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.font = '8px monospace';
        ctx.fillText(`Start: ${runway.centerline.start.lat.toFixed(4)}, ${runway.centerline.start.lng.toFixed(4)}`, start.x + 20, start.y - 10);
        ctx.fillText(`End: ${runway.centerline.end.lat.toFixed(4)}, ${runway.centerline.end.lng.toFixed(4)}`, end.x + 20, end.y + 15);
        
        ctx.textAlign = 'left';
      });
      
      ctx.setLineDash([]);
      ctx.restore();
    }

    // REL 감지 섹터 시각화
    if (showDetectionSectors) {
      ctx.save();
      
      rwslLines.filter(line => line.type === 'REL').forEach(line => {
        // REL이 어느 활주로에 연결되어 있는지 확인
        let relevantRunway = '';
        Object.keys(RUNWAY_TAXIWAY_MAPPING).forEach(runwayId => {
          if (RUNWAY_TAXIWAY_MAPPING[runwayId as keyof typeof RUNWAY_TAXIWAY_MAPPING].connectedRELs.includes(line.id)) {
            relevantRunway = runwayId;
          }
        });
        
        // 현재 활주로에 이륙 항공기가 있는지 간단히 확인
        const hasTakeoffAircraft = displayAircraft.some(ac => {
          if (ac.altitude > 100) return false;
          if (ac.speed < 30) return false;
          
          // 해당 활주로 근처에 있는지 확인
          const runway = localRunways.find(r => r.id === relevantRunway);
          if (!runway) return false;
          
          const dist14 = calculateDistanceHelper(
            ac.latitude, ac.longitude,
            runway.centerline.start.lat, runway.centerline.start.lng
          );
          const dist32 = calculateDistanceHelper(
            ac.latitude, ac.longitude,
            runway.centerline.end.lat, runway.centerline.end.lng
          );
          
          return Math.min(dist14, dist32) < 1000; // 1km 이내
        });
        const start = { lat: line.points[0].y, lng: line.points[0].x };
        const end = { lat: line.points[1].y, lng: line.points[1].x };
        const midpoint = {
          lat: (start.lat + end.lat) / 2,
          lng: (start.lng + end.lng) / 2
        };
        
        const centerPoint = latLngToCanvas(midpoint.lat, midpoint.lng);
        const startPoint = latLngToCanvas(start.lat, start.lng);
        const endPoint = latLngToCanvas(end.lat, end.lng);
        
        // REL 방향 벡터
        const relVector = {
          x: endPoint.x - startPoint.x,
          y: endPoint.y - startPoint.y
        };
        
        // REL에서 활주로로 향하는 방향 (등화 방향 표시와 동일하게)
        // D = Departure (TO RWY), A = Arrival (FROM RWY)
        const isDepartureREL = line.id.endsWith('D');
        // 등화 방향과 동일하게 설정
        const perpVector = isDepartureREL ? 
          { x: -relVector.y, y: relVector.x } :  // 왼쪽 90도 (활주로 방향)
          { x: relVector.y, y: -relVector.x };   // 오른쪽 90도 (활주로 방향)
        
        // 감지 방향: 등화 화살표 방향과 동일
        const toRunwayVector = isDepartureREL ? 
          { x: perpVector.y, y: -perpVector.x } :   // TO RWY(D): perpVector를 시계방향 90도
          { x: -perpVector.y, y: perpVector.x };     // FROM RWY(A): perpVector를 반시계방향 90도
        
        // 정규화
        const length = Math.sqrt(toRunwayVector.x * toRunwayVector.x + toRunwayVector.y * toRunwayVector.y);
        toRunwayVector.x /= length;
        toRunwayVector.y /= length;
        
        // 이륙 항공기가 있으면 거리 제한 없이 방향만 표시
        if (hasTakeoffAircraft) {
          // 이륙 모드: 방향성만 표시 (거리 제한 없음)
          ctx.strokeStyle = line.active ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 100, 100, 0.4)';
          ctx.lineWidth = 3;
          
          // 방향 표시 (큰 화살표)
          const arrowLength = 100 / 111000 * 4000 * scale;
          const arrowEnd = {
            x: centerPoint.x + toRunwayVector.x * arrowLength,
            y: centerPoint.y + toRunwayVector.y * arrowLength
          };
          
          ctx.beginPath();
          ctx.moveTo(centerPoint.x, centerPoint.y);
          ctx.lineTo(arrowEnd.x, arrowEnd.y);
          ctx.stroke();
          
          // 화살표 머리
          const headLength = 20;
          const headAngle = Math.PI / 6;
          const arrowAngle = Math.atan2(toRunwayVector.y, toRunwayVector.x);
          ctx.beginPath();
          ctx.moveTo(arrowEnd.x, arrowEnd.y);
          ctx.lineTo(
            arrowEnd.x - Math.cos(arrowAngle - headAngle) * headLength,
            arrowEnd.y - Math.sin(arrowAngle - headAngle) * headLength
          );
          ctx.moveTo(arrowEnd.x, arrowEnd.y);
          ctx.lineTo(
            arrowEnd.x - Math.cos(arrowAngle + headAngle) * headLength,
            arrowEnd.y - Math.sin(arrowAngle + headAngle) * headLength
          );
          ctx.stroke();
          
          // "이륙" 라벨
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('이륙', centerPoint.x, centerPoint.y - 30);
        } else {
          // 유도로 택시 모드: 50-200m 섹터
          ctx.strokeStyle = line.active ? 'rgba(255, 255, 0, 0.6)' : 'rgba(100, 100, 100, 0.4)';
          ctx.fillStyle = line.active ? 'rgba(255, 255, 0, 0.1)' : 'rgba(100, 100, 100, 0.05)';
          ctx.lineWidth = 2;
          
          const innerRadius = 50 / 111000 * 4000 * scale;
          const outerRadius = 200 / 111000 * 4000 * scale;
          
          // 섹터 각도 계산
          const centerAngle = Math.atan2(toRunwayVector.y, toRunwayVector.x);
          const sectorAngle = Math.PI / 4; // 45도 양쪽 = 90도 섹터
          
          ctx.beginPath();
          ctx.arc(centerPoint.x, centerPoint.y, innerRadius, centerAngle - sectorAngle, centerAngle + sectorAngle);
          ctx.arc(centerPoint.x, centerPoint.y, outerRadius, centerAngle + sectorAngle, centerAngle - sectorAngle, true);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // "택시" 라벨
          ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('택시', centerPoint.x, centerPoint.y - 20);
        }
        
      });
      
      ctx.restore();
    }
    
    // 등화 위치 시각화 (디버깅용)
    if (showLightPositions) {
      ctx.save();
      ctx.font = '10px monospace';
      ctx.fillStyle = '#00ff00';
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      
      rwslLines.forEach(line => {
        // 각 등화의 시작점과 끝점에 원 그리기
        const start = latLngToCanvas(line.points[0].y, line.points[0].x);
        const end = latLngToCanvas(line.points[1].y, line.points[1].x);
        
        // 시작점
        ctx.beginPath();
        ctx.arc(start.x, start.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`${line.id} S`, start.x + 5, start.y - 5);
        
        // 끝점
        ctx.beginPath();
        ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`${line.id} E`, end.x + 5, end.y - 5);
        
        // 중점에 ID 표시
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = line.active ? '#ffff00' : '#00ff00';
        ctx.fillText(line.id, midX - 20, midY - 10);
        
        // 위도/경도 표시
        ctx.font = '8px monospace';
        ctx.fillStyle = '#00ff00';
        const midLat = (line.points[0].y + line.points[1].y) / 2;
        const midLng = (line.points[0].x + line.points[1].x) / 2;
        ctx.fillText(`${midLat.toFixed(5)}, ${midLng.toFixed(5)}`, midX - 30, midY + 15);
      });
      
      ctx.restore();
    }
    
    // THL 감지 영역 시각화
    if (showDetectionSectors) {
      ctx.save();
      
      rwslLines.filter(line => line.type === 'THL').forEach(line => {
        const midpoint = {
          lat: (line.points[0].y + line.points[1].y) / 2,
          lng: (line.points[0].x + line.points[1].x) / 2
        };
        
        const centerPoint = latLngToCanvas(midpoint.lat, midpoint.lng);
        
        // THL 감지 영역 (직사각형 100m x 60m)
        ctx.strokeStyle = line.active ? 'rgba(255, 51, 51, 0.6)' : 'rgba(100, 100, 100, 0.4)';
        ctx.fillStyle = line.active ? 'rgba(255, 51, 51, 0.1)' : 'rgba(100, 100, 100, 0.05)';
        ctx.lineWidth = 2;
        
        const waitingAreaLength = 100 / 111000 * 4000 * scale; // 100m
        const waitingAreaWidth = 60 / 111000 * 4000 * scale;   // 60m
        
        // 활주로 방향 계산
        const runwayHeading = line.id.includes('14') ? 143 : 323;
        const headingRad = runwayHeading * Math.PI / 180;
        const runwayVector = {
          x: Math.sin(headingRad),
          y: -Math.cos(headingRad)
        };
        const perpVector = {
          x: -runwayVector.y,
          y: runwayVector.x
        };
        
        // 직사각형 모서리 (THL 위치에서 활주로 반대 방향 100m)
        const corners = [
          { // 왼쪽 뒤
            x: centerPoint.x - runwayVector.x * waitingAreaLength - perpVector.x * waitingAreaWidth / 2,
            y: centerPoint.y - runwayVector.y * waitingAreaLength - perpVector.y * waitingAreaWidth / 2
          },
          { // 오른쪽 뒤
            x: centerPoint.x - runwayVector.x * waitingAreaLength + perpVector.x * waitingAreaWidth / 2,
            y: centerPoint.y - runwayVector.y * waitingAreaLength + perpVector.y * waitingAreaWidth / 2
          },
          { // 오른쪽 앞
            x: centerPoint.x + perpVector.x * waitingAreaWidth / 2,
            y: centerPoint.y + perpVector.y * waitingAreaWidth / 2
          },
          { // 왼쪽 앞
            x: centerPoint.x - perpVector.x * waitingAreaWidth / 2,
            y: centerPoint.y - perpVector.y * waitingAreaWidth / 2
          }
        ];
        
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        corners.forEach(corner => ctx.lineTo(corner.x, corner.y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // THL 라벨
        ctx.fillStyle = line.active ? '#ff3333' : '#666666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('100m x 60m', centerPoint.x, centerPoint.y);
        ctx.textAlign = 'left';
      });
      
      ctx.restore();
    }

    // 활주로 트래픽 영역 시각화
    if (showTrafficZones) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
      ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      
      localRunways.forEach(runway => {
        const start = latLngToCanvas(runway.centerline.start.lat, runway.centerline.start.lng);
        const end = latLngToCanvas(runway.centerline.end.lat, runway.centerline.end.lng);
        
        // 활주로 중심선 양쪽으로 2km 폭 영역
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const perpAngle = angle + Math.PI / 2;
        const widthPixels = 2000 / 111000 * 4000 * scale;
        
        const offset1X = Math.cos(perpAngle) * widthPixels;
        const offset1Y = Math.sin(perpAngle) * widthPixels;
        const offset2X = Math.cos(perpAngle + Math.PI) * widthPixels;
        const offset2Y = Math.sin(perpAngle + Math.PI) * widthPixels;
        
        ctx.beginPath();
        ctx.moveTo(start.x + offset1X, start.y + offset1Y);
        ctx.lineTo(end.x + offset1X, end.y + offset1Y);
        ctx.lineTo(end.x + offset2X, end.y + offset2Y);
        ctx.lineTo(start.x + offset2X, start.y + offset2Y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      
      ctx.restore();
    }

    // 거리 링 시각화 (추가)
    if (showDistanceRings) {
      ctx.save();
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      const center = latLngToCanvas(GIMPO_CENTER.lat, GIMPO_CENTER.lng);
      [1, 2, 5].forEach((km) => {
        const radiusPixels = km * 1000 / 111000 * 4000 * scale;
        
        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPixels, 0, 2 * Math.PI);
        ctx.stroke();
        
        // 거리 라벨
        ctx.fillStyle = 'rgba(128, 128, 128, 0.8)';
        ctx.font = '10px monospace';
        ctx.fillText(`${km}km`, center.x + radiusPixels - 20, center.y - 5);
      });
      
      ctx.setLineDash([]);
      ctx.restore();
    }
    
    // 이륙 위치 시각화
    if (showTakeoffPositions) {
      ctx.save();
      
      localRunways.forEach(runway => {
        Object.entries(runway.takeoffPositions).forEach(([name, position]) => {
          const pos = latLngToCanvas(position.lat, position.lng);
          
          // 이륙 위치 마커 (큰 원)
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 15, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
          ctx.fill();
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // 중심점
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#00ff00';
          ctx.fill();
          
          // 방향 화살표
          const headingDeg = name.includes('14') ? 143 : 323;
          const headingRad = headingDeg * Math.PI / 180;
          const arrowLength = 30;
          // 캔버스 좌표계에서 북쪽(0도)이 -Y 방향이므로 조정
          const arrowEnd = {
            x: pos.x + Math.sin(headingRad) * arrowLength,
            y: pos.y - Math.cos(headingRad) * arrowLength
          };
          
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(arrowEnd.x, arrowEnd.y);
          ctx.stroke();
          
          // 화살표 머리
          const arrowHeadLength = 10;
          const arrowHeadAngle = Math.PI / 6;
          
          ctx.beginPath();
          ctx.moveTo(arrowEnd.x, arrowEnd.y);
          ctx.lineTo(
            arrowEnd.x - Math.sin(headingRad - arrowHeadAngle) * arrowHeadLength,
            arrowEnd.y + Math.cos(headingRad - arrowHeadAngle) * arrowHeadLength
          );
          ctx.moveTo(arrowEnd.x, arrowEnd.y);
          ctx.lineTo(
            arrowEnd.x - Math.sin(headingRad + arrowHeadAngle) * arrowHeadLength,
            arrowEnd.y + Math.cos(headingRad + arrowHeadAngle) * arrowHeadLength
          );
          ctx.stroke();
          
          // 라벨
          ctx.fillStyle = '#00ff00';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${name} T/O`, pos.x, pos.y - 20);
          
          // 이륙 대기 구역 (직사각형 100m x 60m)
          const waitingAreaLength = 100 / 111000 * 4000 * scale; // 100m
          const waitingAreaWidth = 60 / 111000 * 4000 * scale;   // 60m (활주로 폭)
          
          // 활주로 방향 벡터 - 화살표와 동일한 방향 사용
          const runwayVector = {
            x: (arrowEnd.x - pos.x) / arrowLength,
            y: (arrowEnd.y - pos.y) / arrowLength
          };
          const perpVector = {
            x: -runwayVector.y,
            y: runwayVector.x
          };
          
          // 디버깅: 각도 출력
          // 캔버스 좌표계에서 각도 계산 (북쪽이 -Y 방향)
          const canvasAngle = Math.atan2(runwayVector.x, -runwayVector.y) * 180 / Math.PI;
          const normalizedAngle = (canvasAngle + 360) % 360;
          ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
          ctx.font = '10px monospace';
          ctx.fillText(`각도: ${normalizedAngle.toFixed(1)}° (예상: ${headingDeg}°)`, pos.x, pos.y - 35);
          
          // 직사각형 모서리 계산 (이륙 위치에서 진행 방향으로 100m)
          const corners = [
            { // 왼쪽 시작
              x: pos.x - perpVector.x * waitingAreaWidth / 2,
              y: pos.y - perpVector.y * waitingAreaWidth / 2
            },
            { // 오른쪽 시작
              x: pos.x + perpVector.x * waitingAreaWidth / 2,
              y: pos.y + perpVector.y * waitingAreaWidth / 2
            },
            { // 오른쪽 끝
              x: pos.x + runwayVector.x * waitingAreaLength + perpVector.x * waitingAreaWidth / 2,
              y: pos.y + runwayVector.y * waitingAreaLength + perpVector.y * waitingAreaWidth / 2
            },
            { // 왼쪽 끝
              x: pos.x + runwayVector.x * waitingAreaLength - perpVector.x * waitingAreaWidth / 2,
              y: pos.y + runwayVector.y * waitingAreaLength - perpVector.y * waitingAreaWidth / 2
            }
          ];
          
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          corners.forEach(corner => ctx.lineTo(corner.x, corner.y));
          ctx.closePath();
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // 좌표 표시
          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.font = '8px monospace';
          ctx.fillText(`${position.lat.toFixed(4)}°N`, pos.x, pos.y + 40);
          ctx.fillText(`${position.lng.toFixed(4)}°E`, pos.x, pos.y + 50);
        });
      });
      
      ctx.restore();
    }

    
    // Draw aircraft data blocks (on top of everything except debug)
    displayAircraft.forEach((ac) => {
      const pos = latLngToCanvas(ac.latitude, ac.longitude);
      
      // 뷰포트 컬링 (성능 최적화)
      if (!isInViewport(pos.x, pos.y, CANVAS_SIZE.width, CANVAS_SIZE.height, 50)) {
        return;
      }

      // Aircraft color for data block
      let color = '#3b82f6';
      if (ac.isEmergency) color = '#dc2626';
      else if (!ac.isActive || ac.speed === 0) color = '#9ca3af';
      else if (ac.altitude < 1000) color = '#f59e0b';
      else if (ac.altitude > 10000) color = '#10b981';
      
      // Draw data block with better contrast
      ctx.fillStyle = showOSMMap ? 'rgba(15, 23, 42, 0.95)' : '#1e293b';
      ctx.fillRect(pos.x + 12, pos.y - 15, 80, 35);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pos.x + 12, pos.y - 15, 80, 35);
      
      // Draw callsign
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(ac.callsign, pos.x + 15, pos.y - 3);
      
      // Draw altitude and speed
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`${ac.altitude}ft`, pos.x + 15, pos.y + 8);
      ctx.fillText(`${Math.round(ac.speed)}kt`, pos.x + 15, pos.y + 18);
      
      // Draw squawk if emergency
      if (ac.isEmergency && ac.squawk) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(ac.squawk, pos.x + 55, pos.y + 8);
      }
    });

    // 디버그 정보 시각화 (LAST - 최상위)
    if (showDebugInfo) {
      ctx.save();
      
      // 항공기별 상태 정보 표시
      displayAircraft.forEach((ac) => {
        const pos = latLngToCanvas(ac.latitude, ac.longitude);
        
        if (pos.x < -50 || pos.x > CANVAS_SIZE.width + 50 || 
            pos.y < -50 || pos.y > CANVAS_SIZE.height + 50) {
          return;
        }

        // 디버그 정보 박스
        const isOnGround = ac.altitude <= 50 && Math.abs(ac.verticalSpeed || 0) < 100;
        
        // 이륙 위치 확인
        let isAtTakeoffPosition = false;
        localRunways.forEach(runway => {
          Object.entries(runway.takeoffPositions).forEach(([name, position]) => {
            const dist = calculateDistanceHelper(ac.latitude, ac.longitude, position.lat, position.lng);
            if (dist <= 100) isAtTakeoffPosition = true;
          });
        });
        
        const phase = isOnGround ? 
          (ac.speed > 50 ? 'TAKEOFF' :
           ac.speed > 5 ? (isAtTakeoffPosition ? 'T/O READY' : 'TAXI') : 
           'PARKED') :
          (ac.altitude <= 1500 && (ac.verticalSpeed || 0) < -100 ? 'LANDING' : 
           (ac.altitude <= 500 && (ac.verticalSpeed || 0) > 100 ? 'TAKEOFF' : 'AIRBORNE'));
        
        const debugText = [
          `ALT: ${ac.altitude}ft VS: ${ac.verticalSpeed || 0}fpm`,
          `SPD: ${ac.speed}kt HDG: ${ac.heading}°`,
          `Phase: ${phase}`
        ];
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(pos.x - 50, pos.y + 25, 100, 45);
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(pos.x - 50, pos.y + 25, 100, 45);
        
        ctx.fillStyle = '#000000';
        ctx.font = '8px monospace';
        debugText.forEach((text, index) => {
          ctx.fillText(text, pos.x - 48, pos.y + 38 + index * 12);
        });
      });
      
      ctx.restore();
    }
    
    // 렌더링 성능 측정 결과
    const renderEndTime = performance.now();
    // 렌더링 성능 로그 비활성화 (성능 개선)
    
  }, [displayAircraft, runways, selectedAircraft, scale, panX, panY, mapImage, mapOffsetX, mapOffsetY, mapRotation, mapScaleAdjust, showOSMMap, osmTiles, tileCache, loadOSMTile, rwslLines, isDrawingRWSL, drawingPoints, showDebugInfo, showTrafficZones, showDetectionSectors, showRunwayLines, showDistanceRings, showLightDirections, showAircraftPaths, showTakeoffPositions, showLightPositions, GIMPO_CENTER.lat, GIMPO_CENTER.lng, CANVAS_SIZE.width, CANVAS_SIZE.height]);
  
  // pan이나 scale 변경 시 타일 미리 로드 및 인접 줌 레벨 프리로드
  useEffect(() => {
    if (!showOSMMap) return;
    
    const zoom = Math.max(12, Math.min(17, Math.floor(14 + Math.log2(scale))));
    const topLeft = canvasToLatLng(-200, -200); // 더 넓은 범위
    const bottomRight = canvasToLatLng(CANVAS_SIZE.width + 200, CANVAS_SIZE.height + 200);
    
    // 현재 줌 레벨 타일 로드
    const minTile = latLngToTile(topLeft.lat, topLeft.lng, zoom);
    const maxTile = latLngToTile(bottomRight.lat, bottomRight.lng, zoom);
    
    for (let tileX = minTile.x - 2; tileX <= maxTile.x + 2; tileX++) {
      for (let tileY = minTile.y - 2; tileY <= maxTile.y + 2; tileY++) {
        loadOSMTile(tileX, tileY, zoom);
      }
    }
    
    // 인접 줌 레벨 프리로드 (줌인/아웃 시 즉시 표시 가능)
    if (zoom > 12) {
      const prevZoom = zoom - 1;
      const prevMinTile = latLngToTile(topLeft.lat, topLeft.lng, prevZoom);
      const prevMaxTile = latLngToTile(bottomRight.lat, bottomRight.lng, prevZoom);
      
      for (let tileX = prevMinTile.x; tileX <= prevMaxTile.x; tileX++) {
        for (let tileY = prevMinTile.y; tileY <= prevMaxTile.y; tileY++) {
          loadOSMTile(tileX, tileY, prevZoom);
        }
      }
    }
    
    if (zoom < 17) {
      const nextZoom = zoom + 1;
      const nextMinTile = latLngToTile(topLeft.lat, topLeft.lng, nextZoom);
      const nextMaxTile = latLngToTile(bottomRight.lat, bottomRight.lng, nextZoom);
      
      // 다음 줌 레벨은 타일이 많으므로 중앙 부분만
      const centerLat = (topLeft.lat + bottomRight.lat) / 2;
      const centerLng = (topLeft.lng + bottomRight.lng) / 2;
      const centerTile = latLngToTile(centerLat, centerLng, nextZoom);
      
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          loadOSMTile(centerTile.x + dx, centerTile.y + dy, nextZoom);
        }
      }
    }
  }, [panX, panY, scale, showOSMMap, loadOSMTile, GIMPO_CENTER.lat, GIMPO_CENTER.lng, CANVAS_SIZE.width, CANVAS_SIZE.height]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    if (isDrawingRWSL) {
      // RWSL 그리기 모드
      const latLng = canvasToLatLng(clickX, clickY);
      setDrawingPoints([...drawingPoints, { x: latLng.lng, y: latLng.lat }]);
    } else {
      // 항공기 선택 모드
      for (const ac of aircraft) {
        const pos = latLngToCanvas(ac.latitude, ac.longitude);
        const distance = Math.sqrt((clickX - pos.x) ** 2 + (clickY - pos.y) ** 2);
        
        if (distance < 20) {
          onSelectAircraft?.(ac);
          break;
        }
      }
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const newScale = scale * (event.deltaY > 0 ? 0.9 : 1.1);
    setScale(Math.max(0.1, Math.min(20, newScale)));
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.buttons === 1) { // Left mouse button
      setPanX(panX + event.movementX);
      setPanY(panY + event.movementY);
    }
  };

  return (
    <div className="h-full w-full relative bg-gray-900 rounded-lg overflow-hidden">
      {/* Control Panel - Absolute positioned */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-800/90 backdrop-blur-sm p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">김포공항 레이더</h3>
            <div className="text-xs text-gray-400">배율: {(scale * 100).toFixed(0)}%</div>
          </div>
          <button
            onClick={() => {
              setScale(1.5);
              setPanX(0);
              setPanY(0);
            }}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            초기화
          </button>
        </div>
        
        {/* Controls on single line */}
        <div className="flex items-center gap-4 mt-2">
          {/* 시각화 옵션 */}
          <div className="flex items-center gap-3">
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showOSMMap}
                onChange={(e) => setShowOSMMap(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">OSM</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showRunwayLines}
                onChange={(e) => setShowRunwayLines(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">활주로</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showDebugInfo}
                onChange={(e) => setShowDebugInfo(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">디버그</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showLightDirections}
                onChange={(e) => setShowLightDirections(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">등화방향</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showDetectionSectors}
                onChange={(e) => setShowDetectionSectors(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">감지영역</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showAircraftPaths}
                onChange={(e) => setShowAircraftPaths(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">예상경로</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showTakeoffPositions}
                onChange={(e) => setShowTakeoffPositions(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">이륙위치</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showLightPositions}
                onChange={(e) => setShowLightPositions(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">등화위치</span>
            </label>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showFPS}
                onChange={(e) => setShowFPS(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-300">FPS</span>
            </label>
          </div>
          
          {/* RWSL 도구 */}
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={selectedRWSLType}
              onChange={(e) => setSelectedRWSLType(e.target.value as 'REL' | 'THL' | 'RIL')}
              className="px-2 py-1 rounded text-xs bg-gray-700 text-white"
            >
              <option value="REL">REL</option>
              <option value="THL">THL</option>
              <option value="RIL">RIL</option>
            </select>
            <button
              onClick={() => {
                if (isDrawingRWSL && drawingPoints.length >= 2) {
                  const newLine: RWSLLine = {
                    id: `${selectedRWSLType}-${Date.now()}`,
                    type: selectedRWSLType,
                    points: [...drawingPoints],
                    active: false
                  };
                  setRwslLines([...rwslLines, newLine]);
                  setDrawingPoints([]);
                  setIsDrawingRWSL(false);
                } else {
                  setIsDrawingRWSL(true);
                  setDrawingPoints([]);
                }
              }}
              className={`px-2 py-1 rounded text-xs ${
                isDrawingRWSL ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'
              }`}
            >
              {isDrawingRWSL ? '완료' : 'RWSL'}
            </button>
            {isDrawingRWSL && (
              <button
                onClick={() => {
                  setIsDrawingRWSL(false);
                  setDrawingPoints([]);
                }}
                className="px-2 py-1 rounded text-xs bg-gray-600 text-white"
              >
                취소
              </button>
            )}
            {rwslLines.length > 0 && (
              <button
                onClick={() => {
                  const autoRWSL = generateGimpoRWSL();
                  setRwslLines(autoRWSL);
                }}
                className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700"
              >
                자동배치
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE.width}
        height={CANVAS_SIZE.height}
        className="cursor-move w-full h-full"
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
      />
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-black/70 p-2 rounded text-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9ca3af' }}></div>
            <span className="text-gray-300">지상</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
            <span className="text-gray-300">저고도 (&lt;1000ft)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
            <span className="text-gray-300">중고도</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
            <span className="text-gray-300">고고도 (&gt;10000ft)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
            <span className="text-gray-300">긴급</span>
          </div>
        </div>
      </div>
      
      {/* Aircraft count */}
      <div className="absolute bottom-2 right-2 bg-black/70 p-2 rounded text-xs">
        <div className="text-white">
          추적: {aircraft.length}대
        </div>
        <div className="text-gray-400">
          지상: {aircraft.filter(ac => !ac.isActive || ac.altitude === 0).length}대
        </div>
        {showFPS && (
          <div className="text-yellow-400 mt-1">
            FPS: {currentFPS}
          </div>
        )}
      </div>
    </div>
  );
};

export default RadarDisplay;