import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrackedAircraft, Runway } from '../types';
import { RWSLAdapter } from '../services/rwsl/RWSLAdapter';
import { RWSLState, LightStateInfo, RunwayOccupancy, RWSLSystemStatus, ConflictEvent } from '../types/rwsl';
import { CoordinateSystem } from '../core/coordinates';
import { RKSS_AIRPORT_DATA, getRELPositions, getTHLPositions } from '../data/airportData';
import { calculateDistance } from '../utils/rwslHelpers';
import rwslLightPositions from '../data/rwslLightPositions.json';
import { apiService } from '../services/api';

interface RadarDisplayProps {
  aircraft: TrackedAircraft[];
  runways: Runway[];
  selectedAircraft?: TrackedAircraft;
  onSelectAircraft?: (aircraft: TrackedAircraft) => void;
}

interface RWSLDisplay {
  rel: LightStateInfo[];
  thl: LightStateInfo[];
  activeRELCount: number;
  activeTHLCount: number;
}

// Legacy RWSLLine interface for drawing
interface RWSLLine {
  id: string;
  type: 'REL' | 'THL' | 'RIL';
  points: { x: number; y: number }[];
  active: boolean;
}

const RadarDisplay: React.FC<RadarDisplayProps> = ({
  aircraft,
  runways,
  selectedAircraft,
  onSelectAircraft
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const osmCanvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.5);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  
  // 줌 설정
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 50;  // 10에서 50으로 증가
  const ZOOM_STEP = 0.1;
  
  // RWSL 시스템 상태
  const [coordinateSystem] = useState(() => new CoordinateSystem(37.5587, 126.7905));
  const [rwslAdapter] = useState(() => new RWSLAdapter(coordinateSystem));
  const [rwslState, setRwslState] = useState<RWSLState | null>(null);
  const [rwslDisplay, setRwslDisplay] = useState<RWSLDisplay>({
    rel: [],
    thl: [],
    activeRELCount: 0,
    activeTHLCount: 0
  });
  const [rwslLines, setRwslLines] = useState<RWSLLine[]>([]);

  // 맵 관련 상태
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [mapOffsetX, setMapOffsetX] = useState(255);
  const [mapOffsetY, setMapOffsetY] = useState(274.3);
  const [mapRotation, setMapRotation] = useState(224.9);
  const [mapScaleAdjust, setMapScaleAdjust] = useState(0.29);
  
  // 위성지도용 벡터맵 조정값
  const [satelliteMapOffsetX, setSatelliteMapOffsetX] = useState(159.1);
  const [satelliteMapOffsetY, setSatelliteMapOffsetY] = useState(242.1);
  
  // OSM+벡터맵 전체 오프셋 (시스템 좌표와 맞추기 위함)
  const [globalOffsetX, setGlobalOffsetX] = useState(-96.8);
  const [globalOffsetY, setGlobalOffsetY] = useState(-47.9);
  
  // 위성지도용 별도 오프셋
  const [satelliteOffsetX, setSatelliteOffsetX] = useState(-0.4);
  const [satelliteOffsetY, setSatelliteOffsetY] = useState(-14.9);
  
  
  // 활주로 간격 조정
  const [runwaySpacing, setRunwaySpacing] = useState(0.4);
  
  // 마우스 위치만 저장 (드래그용)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // 등화 위치 시각화
  const [showLightPositions, setShowLightPositions] = useState(false);
  
  // 활주로 경계 표시
  const [showRunwayBounds, setShowRunwayBounds] = useState(true);
  
  // 내부 로직 뷰 모드
  const [showInternalLogic, setShowInternalLogic] = useState(false);
  
  // RWSL 시스템 상태 및 충돌 정보
  const [systemStatus, setSystemStatus] = useState<RWSLSystemStatus | null>({
    collisionDetection: {
      activeConflicts: [],
      processingTime: 0,
      lastUpdate: new Date()
    },
    relStatus: {
      activeLights: 0,
      totalLights: 24,
      decisions: []
    },
    thlStatus: {
      activeLights: 0,
      totalLights: 8,
      decisions: []
    },
    systemHealth: {
      status: 'ONLINE',
      uptime: 0,
      errorCount: 0,
      performanceScore: 100
    },
    timestamp: new Date()
  });
  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  
  // 활주로 점유 정보
  const [runwayOccupancy, setRunwayOccupancy] = useState<Map<string, RunwayOccupancy>>(new Map());
  
  // 접근 항공기 정보
  const [approachingAircraft, setApproachingAircraft] = useState<Map<string, string[]>>(new Map());
  
  // 맵 레이어 토글
  const [showOSMMap, setShowOSMMap] = useState(true);
  const [showSatelliteMap, setShowSatelliteMap] = useState(false);
  const [showVectorMap, setShowVectorMap] = useState(false); // 벡터맵은 기본 꺼짐 (SVG 로드 필요)
  
  // RWSL 레이어 토글 (모두 기본 활성화)
  const [showRELLights, setShowRELLights] = useState(true);
  const [showTHLLights, setShowTHLLights] = useState(true);
  const [showRWSLLines, setShowRWSLLines] = useState(true);
  
  // 내부 로직 뷰 레이어 토글
  const [showDetectionZones, setShowDetectionZones] = useState(true);
  const [showConflictVisuals, setShowConflictVisuals] = useState(true);
  const [showAircraftStatus, setShowAircraftStatus] = useState(true);
  const [showRunwayOccupancyInfo, setShowRunwayOccupancyInfo] = useState(true);
  
  // 레이어 컨트롤 패널 표시
  const [showLayerControls, setShowLayerControls] = useState(false);
  
  // UI 패널 토글
  const [showZoomControls, setShowZoomControls] = useState(true);
  const [showMapControls, setShowMapControls] = useState(true);
  const [showBottomStatus, setShowBottomStatus] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  
  // REL 그리기 모드
  const [relDrawMode, setRelDrawMode] = useState(false);
  const [relType, setRelType] = useState<'departure' | 'arrival'>('departure');
  const [relDrawClicks, setRelDrawClicks] = useState<Array<{x: number, y: number, lat: number, lng: number}>>([]);
  const [previewRel, setPreviewRel] = useState<{position: {lat: number, lng: number}, holdingPoint: {lat: number, lng: number}} | null>(null);
  
  // OSM 타일 시스템
  const [osmTiles, setOsmTiles] = useState<Map<string, HTMLImageElement>>(new Map());
  const tileLoadQueueRef = useRef<Set<string>>(new Set());
  const loadingTilesRef = useRef<Set<string>>(new Set());
  const [tileCache, setTileCache] = useState<Map<string, HTMLImageElement>>(new Map());
  const lastZoomLevelRef = useRef<number>(14);
  const [osmBrightness, setOsmBrightness] = useState(0.3); // 30% 밝기
  const [osmOpacity, setOsmOpacity] = useState(0.8); // 80% 불투명도
  
  // 위성지도
  const [showSatellite, setShowSatellite] = useState(false);
  const [satelliteTiles, setSatelliteTiles] = useState<Map<string, HTMLImageElement>>(new Map());
  const [satelliteCache, setSatelliteCache] = useState<Map<string, HTMLImageElement>>(new Map());

  // 캔버스 크기
  const CANVAS_SIZE = { width: 1920, height: 1080 };

  // 김포공항 활주로 데이터 (로컬 타입 정의)
  interface LocalRunway {
    id: string;
    name: string;
    width: number;
    centerline: {
      start: { lat: number; lng: number };
      end: { lat: number; lng: number };
    };
    thresholds?: {
      [key: string]: {
        id: string;
        lat: number;
        lng: number;
        heading: number;
      };
    };
  }
  
  const localRunways: LocalRunway[] = [
    {
      id: '14L/32R',
      name: '14L/32R',
      width: 45,
      centerline: {
        start: { lat: 37.5705, lng: 126.7784 },
        end: { lat: 37.5478, lng: 126.8070 }
      },
      thresholds: {
        '14L': {
          id: '14L',
          lat: 37.5705,
          lng: 126.7784,
          heading: 143
        },
        '32R': {
          id: '32R',
          lat: 37.5478,
          lng: 126.8070,
          heading: 323
        }
      }
    },
    {
      id: '14R/32L',
      name: '14R/32L',
      width: 60,
      centerline: {
        start: { lat: 37.5683, lng: 126.7755 },
        end: { lat: 37.5481, lng: 126.8009 }
      },
      thresholds: {
        '14R': {
          id: '14R',
          lat: 37.5683,
          lng: 126.7755,
          heading: 143
        },
        '32L': {
          id: '32L',
          lat: 37.5481,
          lng: 126.8009,
          heading: 323
        }
      }
    }
  ];

  // 고정 등화 위치 데이터를 RWSLLine 형식으로 초기화
  useEffect(() => {
    const staticRwslLines: RWSLLine[] = [];
    
    // REL 등화 추가 - 새로운 구조에 맞게 수정
    const relLights = rwslLightPositions.lights.REL;
    
    // Departure REL 추가
    if (relLights.departure) {
      relLights.departure.forEach((light: any) => {
        staticRwslLines.push({
          id: light.id,
          type: 'REL',
          points: [
            { x: light.position.lng, y: light.position.lat },
            { x: light.holdingPoint.lng, y: light.holdingPoint.lat }
          ],
          active: false
        });
      });
    }
    
    // Arrival REL 추가 - 도착 REL은 holdingPoint에서 position 방향으로
    if (relLights.arrival) {
      relLights.arrival.forEach((light: any) => {
        staticRwslLines.push({
          id: light.id,
          type: 'REL',
          points: [
            { x: light.holdingPoint.lng, y: light.holdingPoint.lat },
            { x: light.position.lng, y: light.position.lat }
          ],
          active: false
        });
      });
    }
    
    // THL 등화 추가 - 각 THL을 개별 점으로 추가
    Object.entries(rwslLightPositions.lights.THL).forEach(([threshold, lights]) => {
      if (Array.isArray(lights)) {
        lights.forEach((light: any) => {
          staticRwslLines.push({
            id: light.id,
            type: 'THL',
            points: [{
              x: light.position.lng,
              y: light.position.lat
            }],
            active: false
          });
        });
      }
    });
    
    // console.log(`RWSL 등화 초기화 완료: 총 ${staticRwslLines.length}개 등화`);
    setRwslLines(staticRwslLines);
  }, []);

  // RWSL 시스템 초기화 및 시작
  useEffect(() => {
    // RWSL 어댑터 이벤트 등록
    rwslAdapter.onStateChange((state) => {
      console.log('[RWSL] 상태 업데이트', {
        conflicts: state.conflicts?.length || 0,
        activeREL: Array.from(state.rel.values()).filter(l => l.active).length,
        activeTHL: Array.from(state.thl.values()).filter(l => l.active).length
      });
      
      setRwslState(state);
      
      // 시스템 상태와 충돌 정보 업데이트
      const status = rwslAdapter.getSystemStatus();
      const conflictList = rwslAdapter.getConflicts();
      setSystemStatus(status);
      setConflicts(conflictList);
      
      // 활주로 점유 정보 업데이트
      const occupancy = rwslAdapter.getRunwayOccupancy();
      setRunwayOccupancy(occupancy);
      
      // 접근 항공기 정보 업데이트
      const approaching = rwslAdapter.getApproachingAircraft();
      setApproachingAircraft(approaching);
      
      const relLights = Array.from(state.rel.values());
      const thlLights = Array.from(state.thl.values());
      
      console.log('RWSL State Update:', {
        relCount: relLights.length,
        activeREL: relLights.filter(l => l.active).length,
        thlCount: thlLights.length,
        activeTHL: thlLights.filter(l => l.active).length,
        activeRELIds: relLights.filter(l => l.active).map(l => l.id),
        showRELLights,
        showRWSLLines,
        relLights: relLights,
        thlLights: thlLights
      });
      
      setRwslDisplay({
        rel: relLights,
        thl: thlLights,
        activeRELCount: relLights.filter(l => l.active).length,
        activeTHLCount: thlLights.filter(l => l.active).length
      });
      
      // 기존 rwslLines의 active 상태만 업데이트
      if (rwslLines.length > 0) {
        const updatedRwslLines = rwslLines.map(line => {
          // REL 상태 업데이트 - 정확한 ID 매칭
          if (line.type === 'REL') {
            const activeLight = relLights.find(light => light.id === line.id);
            return { ...line, active: activeLight?.active || false };
          }
          
          // THL 상태 업데이트
          if (line.type === 'THL') {
            const threshold = line.id.replace('THL_', '');
            const activeLight = thlLights.find(light => 
              light.id.includes(threshold)
            );
            return { ...line, active: activeLight?.active || false };
          }
          
          return line;
        });
        
        setRwslLines(updatedRwslLines);
        
        // 디버그: 활성화된 rwslLines 로그
        const activeRwslLines = updatedRwslLines.filter(line => line.active);
        if (activeRwslLines.length > 0) {
          console.log('활성화된 rwslLines:', activeRwslLines.map(line => ({
            id: line.id,
            type: line.type,
            active: line.active
          })));
        }
      }
    });
    
    rwslAdapter.onErrorOccurred((error) => {
      console.error('RWSL 시스템 오류:', error);
    });
    
    // RWSL 시스템 시작
    rwslAdapter.start();
    
    return () => {
      rwslAdapter.stop();
    };
  }, [rwslAdapter]);
  
  // 항공기 데이터 업데이트
  useEffect(() => {
    if (aircraft.length > 0) {
      console.log('Updating aircraft data to RWSL:', aircraft.length, 'aircraft');
      rwslAdapter.updateAircraftData(aircraft);
    }
  }, [aircraft, rwslAdapter]);

  // OSM 타일 계산 함수
  const latLngToTile = useCallback((lat: number, lng: number, zoom: number) => {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
  }, []);

  // OSM 타일 로드 - 캐싱 전략 포함
  const loadOSMTile = useCallback((tileX: number, tileY: number, zoom: number) => {
    const key = `${zoom}/${tileX}/${tileY}`;
    
    // 영구 캐시에서 먼저 확인
    if (tileCache.has(key)) {
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
    
    // 동시 로딩 제한 (최대 16개)
    if (loadingTilesRef.current.size >= 16) {
      tileLoadQueueRef.current.add(key);
      return;
    }
    
    loadingTilesRef.current.add(key);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // OSM 타일 URL (z/x/y 순서)
    const subdomain = ['a', 'b', 'c'][Math.floor(Math.random() * 3)];
    img.src = `https://${subdomain}.tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
    
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
  }, [tileCache, osmTiles]);
  
  // 위성지도 타일 로드
  const loadSatelliteTile = useCallback((x: number, y: number, z: number) => {
    const key = `${z}/${x}/${y}`;
    
    // 캐시 확인
    if (satelliteCache.has(key)) {
      const cachedTile = satelliteCache.get(key)!;
      setSatelliteTiles(prev => {
        const newMap = new Map(prev);
        newMap.set(key, cachedTile);
        return newMap;
      });
      return;
    }
    
    // 이미 로딩 중이면 스킵
    if (loadingTilesRef.current.has(`sat_${key}`)) return;
    
    // 동시 로딩 제한
    if (loadingTilesRef.current.size >= 16) {
      tileLoadQueueRef.current.add(`sat_${key}`);
      return;
    }
    
    loadingTilesRef.current.add(`sat_${key}`);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // ESRI World Imagery (무료 위성 타일)
    img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    
    img.onload = () => {
      // 이미지가 유효한지 확인
      if (img.width === 0 || img.height === 0) {
        loadingTilesRef.current.delete(`sat_${key}`);
        return;
      }
      
      setSatelliteCache(prev => {
        const newCache = new Map(prev);
        newCache.set(key, img);
        return newCache;
      });
      
      setSatelliteTiles(prev => {
        const newMap = new Map(prev);
        newMap.set(key, img);
        return newMap;
      });
      
      loadingTilesRef.current.delete(`sat_${key}`);
      
      // 대기 중인 타일 로드
      const next = Array.from(tileLoadQueueRef.current).find(k => k.startsWith('sat_'));
      if (next) {
        tileLoadQueueRef.current.delete(next);
        const keyParts = next.replace('sat_', '').split('/');
        if (keyParts.length === 3) {
          const nextZ = parseInt(keyParts[0]);
          const nextX = parseInt(keyParts[1]);
          const nextY = parseInt(keyParts[2]);
          if (!isNaN(nextZ) && !isNaN(nextX) && !isNaN(nextY)) {
            loadSatelliteTile(nextX, nextY, nextZ);
          }
        }
      }
    };
    
    img.onerror = () => {
      loadingTilesRef.current.delete(`sat_${key}`);
      console.warn(`Failed to load satellite tile: ${key}`);
      
      // 에러 발생 시에도 대기 중인 타일 처리
      const next = Array.from(tileLoadQueueRef.current).find(k => k.startsWith('sat_'));
      if (next) {
        tileLoadQueueRef.current.delete(next);
        const keyParts = next.replace('sat_', '').split('/');
        if (keyParts.length === 3) {
          const nextZ = parseInt(keyParts[0]);
          const nextX = parseInt(keyParts[1]);
          const nextY = parseInt(keyParts[2]);
          if (!isNaN(nextZ) && !isNaN(nextX) && !isNaN(nextY)) {
            loadSatelliteTile(nextX, nextY, nextZ);
          }
        }
      }
    };
  }, [satelliteCache]);

  // OSM/위성 타일 렌더링 (별도 캔버스)
  const renderOSMTiles = useCallback(() => {
    const osmCanvas = osmCanvasRef.current;
    if (!osmCanvas) return;
    
    // OSM과 위성지도 중 하나라도 켜져있으면 렌더링
    if (!showOSMMap && !showSatelliteMap) {
      // 둘 다 꺼져있을 때만 캔버스 클리어하고 종료
      const ctx = osmCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, osmCanvas.width, osmCanvas.height);
      return;
    }
    
    const ctx = osmCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, osmCanvas.width, osmCanvas.height);
    
    const GIMPO_CENTER = { lat: 37.5587, lng: 126.7905 };
    const zoom = showSatelliteMap ? 17 : 14; // 위성지도는 고화질 줌 레벨
    const tileSize = 256;
    
    ctx.save();
    ctx.translate(osmCanvas.width / 2, osmCanvas.height / 2);
    ctx.scale(scale, scale);
    
    // 위성지도와 OSM에 따라 다른 오프셋 적용
    const currentOffsetX = showSatelliteMap ? satelliteOffsetX : globalOffsetX;
    const currentOffsetY = showSatelliteMap ? satelliteOffsetY : globalOffsetY;
    ctx.translate(panX + currentOffsetX, panY + currentOffsetY);
    
    // 위성지도의 경우 추가 조정
    if (showSatelliteMap) {
      // 줌 17은 줌 14보다 8배 더 세밀하므로 스케일 조정
      const zoomDiff = 17 - 14; // 3레벨 차이
      const scaleFactor = Math.pow(2, -zoomDiff); // 1/8
      ctx.scale(scaleFactor, scaleFactor);
    }
    
    // 중심 타일 계산
    const centerTile = latLngToTile(GIMPO_CENTER.lat, GIMPO_CENTER.lng, zoom);
    
    // OSM 타일 렌더링
    if (showOSMMap) {
      osmTiles.forEach((tile, key) => {
      try {
        const [z, x, y] = key.split('/').map(Number);
        if (z !== zoom) return; // 해당 줌 레벨 타일만 렌더링
        
        // 타일이 유효한지 확인
        if (!tile || !tile.complete || tile.naturalWidth === 0) return;
        
        const tilePixelX = (x - centerTile.x) * tileSize;
        const tilePixelY = (y - centerTile.y) * tileSize;
        
        ctx.drawImage(tile, tilePixelX, tilePixelY, tileSize, tileSize);
      } catch (error) {
        console.warn(`Error rendering tile ${key}:`, error);
      }
      });
    }
    
    // 위성지도 타일 렌더링 (독립적으로)
    if (showSatelliteMap) {
      satelliteTiles.forEach((tile, key) => {
        try {
          const [z, x, y] = key.split('/').map(Number);
          if (z !== zoom) return; // 해당 줌 레벨 타일만 렌더링
          
          // 타일이 유효한지 확인
          if (!tile || !tile.complete || tile.naturalWidth === 0) return;
          
          const tilePixelX = (x - centerTile.x) * tileSize;
          const tilePixelY = (y - centerTile.y) * tileSize;
          
          ctx.drawImage(tile, tilePixelX, tilePixelY, tileSize, tileSize);
        } catch (error) {
          console.warn(`Error rendering satellite tile ${key}:`, error);
        }
      });
    }
    
    ctx.restore();
  }, [showOSMMap, showSatelliteMap, scale, panX, panY, globalOffsetX, globalOffsetY, satelliteOffsetX, satelliteOffsetY, osmTiles, satelliteTiles, latLngToTile]);

  // OSM 타일 자동 로딩 (줌 레벨 14 고정)
  useEffect(() => {
    if (!showOSMMap) return;
    
    const GIMPO_CENTER = { lat: 37.5587, lng: 126.7905 };
    const zoom = 14; // 줌 레벨 14로 고정
    
    const centerTile = latLngToTile(GIMPO_CENTER.lat, GIMPO_CENTER.lng, zoom);
    
    // 필요한 타일 범위 계산
    const tilesNeeded = Math.ceil(4 / scale) + 2; // 스케일에 따라 타일 범위 조정
    
    for (let dx = -tilesNeeded; dx <= tilesNeeded; dx++) {
      for (let dy = -tilesNeeded; dy <= tilesNeeded; dy++) {
        const tileX = centerTile.x + dx;
        const tileY = centerTile.y + dy;
        
        if (tileX >= 0 && tileY >= 0 && tileX < Math.pow(2, zoom) && tileY < Math.pow(2, zoom)) {
          loadOSMTile(tileX, tileY, zoom);
        }
      }
    }
  }, [showOSMMap, showSatelliteMap, scale, panX, panY, latLngToTile, loadOSMTile]);
  
  // 위성지도 타일 자동 로딩 (독립적)
  useEffect(() => {
    if (!showSatelliteMap) return;
    
    const GIMPO_CENTER = { lat: 37.5587, lng: 126.7905 };
    const zoom = 17; // 고화질 줌 레벨
    
    try {
      const centerTile = latLngToTile(GIMPO_CENTER.lat, GIMPO_CENTER.lng, zoom);
      
      // 스케일에 따라 필요한 타일 수 조정 (최대 제한)
      const baseNeeded = Math.ceil(16 / scale) + 4;
      const tilesNeeded = Math.min(baseNeeded, 12); // 최대 12타일로 제한
      
      const maxTileIndex = Math.pow(2, zoom) - 1;
      
      for (let dx = -tilesNeeded; dx <= tilesNeeded; dx++) {
        for (let dy = -tilesNeeded; dy <= tilesNeeded; dy++) {
          const tileX = centerTile.x + dx;
          const tileY = centerTile.y + dy;
          
          // 유효한 타일 범위인지 확인
          if (tileX >= 0 && tileY >= 0 && tileX <= maxTileIndex && tileY <= maxTileIndex) {
            loadSatelliteTile(tileX, tileY, zoom);
          }
        }
      }
    } catch (error) {
      console.warn('Error loading satellite tiles:', error);
    }
  }, [showSatelliteMap, scale, panX, panY, latLngToTile, loadSatelliteTile]);

  // OSM 타일이 업데이트될 때 캔버스 다시 그리기
  useEffect(() => {
    renderOSMTiles();
  }, [renderOSMTiles]);

  // 벡터맵 로드 - 제거 (버튼 클릭으로만 로드)

  // 점이 다각형 내부에 있는지 확인
  const isPointInPolygon = (point: {x: number, y: number}, vertices: Array<{x: number, y: number}>): boolean => {
    let inside = false;
    const x = point.x;
    const y = point.y;
    
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x;
      const yi = vertices[i].y;
      const xj = vertices[j].x;
      const yj = vertices[j].y;
      
      const intersect = ((yi > y) !== (yj > y)) 
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  };

  // 좌표 변환 함수들
  const getMercatorScale = (lat: number, zoom: number) => {
    return Math.pow(2, zoom) / (Math.cos(lat * Math.PI / 180) * 2 * Math.PI);
  };

  const latLngToPixel = (lat: number, lng: number, zoom: number, centerLat: number, centerLng: number) => {
    const scale = getMercatorScale(centerLat, zoom);
    const worldCoordinate = {
      x: (lng + 180) / 360,
      y: (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2
    };
    const pixelCoordinate = {
      x: worldCoordinate.x * 256 * Math.pow(2, zoom),
      y: worldCoordinate.y * 256 * Math.pow(2, zoom)
    };
    const centerWorldCoordinate = {
      x: (centerLng + 180) / 360,
      y: (1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2
    };
    const centerPixelCoordinate = {
      x: centerWorldCoordinate.x * 256 * Math.pow(2, zoom),
      y: centerWorldCoordinate.y * 256 * Math.pow(2, zoom)
    };
    
    return {
      x: pixelCoordinate.x - centerPixelCoordinate.x,
      y: pixelCoordinate.y - centerPixelCoordinate.y
    };
  };

  // 내부 로직 뷰 렌더링 함수
  const renderInternalLogicView = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // showInternalLogic이 false면 아무것도 렌더링하지 않음
    if (!showInternalLogic) return;
    
    console.log('[내부로직뷰] 렌더링 시작', {
      showDetectionZones,
      showConflictVisuals,
      showAircraftStatus,
      conflicts: conflicts?.length || 0,
      rwslState: !!rwslState
    });
    
    // 기본 스케일과 연동하여 줌/팬 적용
    const localScale = 0.3 * scale; // 미터당 픽셀 비율
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(localScale, localScale);
    ctx.translate(panX, panY);
    
    // 좌표 격자 그리기 (100m, 500m, 1000m 구분)
    for (let x = -3000; x <= 3000; x += 100) {
      if (x === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
      } else if (x % 1000 === 0) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.lineWidth = 1.5;
      } else if (x % 500 === 0) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.1)';
        ctx.lineWidth = 0.5;
      }
      
      ctx.beginPath();
      ctx.moveTo(x, -2000);
      ctx.lineTo(x, 2000);
      ctx.stroke();
    }
    
    for (let y = -2000; y <= 2000; y += 100) {
      if (y === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
      } else if (y % 1000 === 0) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.lineWidth = 1.5;
      } else if (y % 500 === 0) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.1)';
        ctx.lineWidth = 0.5;
      }
      
      ctx.beginPath();
      ctx.moveTo(-3000, -y);
      ctx.lineTo(3000, -y);
      ctx.stroke();
    }
    
    // 1. 실제 활주로 위치 그리기 (회색 실선)
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.lineWidth = 2;
    
    localRunways.forEach((runway, idx) => {
      const start = coordinateSystem.toPlane(
        runway.centerline.start.lat, 
        runway.centerline.start.lng
      );
      const end = coordinateSystem.toPlane(
        runway.centerline.end.lat, 
        runway.centerline.end.lng
      );
      
      // 활주로 중심선
      ctx.beginPath();
      ctx.moveTo(start.x, -start.y);
      ctx.lineTo(end.x, -end.y);
      ctx.stroke();
      
      // 활주로 실제 폭 표시
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const dirX = dx / length;
      const dirY = dy / length;
      const perpX = -dirY;
      const perpY = dirX;
      
      const halfWidth = (idx === 0 ? 45 : 60) / 2;
      
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(start.x + perpX * halfWidth, -(start.y + perpY * halfWidth));
      ctx.lineTo(start.x - perpX * halfWidth, -(start.y - perpY * halfWidth));
      ctx.lineTo(end.x - perpX * halfWidth, -(end.y - perpY * halfWidth));
      ctx.lineTo(end.x + perpX * halfWidth, -(end.y + perpY * halfWidth));
      ctx.closePath();
      ctx.stroke();
      
      // 활주로 이름
      ctx.fillStyle = 'rgba(150, 150, 150, 0.9)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(runway.id + ' (실제)', (start.x + end.x) / 2, -(start.y + end.y) / 2 - 30);
    });
    
    // 2. 내부 로직 판단 영역 (노란색 점선) - 실제 활주로 방향과 일치
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    
    // 각 활주로별 로직 영역 그리기
    localRunways.forEach((runway, idx) => {
      const start = coordinateSystem.toPlane(
        runway.centerline.start.lat, 
        runway.centerline.start.lng
      );
      const end = coordinateSystem.toPlane(
        runway.centerline.end.lat, 
        runway.centerline.end.lng
      );
      
      // 활주로 방향 벡터
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const dirX = dx / length;
      const dirY = dy / length;
      
      // 수직 벡터
      const perpX = -dirY;
      const perpY = dirX;
      
      // 활주로 폭 + 여유 (로직에서 사용하는 값)
      const halfWidth = (idx === 0 ? 45 : 60) / 2 + 10; // 10m 여유
      const lengthMargin = 50; // 길이 방향 50m 여유
      
      // 로직 영역 네 모서리
      const corners = [
        { x: start.x - dirX * lengthMargin + perpX * halfWidth, 
          y: start.y - dirY * lengthMargin + perpY * halfWidth },
        { x: start.x - dirX * lengthMargin - perpX * halfWidth, 
          y: start.y - dirY * lengthMargin - perpY * halfWidth },
        { x: end.x + dirX * lengthMargin - perpX * halfWidth, 
          y: end.y + dirY * lengthMargin - perpY * halfWidth },
        { x: end.x + dirX * lengthMargin + perpX * halfWidth, 
          y: end.y + dirY * lengthMargin + perpY * halfWidth }
      ];
      
      // 로직 영역 그리기
      ctx.beginPath();
      corners.forEach((corner, i) => {
        if (i === 0) ctx.moveTo(corner.x, -corner.y);
        else ctx.lineTo(corner.x, -corner.y);
      });
      ctx.closePath();
      ctx.stroke();
      
      // 로직 영역 라벨
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${runway.id} 로직 영역 (폭 ${(halfWidth * 2 - 20).toFixed(0)}m + 여유 20m)`, 
        (start.x + end.x) / 2, 
        -(start.y + end.y) / 2 + (idx === 0 ? -50 : 50)
      );
      ctx.setLineDash([10, 5]);
    });
    
    // 항공기 위치 (Local 좌표 기준)
    if (showAircraftStatus) {
      aircraft.forEach(ac => {
        const localPos = coordinateSystem.toPlane(ac.latitude, ac.longitude);
        
        // 활주로 점유 확인 (실제 활주로 방향 기반)
        let onRunway = false;
        let onRunwayName = '';
        
        localRunways.forEach((runway, idx) => {
        const start = coordinateSystem.toPlane(
          runway.centerline.start.lat, 
          runway.centerline.start.lng
        );
        const end = coordinateSystem.toPlane(
          runway.centerline.end.lat, 
          runway.centerline.end.lng
        );
        
        // 활주로 벡터
        const runwayVector = { x: end.x - start.x, y: end.y - start.y };
        const runwayLength = Math.sqrt(runwayVector.x * runwayVector.x + runwayVector.y * runwayVector.y);
        const runwayDir = { x: runwayVector.x / runwayLength, y: runwayVector.y / runwayLength };
        
        // 항공기 위치 벡터
        const aircraftVector = { x: localPos.x - start.x, y: localPos.y - start.y };
        
        // 활주로 방향 투영
        const projection = aircraftVector.x * runwayDir.x + aircraftVector.y * runwayDir.y;
        
        // 수직 거리
        const perpDistance = Math.abs(aircraftVector.x * (-runwayDir.y) + aircraftVector.y * runwayDir.x);
        
        const halfWidth = (idx === 0 ? 45 : 60) / 2 + 10;
        const lengthMargin = 50;
        
        if (projection >= -lengthMargin && projection <= runwayLength + lengthMargin && perpDistance <= halfWidth) {
          onRunway = true;
          onRunwayName = runway.id;
        }
      });
      
      // 항공기 점
      ctx.fillStyle = onRunway ? 'rgba(255, 0, 0, 0.9)' : 
                      ac.isActive ? 'rgba(0, 255, 0, 0.8)' : 
                      'rgba(128, 128, 128, 0.6)';
      ctx.beginPath();
      ctx.arc(localPos.x, -localPos.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // 항공기 라벨 (callsign + 좌표)
      ctx.fillStyle = onRunway ? 'red' : 'white';
      ctx.font = onRunway ? 'bold 12px Arial' : '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${ac.callsign} (${localPos.x.toFixed(0)}, ${localPos.y.toFixed(0)})`,
        localPos.x + 10, 
        -localPos.y - 10
      );
    });
    }
    
    // REL 위치 (rwslLightPositions.json 기준)
    rwslLines.filter(line => line.type === 'REL').forEach(rel => {
      if (rel.points.length > 0) {
        // 주의: rwslLightPositions.json에서 x는 lng, y는 lat
        const startLocal = coordinateSystem.toPlane(
          rel.points[0].y,  // lat
          rel.points[0].x   // lng
        );
        const endLocal = coordinateSystem.toPlane(
          rel.points[rel.points.length - 1].y,  // lat
          rel.points[rel.points.length - 1].x   // lng
        );
        
        // REL 선 그리기
        ctx.strokeStyle = rel.active ? 'rgba(255, 0, 0, 0.9)' : 'rgba(255, 100, 100, 0.4)';
        ctx.lineWidth = rel.active ? 6 : 3;
        ctx.beginPath();
        ctx.moveTo(startLocal.x, -startLocal.y);
        ctx.lineTo(endLocal.x, -endLocal.y);
        ctx.stroke();
        
        // REL 라벨
        ctx.fillStyle = rel.active ? 'red' : 'rgba(255, 100, 100, 0.8)';
        ctx.font = rel.active ? 'bold 10px Arial' : '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          rel.id, 
          (startLocal.x + endLocal.x) / 2, 
          -(startLocal.y + endLocal.y) / 2 - 8
        );
      }
    });
    
    // THL 위치 (rwslLightPositions.json 기준)
    rwslLines.filter(line => line.type === 'THL').forEach(thl => {
      if (thl.points.length > 0) {
        const localPos = coordinateSystem.toPlane(
          thl.points[0].y,  // lat
          thl.points[0].x   // lng
        );
        
        // THL 사각형 그리기
        const size = 8;
        ctx.fillStyle = thl.active ? 'rgba(255, 0, 0, 0.9)' : 'rgba(139, 0, 0, 0.6)';
        ctx.strokeStyle = thl.active ? 'rgba(255, 0, 0, 0.9)' : 'rgba(139, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        
        if (thl.active) {
          ctx.fillRect(localPos.x - size/2, -localPos.y - size/2, size, size);
        } else {
          ctx.strokeRect(localPos.x - size/2, -localPos.y - size/2, size, size);
        }
        
        // THL 라벨
        ctx.fillStyle = thl.active ? 'red' : 'rgba(139, 0, 0, 0.8)';
        ctx.font = thl.active ? 'bold 10px Arial' : '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          thl.id, 
          localPos.x, 
          -localPos.y - size
        );
      }
    });
    
    // 좌표 격자 라벨 (주요 좌표에만)
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    for (let x = -2000; x <= 2000; x += 1000) {
      if (x !== 0) {
        ctx.fillText(x + 'm', x, 15);
      }
    }
    ctx.textAlign = 'left';
    for (let y = -2000; y <= 2000; y += 1000) {
      if (y !== 0) {
        ctx.fillText(y + 'm', 10, -y);
      }
    }
    
    // 좌표축 표시 
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('동(+X)', 100, 5);
    ctx.fillText('서(-X)', -100, 5);
    ctx.fillText('북(+Y)', 5, -100);
    ctx.fillText('남(-Y)', 5, 100);
    
    // 충돌 시각화
    if (showConflictVisuals && rwslState && rwslState.conflicts && rwslState.conflicts.length > 0) {
      rwslState.conflicts.forEach((conflict) => {
        // 충돌 지점 시각화
        const conflictPos = conflict.position;
        
        // 심각도별 색상 설정
        let color = 'rgba(255, 255, 0, 0.8)'; // 기본 노란색
        let pulseSize = 15;
        if (conflict.severity === 'CRITICAL') {
          color = 'rgba(255, 0, 0, 0.9)'; // 빨간색
          pulseSize = 20;
        } else if (conflict.severity === 'HIGH') {
          color = 'rgba(255, 0, 0, 0.8)'; // 빨간색
          pulseSize = 18;
        } else if (conflict.severity === 'MEDIUM') {
          color = 'rgba(255, 165, 0, 0.8)'; // 주황색
          pulseSize = 16;
        } else if (conflict.severity === 'LOW') {
          color = 'rgba(255, 255, 0, 0.8)'; // 노란색
          pulseSize = 15;
        }
        
        // 점멸 효과를 위한 시간 기반 알파 값
        const currentTime = Date.now();
        const pulseAlpha = conflict.severity === 'CRITICAL' ? 
          (Math.sin((currentTime % 1000) / 1000 * Math.PI * 2) + 1) / 2 * 0.5 + 0.5 : 1;
        
        // 충돌 지점 원 그리기
        ctx.save();
        ctx.globalAlpha = pulseAlpha;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        
        // 외부 원 (펄스 효과)
        ctx.beginPath();
        ctx.arc(conflictPos.x, -conflictPos.y, pulseSize, 0, 2 * Math.PI);
        ctx.stroke();
        
        // 내부 원
        ctx.beginPath();
        ctx.arc(conflictPos.x, -conflictPos.y, pulseSize / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        
        // 충돌 관련 항공기 간 연결선 그리기
        if (conflict.involvedAircraft && conflict.involvedAircraft.length >= 2) {
          const involvedAc = conflict.involvedAircraft
            .map(callsign => aircraft.find(ac => ac.callsign === callsign))
            .filter(ac => ac !== undefined);
            
          if (involvedAc.length >= 2) {
            // 항공기 간 연결선
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            
            for (let i = 0; i < involvedAc.length - 1; i++) {
              for (let j = i + 1; j < involvedAc.length; j++) {
                const ac1 = involvedAc[i];
                const ac2 = involvedAc[j];
                if (!ac1 || !ac2) continue;
                
                const ac1Pos = coordinateSystem.toPlane(ac1.latitude, ac1.longitude);
                const ac2Pos = coordinateSystem.toPlane(ac2.latitude, ac2.longitude);
                
                ctx.beginPath();
                ctx.moveTo(ac1Pos.x, -ac1Pos.y);
                ctx.lineTo(ac2Pos.x, -ac2Pos.y);
                ctx.stroke();
              }
            }
            ctx.setLineDash([]);
          }
        }
        
        // 충돌 정보 텍스트
        ctx.fillStyle = color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        
        // 충돌 타입
        let typeText = '';
        if (conflict.type === 'RUNWAY_INCURSION') {
          typeText = '활주로 침범';
        } else if (conflict.type === 'TAKEOFF_HOLD') {
          typeText = '이륙 대기';
        } else if (conflict.type === 'INTERSECTION_CONFLICT') {
          typeText = '교차점 충돌';
        }
        
        ctx.fillText(typeText, conflictPos.x, -conflictPos.y - pulseSize - 5);
        
        // 충돌까지 남은 시간 (있는 경우)
        const conflictAge = (currentTime - conflict.timestamp) / 1000; // 초 단위
        if (conflictAge < 60) { // 1분 이내 충돌만 표시
          ctx.font = '12px Arial';
          ctx.fillText(`${conflictAge.toFixed(1)}초 전`, conflictPos.x, -conflictPos.y - pulseSize - 20);
        }
        
        // 관련 항공기 표시
        if (conflict.involvedAircraft && conflict.involvedAircraft.length > 0) {
          ctx.font = '11px Arial';
          ctx.fillText(
            conflict.involvedAircraft.join(', '), 
            conflictPos.x, 
            -conflictPos.y + pulseSize + 15
          );
        }
      });
    }
    
    ctx.restore();
    
    // 범례 (스케일 영향 받지 않음)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(canvas.width - 260, 10, 250, 240);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('내부 로직 뷰 범례', canvas.width - 250, 30);
    
    ctx.font = '12px Arial';
    
    // 실제 활주로
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width - 240, 50);
    ctx.lineTo(canvas.width - 200, 50);
    ctx.stroke();
    ctx.fillText('실제 활주로 위치', canvas.width - 190, 55);
    
    // 로직 영역
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(canvas.width - 240, 70);
    ctx.lineTo(canvas.width - 200, 70);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('내부 로직 판단 영역', canvas.width - 190, 75);
    
    // 항공기 상태
    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.beginPath();
    ctx.arc(canvas.width - 220, 90, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('활주로 점유 항공기', canvas.width - 190, 95);
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(canvas.width - 220, 110, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('활주로 외부 항공기', canvas.width - 190, 115);
    
    // 충돌 심각도 범례
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('충돌 심각도', canvas.width - 240, 140);
    ctx.font = '11px Arial';
    
    // CRITICAL - 빨간색 점멸
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvas.width - 220, 155, 6, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(canvas.width - 220, 155, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('위험 (점멸)', canvas.width - 190, 160);
    
    // HIGH - 빨간색
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(canvas.width - 220, 175, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('높음', canvas.width - 190, 180);
    
    // MEDIUM - 주황색
    ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(canvas.width - 220, 195, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('보통', canvas.width - 190, 200);
    
    // LOW - 노란색
    ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(canvas.width - 220, 215, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText('낮음', canvas.width - 190, 220);
    
    // 충돌 연결선
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(canvas.width - 240, 235);
    ctx.lineTo(canvas.width - 200, 235);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'white';
    ctx.fillText('충돌 항공기 연결선', canvas.width - 190, 240);
    
    ctx.restore();
  };

  // 레이어 분리 캔버스 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // 캔버스 초기화
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a1a1a'; // 어두운 배경
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const GIMPO_CENTER = { lat: 37.5587, lng: 126.7905 };

      // 내부 로직 뷰 모드 분기
      if (showInternalLogic) {
        renderInternalLogicView(ctx, canvas);
        
        // CRITICAL 충돌이 있을 때만 애니메이션 계속 실행
        if (rwslState && rwslState.conflicts && 
            rwslState.conflicts.some(c => c.severity === 'CRITICAL')) {
          animationFrameId = requestAnimationFrame(render);
        } else {
          // CRITICAL 충돌이 없을 때도 프레임 요청
          animationFrameId = requestAnimationFrame(render);
        }
        return;
      }

    // Layer 1: OSM/위성 타일 배경 (별도 캔버스에서 복사)
    if ((showOSMMap || showSatelliteMap) && osmCanvasRef.current) {
      ctx.save();
      ctx.globalAlpha = osmOpacity;
      ctx.filter = `brightness(${osmBrightness})`;
      ctx.drawImage(osmCanvasRef.current, 0, 0);
      ctx.filter = 'none';
      ctx.restore();
    }

    // Layer 1.5: 벡터맵 오버레이 (필터 없이 직접 렌더링)
    if (showVectorMap && mapImage && mapImage.complete) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(scale, scale);
      
      // 위성지도와 OSM에 따라 다른 오프셋 적용
      const currentOffsetX = showSatelliteMap ? satelliteOffsetX : globalOffsetX;
      const currentOffsetY = showSatelliteMap ? satelliteOffsetY : globalOffsetY;
      ctx.translate(panX + currentOffsetX, panY + currentOffsetY);
      
      // 벡터맵 조정 (위성지도일 때는 다른 값 사용)
      const currentMapOffsetX = showSatelliteMap ? satelliteMapOffsetX : mapOffsetX;
      const currentMapOffsetY = showSatelliteMap ? satelliteMapOffsetY : mapOffsetY;
      ctx.translate(currentMapOffsetX, currentMapOffsetY);
      ctx.rotate(mapRotation * Math.PI / 180);
      ctx.scale(mapScaleAdjust, mapScaleAdjust);
      
      ctx.globalAlpha = 0.9;
      ctx.drawImage(mapImage, -mapImage.width / 2, -mapImage.height / 2);
      
      ctx.restore();
    }

    // Layer 2: 활주로 및 인프라 (줌에 영향 받음)
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    
    // 팬 오프셋만 적용 (활주로는 고정)
    ctx.translate(panX, panY);

    // 픽셀당 도 계산 (줌 레벨 14 기준)
    const degreesPerPixel = 360 / (256 * Math.pow(2, 14));
    const pixelsPerDegree = 1 / degreesPerPixel;

    // 활주로 그리기
    ctx.strokeStyle = showOSMMap ? 'rgba(255, 255, 255, 0.8)' : '#ffffff';
    ctx.lineWidth = Math.max(3, 3 / scale); // 최소 선 두께 보장
    localRunways.forEach((runway, index) => {
      ctx.beginPath();
      // OSM과 동일한 스케일 사용
      const startPixel = latLngToPixel(
        runway.centerline.start.lat, 
        runway.centerline.start.lng, 
        14, // 기준 줌 레벨
        GIMPO_CENTER.lat, 
        GIMPO_CENTER.lng
      );
      const endPixel = latLngToPixel(
        runway.centerline.end.lat, 
        runway.centerline.end.lng, 
        14,
        GIMPO_CENTER.lat, 
        GIMPO_CENTER.lng
      );
      
      // 활주로 간격 조정 (14R/32L은 오른쪽으로 이동)
      let adjustedStartX = startPixel.x;
      let adjustedEndX = endPixel.x;
      if (runway.id === '14R/32L') {
        // 활주로 방향에 수직으로 간격 조정
        const angle = Math.atan2(endPixel.y - startPixel.y, endPixel.x - startPixel.x);
        const perpAngle = angle + Math.PI / 2;
        adjustedStartX += Math.cos(perpAngle) * runwaySpacing;
        adjustedEndX += Math.cos(perpAngle) * runwaySpacing;
        startPixel.y += Math.sin(perpAngle) * runwaySpacing;
        endPixel.y += Math.sin(perpAngle) * runwaySpacing;
      }
      
      ctx.moveTo(adjustedStartX, startPixel.y);
      ctx.lineTo(adjustedEndX, endPixel.y);
      ctx.stroke();
      
      // 활주로 번호 표시
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(16, 16 / scale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 14L/14R
      ctx.save();
      ctx.translate(adjustedStartX, startPixel.y);
      ctx.rotate(Math.atan2(endPixel.y - startPixel.y, adjustedEndX - adjustedStartX) + Math.PI / 2);
      ctx.fillText(runway.id.split('/')[0], 0, -30);
      ctx.restore();
      
      // 32R/32L
      ctx.save();
      ctx.translate(adjustedEndX, endPixel.y);
      ctx.rotate(Math.atan2(startPixel.y - endPixel.y, adjustedStartX - adjustedEndX) + Math.PI / 2);
      ctx.fillText(runway.id.split('/')[1], 0, -30);
      ctx.restore();
    });

    // 활주로 경계 표시 (디버그용) - 렌더링 좌표계로 변환
    if (showRunwayBounds || showInternalLogic) {
      // 실제 활주로 Y 위치 계산
      const runway14L = coordinateSystem.toPlane(37.5705, 126.7784);
      const runway32R = coordinateSystem.toPlane(37.5478, 126.8070);
      const runway14R = coordinateSystem.toPlane(37.5683, 126.7755);
      const runway32L = coordinateSystem.toPlane(37.5481, 126.8009);
      
      const northRunwayY = (runway14L.y + runway32R.y) / 2;
      const southRunwayY = (runway14R.y + runway32L.y) / 2;
      
      // 활주로 점유 상태에 따라 색상 변경 (실제 활주로 방향 기반)
      const checkRunwayOccupancy = (runwayIndex: number) => {
        const runway = localRunways[runwayIndex];
        const start = coordinateSystem.toPlane(runway.centerline.start.lat, runway.centerline.start.lng);
        const end = coordinateSystem.toPlane(runway.centerline.end.lat, runway.centerline.end.lng);
        
        const runwayVector = { x: end.x - start.x, y: end.y - start.y };
        const runwayLength = Math.sqrt(runwayVector.x * runwayVector.x + runwayVector.y * runwayVector.y);
        const runwayDir = { x: runwayVector.x / runwayLength, y: runwayVector.y / runwayLength };
        
        const halfWidth = (runwayIndex === 0 ? 45 : 60) / 2 + 10;
        const lengthMargin = 50;
        
        return aircraft.some(ac => {
          const localPos = coordinateSystem.toPlane(ac.latitude, ac.longitude);
          const aircraftVector = { x: localPos.x - start.x, y: localPos.y - start.y };
          const projection = aircraftVector.x * runwayDir.x + aircraftVector.y * runwayDir.y;
          const perpDistance = Math.abs(aircraftVector.x * (-runwayDir.y) + aircraftVector.y * runwayDir.x);
          
          return projection >= -lengthMargin && projection <= runwayLength + lengthMargin && perpDistance <= halfWidth;
        });
      };
      
      let northRunwayOccupied = checkRunwayOccupancy(0);
      let southRunwayOccupied = checkRunwayOccupancy(1);
      
      ctx.lineWidth = Math.max(3, 3 / scale);
      ctx.setLineDash([]);
      
      // 14L_32R - 실제 활주로 중심선 데이터 사용
      const runway14L32R = localRunways[0];
      const start14L = coordinateSystem.toPlane(runway14L32R.centerline.start.lat, runway14L32R.centerline.start.lng);
      const end32R = coordinateSystem.toPlane(runway14L32R.centerline.end.lat, runway14L32R.centerline.end.lng);
      
      // 활주로 방향 벡터와 수직 벡터 계산
      const dx = end32R.x - start14L.x;
      const dy = end32R.y - start14L.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const dirX = dx / length;
      const dirY = dy / length;
      
      // 수직 벡터 (90도 회전)
      const perpX = -dirY;
      const perpY = dirX;
      
      // 활주로 폭 60m (±30m)
      const halfWidth = 30;
      
      // 활주로 네 모서리 계산
      const northCorners = [
        coordinateSystem.toWGS84(start14L.x + perpX * halfWidth, start14L.y + perpY * halfWidth),
        coordinateSystem.toWGS84(start14L.x - perpX * halfWidth, start14L.y - perpY * halfWidth),
        coordinateSystem.toWGS84(end32R.x - perpX * halfWidth, end32R.y - perpY * halfWidth),
        coordinateSystem.toWGS84(end32R.x + perpX * halfWidth, end32R.y + perpY * halfWidth)
      ];
      
      // showInternalLogic이 true일 때 활주로 점유 정보 사용
      let northOccupancyInfo = null;
      if (showInternalLogic && runwayOccupancy.has('14L_32R')) {
        northOccupancyInfo = runwayOccupancy.get('14L_32R');
        northRunwayOccupied = northOccupancyInfo?.occupied || false;
      }
      
      // 점유 상태에 따라 색상 설정
      if (showInternalLogic && northOccupancyInfo?.occupied) {
        // 점유 타입별 색상
        const occupancyColors = {
          'TAKEOFF': 'rgba(59, 130, 246, 0.8)', // 파란색
          'LANDING': 'rgba(249, 115, 22, 0.8)', // 주황색
          'TAXI': 'rgba(234, 179, 8, 0.8)', // 노란색
          'LINEUP': 'rgba(255, 255, 255, 0.8)' // 흰색
        };
        const occupancyType = northOccupancyInfo.occupancyType || 'TAXI';
        ctx.strokeStyle = occupancyColors[occupancyType] || 'rgba(255, 0, 0, 0.8)';
        ctx.fillStyle = occupancyColors[occupancyType]?.replace('0.8', '0.3') || 'rgba(255, 0, 0, 0.3)';
      } else {
        ctx.strokeStyle = northRunwayOccupied ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 255, 0, 0.5)';
      }
      
      // 픽셀로 변환하여 그리기
      ctx.beginPath();
      northCorners.forEach((corner, i) => {
        const pixel = latLngToPixel(corner.lat, corner.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
        if (i === 0) ctx.moveTo(pixel.x, pixel.y);
        else ctx.lineTo(pixel.x, pixel.y);
      });
      ctx.closePath();
      if (showInternalLogic && northOccupancyInfo?.occupied) {
        ctx.fill();
      }
      ctx.stroke();
      
      // 14R_32L - 실제 활주로 중심선 데이터 사용
      const runway14R32L = localRunways[1];
      const start14R = coordinateSystem.toPlane(runway14R32L.centerline.start.lat, runway14R32L.centerline.start.lng);
      const end32L = coordinateSystem.toPlane(runway14R32L.centerline.end.lat, runway14R32L.centerline.end.lng);
      
      // 활주로 방향 벡터와 수직 벡터 계산 (14L/32R과 동일한 방법)
      const dx2 = end32L.x - start14R.x;
      const dy2 = end32L.y - start14R.y;
      const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const dirX2 = dx2 / length2;
      const dirY2 = dy2 / length2;
      
      // 수직 벡터
      const perpX2 = -dirY2;
      const perpY2 = dirX2;
      
      // 활주로 네 모서리 계산
      const southCorners = [
        coordinateSystem.toWGS84(start14R.x + perpX2 * halfWidth, start14R.y + perpY2 * halfWidth),
        coordinateSystem.toWGS84(start14R.x - perpX2 * halfWidth, start14R.y - perpY2 * halfWidth),
        coordinateSystem.toWGS84(end32L.x - perpX2 * halfWidth, end32L.y - perpY2 * halfWidth),
        coordinateSystem.toWGS84(end32L.x + perpX2 * halfWidth, end32L.y + perpY2 * halfWidth)
      ];
      
      // showInternalLogic이 true일 때 활주로 점유 정보 사용
      let southOccupancyInfo = null;
      if (showInternalLogic && runwayOccupancy.has('14R_32L')) {
        southOccupancyInfo = runwayOccupancy.get('14R_32L');
        southRunwayOccupied = southOccupancyInfo?.occupied || false;
      }
      
      // 점유 상태에 따라 색상 설정
      if (showInternalLogic && southOccupancyInfo?.occupied) {
        // 점유 타입별 색상
        const occupancyColors = {
          'TAKEOFF': 'rgba(59, 130, 246, 0.8)', // 파란색
          'LANDING': 'rgba(249, 115, 22, 0.8)', // 주황색
          'TAXI': 'rgba(234, 179, 8, 0.8)', // 노란색
          'LINEUP': 'rgba(255, 255, 255, 0.8)' // 흰색
        };
        const occupancyType = southOccupancyInfo.occupancyType || 'TAXI';
        ctx.strokeStyle = occupancyColors[occupancyType] || 'rgba(255, 0, 0, 0.8)';
        ctx.fillStyle = occupancyColors[occupancyType]?.replace('0.8', '0.3') || 'rgba(255, 0, 0, 0.3)';
      } else {
        ctx.strokeStyle = southRunwayOccupied ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 255, 0, 0.5)';
      }
      
      ctx.beginPath();
      southCorners.forEach((corner, i) => {
        const pixel = latLngToPixel(corner.lat, corner.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
        if (i === 0) ctx.moveTo(pixel.x, pixel.y);
        else ctx.lineTo(pixel.x, pixel.y);
      });
      ctx.closePath();
      if (showInternalLogic && southOccupancyInfo?.occupied) {
        ctx.fill();
      }
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // 경계 라벨 - 왼쪽 위 모서리에 표시
      ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.font = `${Math.max(12, 12 / scale)}px Arial`;
      ctx.textAlign = 'left';
      
      const northLabelPixel = latLngToPixel(northCorners[3].lat, northCorners[3].lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
      ctx.fillText('14L/32R 경계', northLabelPixel.x + 10, northLabelPixel.y + 20);
      
      const southLabelPixel = latLngToPixel(southCorners[0].lat, southCorners[0].lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
      ctx.fillText('14R/32L 경계', southLabelPixel.x + 10, southLabelPixel.y - 10);
      
      // 활주로 점유 정보 패널 표시 (showInternalLogic이 true일 때만)
      if (showInternalLogic) {
        // 점유 타입별 색상을 위한 객체 정의
        const occupancyColors = {
          'TAKEOFF': 'rgba(59, 130, 246, 0.8)', // 파란색
          'LANDING': 'rgba(249, 115, 22, 0.8)', // 주황색
          'TAXI': 'rgba(234, 179, 8, 0.8)', // 노란색
          'LINEUP': 'rgba(255, 255, 255, 0.8)' // 흰색
        };
        
        // 14L/32R 점유 정보
        if (northOccupancyInfo?.occupied) {
          const panelX = northLabelPixel.x + 150;
          const panelY = northLabelPixel.y - 10;
          
          // 패널 배경
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          const northOccType = northOccupancyInfo.occupancyType || 'TAXI';
          ctx.strokeStyle = occupancyColors[northOccType] || 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(panelX, panelY, 200, 100, 5);
          ctx.fill();
          ctx.stroke();
          
          // 패널 내용
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('14L/32R 점유', panelX + 10, panelY + 20);
          
          ctx.font = '12px Arial';
          ctx.fillStyle = occupancyColors[northOccType] || 'rgba(255, 255, 255, 0.8)';
          ctx.fillText(`상태: ${northOccType}`, panelX + 10, panelY + 40);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          if (northOccupancyInfo.aircraft?.length > 0) {
            ctx.fillText(`항공기: ${northOccupancyInfo.aircraft[0].callsign}`, panelX + 10, panelY + 60);
          }
          
          if (northOccupancyInfo.occupancyDetails) {
            const exitTime = new Date(northOccupancyInfo.occupancyDetails.estimatedExitTime);
            const remainingTime = Math.max(0, exitTime.getTime() - Date.now());
            const seconds = Math.floor(remainingTime / 1000);
            ctx.fillText(`예상 이탈: ${seconds}초`, panelX + 10, panelY + 80);
          }
        }
        
        // 14R/32L 점유 정보
        if (southOccupancyInfo?.occupied) {
          const panelX = southLabelPixel.x + 150;
          const panelY = southLabelPixel.y - 60;
          
          // 패널 배경
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          const southOccType = southOccupancyInfo.occupancyType || 'TAXI';
          ctx.strokeStyle = occupancyColors[southOccType] || 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(panelX, panelY, 200, 100, 5);
          ctx.fill();
          ctx.stroke();
          
          // 패널 내용
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('14R/32L 점유', panelX + 10, panelY + 20);
          
          ctx.font = '12px Arial';
          ctx.fillStyle = occupancyColors[southOccType] || 'rgba(255, 255, 255, 0.8)';
          ctx.fillText(`상태: ${southOccType}`, panelX + 10, panelY + 40);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          if (southOccupancyInfo.aircraft?.length > 0) {
            ctx.fillText(`항공기: ${southOccupancyInfo.aircraft[0].callsign}`, panelX + 10, panelY + 60);
          }
          
          if (southOccupancyInfo.occupancyDetails) {
            const exitTime = new Date(southOccupancyInfo.occupancyDetails.estimatedExitTime);
            const remainingTime = Math.max(0, exitTime.getTime() - Date.now());
            const seconds = Math.floor(remainingTime / 1000);
            ctx.fillText(`예상 이탈: ${seconds}초`, panelX + 10, panelY + 80);
          }
        }
      }
    }

    // 감지 구역 오버레이 (showInternalLogic과 showDetectionZones가 true일 때만)
    if (showInternalLogic && showDetectionZones) {
      // 마우스 호버 상태 관리를 위한 변수 - objectFit: contain 고려
      const rect = canvas.getBoundingClientRect();
      const canvasAspect = canvas.width / canvas.height;
      const rectAspect = rect.width / rect.height;
      
      let renderWidth, renderHeight, offsetX, offsetY;
      
      if (canvasAspect > rectAspect) {
        // Canvas가 더 넓은 경우 - 위아래 레터박스
        renderWidth = rect.width;
        renderHeight = rect.width / canvasAspect;
        offsetX = 0;
        offsetY = (rect.height - renderHeight) / 2;
      } else {
        // Canvas가 더 높은 경우 - 좌우 필러박스
        renderWidth = rect.height * canvasAspect;
        renderHeight = rect.height;
        offsetX = (rect.width - renderWidth) / 2;
        offsetY = 0;
      }
      
      // 실제 캔버스 좌표로 변환
      const canvasX = ((mousePos.x - offsetX) / renderWidth) * canvas.width;
      const canvasY = ((mousePos.y - offsetY) / renderHeight) * canvas.height;
      
      // 월드 좌표로 변환
      const mouseWorldX = (canvasX - canvas.width / 2) / scale - panX;
      const mouseWorldY = (canvasY - canvas.height / 2) / scale - panY;
      const mousePixel = { x: mouseWorldX, y: mouseWorldY };
      
      // REL 감지 반경 (1000m)
      ctx.save();
      rwslLines.filter(line => line.type === 'REL').forEach(rel => {
        if (rel.points.length > 0) {
          const centerPoint = rel.points[Math.floor(rel.points.length / 2)];
          const centerPixel = latLngToPixel(centerPoint.y, centerPoint.x, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
          
          // 마우스와의 거리 계산
          const distance = Math.sqrt(
            Math.pow(mousePixel.x - centerPixel.x, 2) + 
            Math.pow(mousePixel.y - centerPixel.y, 2)
          );
          
          // 1000m를 픽셀로 변환 (zoom 14 기준)
          const radiusInPixels = 1000 / (156543.03392 * Math.cos(GIMPO_CENTER.lat * Math.PI / 180) / Math.pow(2, 14));
          
          // 호버 상태 확인
          const isHovered = distance <= radiusInPixels;
          
          // 감지 구역 원 그리기
          ctx.fillStyle = isHovered ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)';
          ctx.strokeStyle = isHovered ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.4)';
          ctx.lineWidth = isHovered ? 2 : 1;
          
          ctx.beginPath();
          ctx.arc(centerPixel.x, centerPixel.y, radiusInPixels, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // 라벨 표시 (호버 시)
          if (isHovered) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${rel.id} 감지구역 (1000m)`, centerPixel.x, centerPixel.y - radiusInPixels - 10);
          }
        }
      });
      
      // THL 감지 반경 (457m)
      rwslLines.filter(line => line.type === 'THL').forEach(thl => {
        if (thl.points.length > 0) {
          const centerPixel = latLngToPixel(thl.points[0].y, thl.points[0].x, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
          
          // 마우스와의 거리 계산
          const distance = Math.sqrt(
            Math.pow(mousePixel.x - centerPixel.x, 2) + 
            Math.pow(mousePixel.y - centerPixel.y, 2)
          );
          
          // 457m를 픽셀로 변환
          const radiusInPixels = 457 / (156543.03392 * Math.cos(GIMPO_CENTER.lat * Math.PI / 180) / Math.pow(2, 14));
          
          // 호버 상태 확인
          const isHovered = distance <= radiusInPixels;
          
          // 감지 구역 원 그리기
          ctx.fillStyle = isHovered ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.15)';
          ctx.strokeStyle = isHovered ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 0.4)';
          ctx.lineWidth = isHovered ? 2 : 1;
          
          ctx.beginPath();
          ctx.arc(centerPixel.x, centerPixel.y, radiusInPixels, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // 라벨 표시 (호버 시)
          if (isHovered) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${thl.id} 감지구역 (457m)`, centerPixel.x, centerPixel.y - radiusInPixels - 10);
          }
        }
      });
      
      // 부채꼴 접근 감지 영역 (활주로 끝에서)
      localRunways.forEach((runway, idx) => {
        // 각 활주로 끝(threshold)에 대해 부채꼴 그리기
        ['14L', '14R', '32L', '32R'].forEach(thresholdId => {
          const threshold = runway.thresholds?.[thresholdId];
          if (!threshold) return;
          
          const thresholdPixel = latLngToPixel(threshold.lat, threshold.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
          
          // 부채꼴 파라미터
          const sectorRadius = 3000 / (156543.03392 * Math.cos(GIMPO_CENTER.lat * Math.PI / 180) / Math.pow(2, 14)); // 3km
          const sectorAngle = 30 * Math.PI / 180; // 30도
          const heading = threshold.heading * Math.PI / 180;
          
          // 마우스가 부채꼴 내부에 있는지 확인
          const mouseAngle = Math.atan2(mousePixel.y - thresholdPixel.y, mousePixel.x - thresholdPixel.x);
          const mouseDistance = Math.sqrt(
            Math.pow(mousePixel.x - thresholdPixel.x, 2) + 
            Math.pow(mousePixel.y - thresholdPixel.y, 2)
          );
          
          // 각도 차이 계산 (정규화)
          let angleDiff = Math.abs(mouseAngle - (heading - Math.PI/2));
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          
          const isHovered = mouseDistance <= sectorRadius && angleDiff <= sectorAngle / 2;
          
          // 부채꼴 그리기
          ctx.fillStyle = isHovered ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.15)';
          ctx.strokeStyle = isHovered ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.4)';
          ctx.lineWidth = isHovered ? 2 : 1;
          
          ctx.beginPath();
          ctx.moveTo(thresholdPixel.x, thresholdPixel.y);
          ctx.arc(
            thresholdPixel.x, 
            thresholdPixel.y, 
            sectorRadius,
            heading - Math.PI/2 - sectorAngle/2,
            heading - Math.PI/2 + sectorAngle/2
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // 라벨 표시 (호버 시)
          if (isHovered) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            const labelX = thresholdPixel.x + Math.cos(heading - Math.PI/2) * sectorRadius * 0.7;
            const labelY = thresholdPixel.y + Math.sin(heading - Math.PI/2) * sectorRadius * 0.7;
            ctx.fillText(`${thresholdId} 접근 감지구역 (3km)`, labelX, labelY);
          }
        });
      });
      
      // 활주로 보호 구역 (활주로 주변 100m)
      localRunways.forEach((runway, idx) => {
        const start = coordinateSystem.toPlane(runway.centerline.start.lat, runway.centerline.start.lng);
        const end = coordinateSystem.toPlane(runway.centerline.end.lat, runway.centerline.end.lng);
        
        // 활주로 방향 벡터
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const dirX = dx / length;
        const dirY = dy / length;
        
        // 수직 벡터
        const perpX = -dirY;
        const perpY = dirX;
        
        // 보호구역 폭 (활주로 폭 + 100m)
        const protectionWidth = (runway.width + 100) / 2;
        
        // 보호구역 네 모서리
        const corners = [
          coordinateSystem.toWGS84(start.x + perpX * protectionWidth, start.y + perpY * protectionWidth),
          coordinateSystem.toWGS84(start.x - perpX * protectionWidth, start.y - perpY * protectionWidth),
          coordinateSystem.toWGS84(end.x - perpX * protectionWidth, end.y - perpY * protectionWidth),
          coordinateSystem.toWGS84(end.x + perpX * protectionWidth, end.y + perpY * protectionWidth)
        ];
        
        // 마우스가 보호구역 내부에 있는지 확인
        const cornerPixels = corners.map(c => latLngToPixel(c.lat, c.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng));
        const isHovered = isPointInPolygon(mousePixel, cornerPixels);
        
        // 보호구역 그리기
        ctx.fillStyle = isHovered ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.15)';
        ctx.strokeStyle = isHovered ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        cornerPixels.forEach((pixel, i) => {
          if (i === 0) ctx.moveTo(pixel.x, pixel.y);
          else ctx.lineTo(pixel.x, pixel.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 라벨 표시 (호버 시)
        if (isHovered) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          const centerPixel = latLngToPixel(
            (runway.centerline.start.lat + runway.centerline.end.lat) / 2,
            (runway.centerline.start.lng + runway.centerline.end.lng) / 2,
            14, GIMPO_CENTER.lat, GIMPO_CENTER.lng
          );
          ctx.fillText(`${runway.id} 활주로 보호구역`, centerPixel.x, centerPixel.y);
        }
      });
      
      ctx.restore();
    }

    // RWSL 조명 그리기 (줌에 영향 받되 최소 크기 보장)
    rwslLines.forEach(line => {
      // 활성화된 등화 또는 위치 시각화 모드일 때 표시
      if (line.active || showLightPositions) {
        // 타입별 토글 확인
        if (line.type === 'REL' && !showRELLights) return;
        if (line.type === 'THL' && !showTHLLights) return;
        // 색상 설정
        let lightColor: string;
        if (showLightPositions && !line.active) {
          // 비활성 등화 위치 표시
          lightColor = line.type === 'REL' ? 'rgba(255, 100, 100, 0.4)' : 
                       line.type === 'THL' ? 'rgba(255, 255, 100, 0.4)' : 
                       'rgba(100, 200, 255, 0.4)'; // RIL
        } else {
          // 활성 등화 색상
          lightColor = line.type === 'REL' ? '#ff0000' : 
                       line.type === 'THL' ? '#ffff00' : 
                       '#00ccff'; // RIL
        }
        ctx.strokeStyle = lightColor;
        
        // 등화 타입별 렌더링
        if (line.type === 'RIL' && line.points.length === 1) {
          // RIL은 원으로 표시
          const pixel = latLngToPixel(line.points[0].y, line.points[0].x, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
          const radius = Math.max(6, 6 / scale);
          
          ctx.fillStyle = lightColor;
          ctx.beginPath();
          ctx.arc(pixel.x, pixel.y, radius, 0, 2 * Math.PI);
          ctx.fill();
          
          if (line.active) {
            // 활성화시 외곽선 추가
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(2, 2 / scale);
            ctx.stroke();
          }
        } else if (line.type === 'THL' && line.points.length === 1) {
          // THL은 사각형으로 표시
          const pixel = latLngToPixel(line.points[0].y, line.points[0].x, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
          const size = Math.max(8, 8 / scale);
          
          ctx.fillStyle = lightColor;
          ctx.strokeStyle = lightColor;
          ctx.lineWidth = Math.max(2, 2 / scale);
          
          if (line.active) {
            // 활성화된 THL은 채우기
            ctx.fillRect(pixel.x - size/2, pixel.y - size/2, size, size);
          } else {
            // 비활성 THL은 테두리만
            ctx.strokeRect(pixel.x - size/2, pixel.y - size/2, size, size);
          }
        } else {
          // REL은 선으로 표시
          // RWSL 연결선 토글 확인
          if (showRWSLLines) {
            ctx.lineWidth = Math.max(4, 4 / scale);
            ctx.beginPath();
            
            line.points.forEach((point, index) => {
              const pixel = latLngToPixel(point.y, point.x, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
              
              if (index === 0) {
                ctx.moveTo(pixel.x, pixel.y);
              } else {
                ctx.lineTo(pixel.x, pixel.y);
              }
            });
            ctx.stroke();
          }
        }
        
      }
    });

    ctx.restore();

    // Layer 3: REL/THL 등화 시각화 (항상 활성화된 등화는 표시)
    if (showRWSLLines || showRELLights || showTHLLights) {
      rwslLines.forEach(line => {
        // REL과 THL 타입별 표시 조건 확인
        const shouldShowREL = line.type === 'REL' && (showRELLights || line.active);
        const shouldShowTHL = line.type === 'THL' && (showTHLLights || line.active);
        const shouldShowByPosition = showLightPositions; // 등화 위치 표시 모드
        
        if (shouldShowREL || shouldShowTHL || shouldShowByPosition) {
          const centerPoint = line.points[Math.floor(line.points.length / 2)];
          const worldPixel = latLngToPixel(centerPoint.y, centerPoint.x, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
          
          // 스크린 좌표로 변환 (활주로 기준)
          const screenX = canvas.width / 2 + (worldPixel.x * scale) + (panX) * scale;
          const screenY = canvas.height / 2 + (worldPixel.y * scale) + (panY) * scale;
          
          // 화면에 보이는 경우에만 렌더링
          if (screenX >= -100 && screenX <= canvas.width + 100 && 
              screenY >= -100 && screenY <= canvas.height + 100) {
            
            // 등화 아이콘 그리기
            const iconSize = 6;
            const lineWidth = 2;
            
            // 타입별 색상 및 크기
            let iconColor = 'rgba(255, 255, 255, 0.7)';
            let iconSizeMultiplier = 1;
            
            if (line.active) {
              iconColor = line.type === 'REL' ? '#ff0000' : '#ffcc00'; // REL은 더 진한 빨간색
              iconSizeMultiplier = 1.5; // 활성화된 등화는 50% 더 크게
              console.log(`[시각화] 활성화된 ${line.type} 등화: ${line.id}`);
            }
            
            // 타입별 아이콘 그리기
            ctx.strokeStyle = iconColor;
            ctx.fillStyle = iconColor;
            ctx.lineWidth = line.active ? lineWidth + 1 : lineWidth; // 활성화된 등화는 더 두꺼운 선
            
            const adjustedIconSize = iconSize * iconSizeMultiplier;
            
            if (line.type === 'REL') {
              // REL: 다이아몬드
              ctx.beginPath();
              ctx.moveTo(screenX, screenY - adjustedIconSize);
              ctx.lineTo(screenX + adjustedIconSize, screenY);
              ctx.lineTo(screenX, screenY + adjustedIconSize);
              ctx.lineTo(screenX - adjustedIconSize, screenY);
              ctx.closePath();
              
              if (line.active) {
                ctx.fill(); // 활성화된 REL은 항상 채우기
              } else if (line.id.endsWith('_D')) {
                ctx.fill(); // 출발 REL은 채우기
              } else {
                ctx.stroke(); // 도착 REL은 테두리만
              }
            } else if (line.type === 'THL') {
              // THL: 사각형
              ctx.beginPath();
              ctx.rect(screenX - adjustedIconSize, screenY - adjustedIconSize, adjustedIconSize * 2, adjustedIconSize * 2);
              if (line.active) {
                ctx.fill(); // 활성화된 THL은 채우기
              } else {
                ctx.stroke(); // 비활성 THL은 테두리만
              }
            }
            
            // 등화 정보 텍스트 (영구 표시) - 항공기와 동일한 방식
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Arial'; // 항공기와 동일한 크기
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            const textX = screenX + iconSize + 8; // 아이콘 옆에 위치
            const textY = screenY;
            
            // 등화 ID 표시
            const displayText = line.id;
            ctx.strokeText(displayText, textX, textY);
            ctx.fillText(displayText, textX, textY);
          }
        }
      });
    }

    // Layer 4: 항공기 및 텍스트 (고정 크기)
    aircraft.forEach(ac => {
      // 월드 좌표를 스크린 좌표로 변환
      const worldPixel = latLngToPixel(ac.latitude, ac.longitude, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
      
      // 스크린 좌표로 변환 (활주로 기준)
      const screenX = canvas.width / 2 + (worldPixel.x * scale) + (panX) * scale;
      const screenY = canvas.height / 2 + (worldPixel.y * scale) + (panY) * scale;
      
      // 뷰포트 내부에 있는 항공기만 그리기
      if (screenX >= -50 && screenX <= canvas.width + 50 && 
          screenY >= -50 && screenY <= canvas.height + 50) {
        
        // 항공기 아이콘 (빈 원과 헤딩 표시)
        const iconSize = 10; // 10px로 증가
        const lineWidth = 2.5;
        
        // 항공기 상태 판단
        let aircraftState: 'TAKEOFF' | 'LANDING' | 'TAXI' | 'LINEUP' | 'AIRBORNE' = 'AIRBORNE';
        let aircraftColor = '#9ca3af'; // 기본 색상
        let showArrow = false;
        let arrowDirection: 'up' | 'down' | null = null;
        
        if (showInternalLogic) {
          // 상세 상태 판단 (showInternalLogic이 true일 때만)
          const speedKnots = ac.speed || 0;
          const verticalSpeed = ac.verticalSpeed || 0;
          
          if (speedKnots >= 50 && verticalSpeed > 0) {
            aircraftState = 'TAKEOFF';
            aircraftColor = '#3b82f6'; // 파란색
            showArrow = true;
            arrowDirection = 'up';
          } else if (speedKnots >= 50 && verticalSpeed <= 0) {
            aircraftState = 'LANDING';
            aircraftColor = '#f97316'; // 주황색
            showArrow = true;
            arrowDirection = 'down';
          } else if (speedKnots >= 5 && speedKnots < 50) {
            aircraftState = 'TAXI';
            aircraftColor = '#eab308'; // 노란색
          } else if (speedKnots < 5) {
            aircraftState = 'LINEUP';
            aircraftColor = '#ffffff'; // 흰색
          } else {
            // 고도 기반 기본 판단
            aircraftColor = ac.altitude > 50 ? '#f59e0b' : '#9ca3af';
          }
        } else {
          // 기본 색상 설정 (공중/지상 구분)
          aircraftColor = ac.altitude > 50 ? '#f59e0b' : '#9ca3af';
        }
        
        // 활주로 점유 상태 확인 (벡터 기반)
        let onRunway = '';
        const localPos = coordinateSystem.toPlane(ac.latitude, ac.longitude);
        
        // 14L/32R 활주로 확인
        const start14L = coordinateSystem.toPlane(37.5705, 126.7784);
        const end32R = coordinateSystem.toPlane(37.5478, 126.8070);
        const runway14L_32R_vector = { x: end32R.x - start14L.x, y: end32R.y - start14L.y };
        const runway14L_32R_length = Math.sqrt(runway14L_32R_vector.x * runway14L_32R_vector.x + runway14L_32R_vector.y * runway14L_32R_vector.y);
        const runway14L_32R_dir = { x: runway14L_32R_vector.x / runway14L_32R_length, y: runway14L_32R_vector.y / runway14L_32R_length };
        
        const aircraft14L_vector = { x: localPos.x - start14L.x, y: localPos.y - start14L.y };
        const projection14L = aircraft14L_vector.x * runway14L_32R_dir.x + aircraft14L_vector.y * runway14L_32R_dir.y;
        const perpDistance14L = Math.abs(aircraft14L_vector.x * (-runway14L_32R_dir.y) + aircraft14L_vector.y * runway14L_32R_dir.x);
        
        if (projection14L >= -50 && projection14L <= runway14L_32R_length + 50 && perpDistance14L <= 32.5) {
          onRunway = ' [14L/32R]';
        } else {
          // 14R/32L 활주로 확인
          const start14R = coordinateSystem.toPlane(37.5683, 126.7755);
          const end32L = coordinateSystem.toPlane(37.5481, 126.8009);
          const runway14R_32L_vector = { x: end32L.x - start14R.x, y: end32L.y - start14R.y };
          const runway14R_32L_length = Math.sqrt(runway14R_32L_vector.x * runway14R_32L_vector.x + runway14R_32L_vector.y * runway14R_32L_vector.y);
          const runway14R_32L_dir = { x: runway14R_32L_vector.x / runway14R_32L_length, y: runway14R_32L_vector.y / runway14R_32L_length };
          
          const aircraft14R_vector = { x: localPos.x - start14R.x, y: localPos.y - start14R.y };
          const projection14R = aircraft14R_vector.x * runway14R_32L_dir.x + aircraft14R_vector.y * runway14R_32L_dir.y;
          const perpDistance14R = Math.abs(aircraft14R_vector.x * (-runway14R_32L_dir.y) + aircraft14R_vector.y * runway14R_32L_dir.x);
          
          if (projection14R >= -50 && projection14R <= runway14R_32L_length + 50 && perpDistance14R <= 40) {
            onRunway = ' [14R/32L]';
          }
        }
        
        // 빈 원 그리기
        ctx.strokeStyle = aircraftColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(screenX, screenY, iconSize, 0, 2 * Math.PI);
        ctx.stroke();
        
        // 상태별 화살표 표시 (showInternalLogic이 true일 때만)
        if (showInternalLogic && showArrow && arrowDirection) {
          ctx.fillStyle = aircraftColor;
          ctx.strokeStyle = aircraftColor;
          ctx.lineWidth = lineWidth;
          
          if (arrowDirection === 'up') {
            // 위쪽 화살표 (이륙)
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - iconSize - 5);
            ctx.lineTo(screenX - 5, screenY - iconSize - 10);
            ctx.lineTo(screenX + 5, screenY - iconSize - 10);
            ctx.closePath();
            ctx.fill();
            
            // 화살표 선
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - iconSize);
            ctx.lineTo(screenX, screenY - iconSize - 10);
            ctx.stroke();
          } else if (arrowDirection === 'down') {
            // 아래쪽 화살표 (착륙)
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + iconSize + 5);
            ctx.lineTo(screenX - 5, screenY + iconSize + 10);
            ctx.lineTo(screenX + 5, screenY + iconSize + 10);
            ctx.closePath();
            ctx.fill();
            
            // 화살표 선
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + iconSize);
            ctx.lineTo(screenX, screenY + iconSize + 10);
            ctx.stroke();
          }
        }
        
        // 헤딩 선 그리기
        if (ac.heading !== undefined) {
          const headingRad = (ac.heading - 90) * Math.PI / 180; // 북쪽 기준으로 변환
          const lineLength = iconSize * 2; // 원 크기의 2배
          
          ctx.strokeStyle = aircraftColor;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(
            screenX + Math.cos(headingRad) * lineLength,
            screenY + Math.sin(headingRad) * lineLength
          );
          ctx.stroke();
          
          // 헤딩 방향 화살표 (작은 삼각형)
          const arrowSize = 4;
          const arrowX = screenX + Math.cos(headingRad) * (lineLength + arrowSize);
          const arrowY = screenY + Math.sin(headingRad) * (lineLength + arrowSize);
          
          ctx.fillStyle = aircraftColor;
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - Math.cos(headingRad - 2.5) * arrowSize,
            arrowY - Math.sin(headingRad - 2.5) * arrowSize
          );
          ctx.lineTo(
            arrowX - Math.cos(headingRad + 2.5) * arrowSize,
            arrowY - Math.sin(headingRad + 2.5) * arrowSize
          );
          ctx.closePath();
          ctx.fill();
        }
        
        // 항공기 정보 텍스트 (영구 표시)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial'; // 모든 텍스트 동일한 크기
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        const textX = screenX + iconSize + 10;
        let textY = screenY - 5;
        
        // 콜사인 (활주로 점유 상태 포함)
        const callsign = (ac.callsign || `AC${ac.id}`) + onRunway;
        ctx.strokeText(callsign, textX, textY);
        ctx.fillText(callsign, textX, textY);
        
        // 고도
        textY += 16;
        const altText = `${Math.round(ac.altitude)}ft`;
        ctx.strokeText(altText, textX, textY);
        ctx.fillText(altText, textX, textY);
        
        // 속도
        if (ac.speed !== undefined) {
          textY += 16;
          const speedText = `${Math.round(ac.speed)}kt`;
          ctx.strokeText(speedText, textX, textY);
          ctx.fillText(speedText, textX, textY);
        }
        
        // 항공기 상태 표시 (showInternalLogic이 true일 때만)
        if (showInternalLogic) {
          textY += 16;
          let stateText = '';
          switch (aircraftState) {
            case 'TAKEOFF':
              stateText = '↑ TAKEOFF';
              break;
            case 'LANDING':
              stateText = '↓ LANDING';
              break;
            case 'TAXI':
              stateText = 'TAXI';
              break;
            case 'LINEUP':
              stateText = 'LINEUP';
              break;
            default:
              stateText = 'AIRBORNE';
          }
          
          // 상태에 따른 색상 적용
          ctx.fillStyle = aircraftColor;
          ctx.strokeText(stateText, textX, textY);
          ctx.fillText(stateText, textX, textY);
          ctx.fillStyle = '#ffffff'; // 색상 복원
          
          // 수직 속도 표시 (있는 경우)
          if (ac.verticalSpeed !== undefined && ac.verticalSpeed !== 0) {
            textY += 16;
            const vsText = `VS: ${ac.verticalSpeed > 0 ? '+' : ''}${Math.round(ac.verticalSpeed)}fpm`;
            ctx.strokeText(vsText, textX, textY);
            ctx.fillText(vsText, textX, textY);
          }
        }
      }
    });
    
    // Layer 5: REL 그리기 모드 미리보기 및 클릭 포인트
    if (relDrawMode) {
      // 첫 번째 클릭 포인트 표시
      if (relDrawClicks.length > 0) {
        const firstClick = relDrawClicks[0];
        // lat/lng를 픽셀로 변환
        const worldPixel = latLngToPixel(firstClick.lat, firstClick.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
        const screenX = canvas.width / 2 + (worldPixel.x * scale) + panX * scale;
        const screenY = canvas.height / 2 + (worldPixel.y * scale) + panY * scale;
        
        // 교차점 마커
        ctx.fillStyle = '#00ff00';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // 텍스트
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText('교차점', screenX + 12, screenY - 5);
        ctx.fillText('교차점', screenX + 12, screenY - 5);
      }
      
      // 미리보기 REL 표시
      if (previewRel) {
        const posPixel = latLngToPixel(previewRel.position.lat, previewRel.position.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
        const hpPixel = latLngToPixel(previewRel.holdingPoint.lat, previewRel.holdingPoint.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(panX, panY);
        
        // REL 선 그리기 (점선)
        ctx.strokeStyle = relType === 'departure' ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 255, 100, 0.8)';
        ctx.lineWidth = 4 / scale;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(hpPixel.x, hpPixel.y);
        ctx.lineTo(posPixel.x, posPixel.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.restore();
        
        // 미리보기 라벨 (활주로 기준)
        const labelX = canvas.width / 2 + (posPixel.x * scale) + (panX) * scale;
        const labelY = canvas.height / 2 + (posPixel.y * scale) + (panY) * scale;
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        const previewText = `미리보기: ${relType === 'departure' ? '출발' : '도착'} REL`;
        ctx.strokeText(previewText, labelX + 10, labelY);
        ctx.fillText(previewText, labelX + 10, labelY);
      }
    }
    
    // 다음 프레임 요청
    animationFrameId = requestAnimationFrame(render);
    };

    // 초기 렌더링
    render();

    // cleanup 함수
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

  }, [aircraft, scale, panX, panY, globalOffsetX, globalOffsetY, satelliteOffsetX, satelliteOffsetY, satelliteMapOffsetX, satelliteMapOffsetY, runwaySpacing, showOSMMap, showSatelliteMap, osmBrightness, osmOpacity, mapImage, mapScaleAdjust, mapOffsetX, mapOffsetY, mapRotation, showLightPositions, relDrawMode, relDrawClicks, previewRel, relType, showInternalLogic, coordinateSystem, rwslState, mousePos, showVectorMap, showRELLights, showTHLLights, showRWSLLines]);

  // REL을 파일에 저장하는 함수
  const saveRELToFile = useCallback(async (newRel: any) => {
    try {
      await apiService.saveCustomREL(newRel);
      console.log('REL 저장 성공:', newRel.id);
    } catch (error) {
      console.error('REL 저장 실패:', error);
      alert('REL 저장에 실패했습니다. 콘솔을 확인하세요.');
    }
  }, []);

  // 이벤트 핸들러
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // objectFit: 'contain'을 고려한 실제 렌더링 영역 계산
    const canvasAspect = canvas.width / canvas.height;
    const rectAspect = rect.width / rect.height;
    
    let renderWidth, renderHeight, offsetX, offsetY;
    
    if (canvasAspect > rectAspect) {
      // Canvas가 더 넓은 경우 - 위아래 레터박스
      renderWidth = rect.width;
      renderHeight = rect.width / canvasAspect;
      offsetX = 0;
      offsetY = (rect.height - renderHeight) / 2;
    } else {
      // Canvas가 더 높은 경우 - 좌우 필러박스
      renderWidth = rect.height * canvasAspect;
      renderHeight = rect.height;
      offsetX = (rect.width - renderWidth) / 2;
      offsetY = 0;
    }
    
    // 실제 캔버스 좌표로 변환
    const canvasX = ((x - offsetX) / renderWidth) * canvas.width;
    const canvasY = ((y - offsetY) / renderHeight) * canvas.height;
    
    // REL 그리기 모드일 때
    if (relDrawMode) {
      // 월드 좌표로 변환
      const worldX = (canvasX - canvas.width / 2) / scale - panX;
      const worldY = (canvasY - canvas.height / 2) / scale - panY;
      
      // 픽셀을 위경도로 변환
      const GIMPO_CENTER = { lat: 37.5587, lng: 126.7905 };
      const pixelToLatLng = (px: number, py: number) => {
        const zoom = 14;
        const tileSize = 256;
        const scale = Math.pow(2, zoom);
        
        // 김포공항 중심을 픽셀 좌표로 변환
        const centerWorldX = (GIMPO_CENTER.lng + 180) / 360;
        const centerWorldY = (1 - Math.log(Math.tan(GIMPO_CENTER.lat * Math.PI / 180) + 1 / Math.cos(GIMPO_CENTER.lat * Math.PI / 180)) / Math.PI) / 2;
        const centerPixelX = centerWorldX * tileSize * scale;
        const centerPixelY = centerWorldY * tileSize * scale;
        
        // 클릭한 픽셀을 절대 픽셀 좌표로 변환
        const absoluteX = centerPixelX + px;
        const absoluteY = centerPixelY + py;
        
        // 절대 픽셀 좌표를 위경도로 변환
        const worldX = absoluteX / (tileSize * scale);
        const worldY = absoluteY / (tileSize * scale);
        
        const lng = worldX * 360 - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180 / Math.PI;
        
        return { lat, lng };
      };
      
      const clickLatLng = pixelToLatLng(worldX, worldY);
      
      if (relDrawClicks.length === 0) {
        // 첫 번째 클릭 - 교차점
        setRelDrawClicks([{x: 0, y: 0, lat: clickLatLng.lat, lng: clickLatLng.lng}]);
      } else if (relDrawClicks.length === 1) {
        // 두 번째 클릭 - 방향
        const firstClick = relDrawClicks[0];
        const firstPixel = latLngToPixel(firstClick.lat, firstClick.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
        const clickPixel = latLngToPixel(clickLatLng.lat, clickLatLng.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
        const angle = Math.atan2(clickPixel.y - firstPixel.y, clickPixel.x - firstPixel.x);
        
        // 미터를 픽셀로 변환하는 함수
        const metersToPixels = (meters: number, lat: number, zoom: number) => {
          // zoom 레벨에서 1픽셀이 나타내는 미터 수 계산
          const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
          return meters / metersPerPixel;
        };
        
        // REL 위치 계산 (90m 거리)
        const distance = 90; // meters
        const distanceInPixels = metersToPixels(distance, GIMPO_CENTER.lat, 14);
        
        // 정방향으로 통일 - 첫 클릭에서 두 번째 클릭 방향으로
        const startPoint = { lat: firstClick.lat, lng: firstClick.lng };
        const endX = firstPixel.x + Math.cos(angle) * distanceInPixels;
        const endY = firstPixel.y + Math.sin(angle) * distanceInPixels;
        const endPoint = pixelToLatLng(endX, endY);
        
        const position = startPoint;
        const holdingPoint = endPoint;
        
        // 유세로 이름 입력 받기
        const taxiwayName = prompt('유세로 이름을 입력하세요 (예: B1, C3):');
        if (!taxiwayName) {
          // 취소한 경우
          setRelDrawClicks([]);
          setPreviewRel(null);
          return;
        }
        
        // 생성된 REL 데이터
        const newRel = {
          id: `REL_${taxiwayName}_${relType === 'departure' ? 'D' : 'A'}`,
          taxiway: taxiwayName,
          type: relType,
          position: { lat: position.lat, lng: position.lng },
          holdingPoint: { lat: holdingPoint.lat, lng: holdingPoint.lng }
        };
        
        // rwslLines에 새 REL 추가하여 즉시 렌더링
        const newRwslLine: RWSLLine = {
          id: newRel.id,
          type: 'REL',
          points: [
            { x: newRel.position.lng, y: newRel.position.lat },
            { x: newRel.holdingPoint.lng, y: newRel.holdingPoint.lat }
          ],
          active: false
        };
        
        setRwslLines(prev => [...prev, newRwslLine]);
        
        // 파일에 저장
        saveRELToFile(newRel);
        
        // 성공 메시지
        console.log('새 REL 생성:', JSON.stringify(newRel, null, 2));
        alert(`REL ${newRel.id}이(가) 생성되었습니다.`);
        
        // 리셋
        setRelDrawClicks([]);
        setPreviewRel(null);
      }
    } else if (onSelectAircraft) {
      // 일반 모드 - 항공기 선택
    }
  }, [onSelectAircraft, relDrawMode, relType, relDrawClicks, scale, panX, panY, latLngToPixel, saveRELToFile]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setMousePos({ x, y });
    
    // 드래그 중이면 맵 이동
    if (event.buttons === 1 && !relDrawMode) {
      setPanX(panX + event.movementX / scale);
      setPanY(panY + event.movementY / scale);
      return;
    }
    
    // REL 그리기 모드에서 첫 클릭 후 미리보기
    if (relDrawMode && relDrawClicks.length === 1) {
      // objectFit: 'contain'을 고려한 실제 렌더링 영역 계산
      const canvasAspect = canvas.width / canvas.height;
      const rectAspect = rect.width / rect.height;
      
      let renderWidth, renderHeight, offsetX, offsetY;
      
      if (canvasAspect > rectAspect) {
        // Canvas가 더 넓은 경우 - 위아래 레터박스
        renderWidth = rect.width;
        renderHeight = rect.width / canvasAspect;
        offsetX = 0;
        offsetY = (rect.height - renderHeight) / 2;
      } else {
        // Canvas가 더 높은 경우 - 좌우 필러박스
        renderWidth = rect.height * canvasAspect;
        renderHeight = rect.height;
        offsetX = (rect.width - renderWidth) / 2;
        offsetY = 0;
      }
      
      // 실제 캔버스 좌표로 변환
      const canvasX = ((x - offsetX) / renderWidth) * canvas.width;
      const canvasY = ((y - offsetY) / renderHeight) * canvas.height;
      
      const worldX = (canvasX - canvas.width / 2) / scale - panX;
      const worldY = (canvasY - canvas.height / 2) / scale - panY;
      
      const GIMPO_CENTER = { lat: 37.5587, lng: 126.7905 };
      const pixelToLatLng = (px: number, py: number) => {
        const zoom = 14;
        const tileSize = 256;
        const scale = Math.pow(2, zoom);
        
        // 김포공항 중심을 픽셀 좌표로 변환
        const centerWorldX = (GIMPO_CENTER.lng + 180) / 360;
        const centerWorldY = (1 - Math.log(Math.tan(GIMPO_CENTER.lat * Math.PI / 180) + 1 / Math.cos(GIMPO_CENTER.lat * Math.PI / 180)) / Math.PI) / 2;
        const centerPixelX = centerWorldX * tileSize * scale;
        const centerPixelY = centerWorldY * tileSize * scale;
        
        // 클릭한 픽셀을 절대 픽셀 좌표로 변환
        const absoluteX = centerPixelX + px;
        const absoluteY = centerPixelY + py;
        
        // 절대 픽셀 좌표를 위경도로 변환
        const worldX = absoluteX / (tileSize * scale);
        const worldY = absoluteY / (tileSize * scale);
        
        const lng = worldX * 360 - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180 / Math.PI;
        
        return { lat, lng };
      };
      
      const firstClick = relDrawClicks[0];
      const firstPixel = latLngToPixel(firstClick.lat, firstClick.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
      const currentLatLng = pixelToLatLng(worldX, worldY);
      const currentPixel = latLngToPixel(currentLatLng.lat, currentLatLng.lng, 14, GIMPO_CENTER.lat, GIMPO_CENTER.lng);
      const angle = Math.atan2(currentPixel.y - firstPixel.y, currentPixel.x - firstPixel.x);
      
      // 미터를 픽셀로 변환하는 함수
      const metersToPixels = (meters: number, lat: number, zoom: number) => {
        // zoom 레벨에서 1픽셀이 나타내는 미터 수 계산
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
        return meters / metersPerPixel;
      };
      
      const distance = 90; // meters
      const distanceInPixels = metersToPixels(distance, GIMPO_CENTER.lat, 14);
      
      // 정방향으로 통일 - 첫 클릭에서 마우스 방향으로
      const startPoint = { lat: firstClick.lat, lng: firstClick.lng };
      const endX = firstPixel.x + Math.cos(angle) * distanceInPixels;
      const endY = firstPixel.y + Math.sin(angle) * distanceInPixels;
      const endPoint = pixelToLatLng(endX, endY);
      
      setPreviewRel({ 
        position: startPoint,
        holdingPoint: endPoint 
      });
    }
  }, [panX, panY, scale, relDrawMode, relDrawClicks, relType, latLngToPixel]);


  // 마우스 휠 줌 핸들러
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    // 줌 방향 결정
    const zoomDirection = event.deltaY < 0 ? 1 : -1;
    const zoomFactor = 1 + (ZOOM_STEP * zoomDirection);
    
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * zoomFactor));
    
    // 화면 중심을 기준으로 줌 (pan 값은 그대로 유지)
    setScale(newScale);
  }, [scale, MIN_SCALE, MAX_SCALE, ZOOM_STEP]);

  // Wheel 이벤트 리스너 등록 (passive: false로 설정)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // 줌 제어 함수들
  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(MAX_SCALE, scale + ZOOM_STEP);
    setScale(newScale);
  }, [scale, MAX_SCALE, ZOOM_STEP]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(MIN_SCALE, scale - ZOOM_STEP);
    setScale(newScale);
  }, [scale, MIN_SCALE, ZOOM_STEP]);

  const handleZoomReset = useCallback(() => {
    setScale(1.5);
    setPanX(0);
    setPanY(0);
  }, []);

  // 키보드 단축키 이벤트
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 입력 필드에서는 단축키 비활성화
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault();
          handleZoomIn();
          break;
        case '-':
          event.preventDefault();
          handleZoomOut();
          break;
        case '0':
          event.preventDefault();
          handleZoomReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {/* Canvas Container - 16:9 비율 유지 */}
      <div className="relative" style={{
        width: '100%',
        height: '100%',
        maxWidth: 'calc(100vh * 16 / 9)',
        maxHeight: 'calc(100vw * 9 / 16)',
      }}>
      {/* RWSL 제어 패널 */}
      <div className="absolute top-2 left-2 bg-black/80 p-2 rounded text-white z-10">
        <div className="text-xs space-y-1">
          <div className="font-bold">RWSL 제어 패널</div>
          <div className="text-green-400">
            REL: {rwslDisplay.activeRELCount}/{rwslLines.filter(l => l.type === 'REL').length}개 활성
          </div>
          <div className="text-yellow-400">
            THL: {rwslDisplay.activeTHLCount}/{rwslLines.filter(l => l.type === 'THL').length}개 활성
          </div>
          {rwslLines.filter(l => l.type === 'RIL').length > 0 && (
            <div className="text-blue-400">
              RIL: {rwslLines.filter(l => l.type === 'RIL' && l.active).length}/{rwslLines.filter(l => l.type === 'RIL').length}개 활성
            </div>
          )}
          <div className="text-gray-400 text-xs pt-1">
            총 {rwslLines.length}개 등화 설치
          </div>
          <button
            onClick={() => setShowLightPositions(!showLightPositions)}
            className={`mt-2 w-full px-2 py-1 rounded text-xs font-bold transition-colors ${
              showLightPositions 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-gray-200'
            }`}
            title="등화 위치 시각화"
          >
            {showLightPositions ? '등화 위치 표시 중' : '등화 위치 보기'}
          </button>
          
          {/* REL 그리기 모드 */}
          <div className="mt-2 pt-2 border-t border-gray-600">
            <button
              onClick={() => {
                setRelDrawMode(!relDrawMode);
                setRelDrawClicks([]);
                setPreviewRel(null);
              }}
              className={`w-full px-2 py-1 rounded text-xs font-bold transition-colors ${
                relDrawMode 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'bg-gray-600 hover:bg-gray-700 text-gray-200'
              }`}
              title="REL 등화 그리기"
            >
              {relDrawMode ? 'REL 그리기 중' : 'REL 그리기'}
            </button>
            
            {relDrawMode && (
              <div className="mt-2 space-y-1">
                <div className="flex space-x-1">
                  <label className="flex items-center text-xs">
                    <input
                      type="radio"
                      value="departure"
                      checked={relType === 'departure'}
                      onChange={(e) => setRelType(e.target.value as 'departure')}
                      className="mr-1"
                    />
                    출발 REL
                  </label>
                  <label className="flex items-center text-xs">
                    <input
                      type="radio"
                      value="arrival"
                      checked={relType === 'arrival'}
                      onChange={(e) => setRelType(e.target.value as 'arrival')}
                      className="mr-1"
                    />
                    도착 REL
                  </label>
                </div>
                <div className="text-xs text-gray-300">
                  {relDrawClicks.length === 0 ? '1. 교차점 클릭' : '2. 활주로 방향 클릭'}
                </div>
              </div>
            )}
            
            {/* 활주로 경계 표시 토글 */}
            <div className="mt-2 pt-2 border-t border-gray-700">
              <button
                onClick={() => setShowRunwayBounds(!showRunwayBounds)}
                className={`w-full px-2 py-1 rounded text-xs transition-colors ${
                  showRunwayBounds 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                }`}
              >
                {showRunwayBounds ? '🟨 활주로 경계 ON' : '🟨 활주로 경계 OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 줌 제어 패널 */}
      {showZoomControls && (
        <div className="absolute top-2 right-2 bg-black/80 p-2 rounded text-white z-10">
        <div className="text-xs space-y-2">
          <div className="text-center">줌 제어</div>
          <div className="text-center text-yellow-400">
            {(scale * 100).toFixed(0)}%
          </div>
          <div className="flex space-x-1">
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold"
              title="줌인 (마우스 휠 위로 / 키보드 +)"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold"
              title="줌아웃 (마우스 휠 아래로 / 키보드 -)"
            >
              −
            </button>
            <button
              onClick={handleZoomReset}
              className="w-8 h-8 bg-gray-600 hover:bg-gray-700 rounded text-white text-xs"
              title="줌 리셋 (150% / 키보드 0)"
            >
              R
            </button>
          </div>
        </div>
        </div>
      )}
      
      {/* RKSS 서버 상태 표시 */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black/80 px-4 py-2 rounded text-white z-10">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
          <span className="font-bold">RKSS 서버</span>
          <span className="text-gray-400">김포공항 실시간 데이터</span>
        </div>
      </div>
      
      {/* 맵 레이어 제어 패널 */}
      {showMapControls && (
        <div className="absolute top-40 right-2 bg-black/80 p-2 rounded text-white z-10">
        <div className="text-xs space-y-2">
          <div className="text-center">맵 레이어</div>
          <div className="space-y-1 mb-2 pb-2 border-b border-gray-600">
            <div className="text-center text-gray-400">활주로 조정</div>
            <div className="flex items-center justify-between">
              <span className="text-xs">간격</span>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={runwaySpacing}
                onChange={(e) => setRunwaySpacing(parseFloat(e.target.value))}
                className="w-16 h-1"
              />
              <input
                type="number"
                value={runwaySpacing}
                onChange={(e) => setRunwaySpacing(parseFloat(e.target.value) || 0)}
                className="w-12 text-xs bg-gray-700 text-white px-1 rounded"
                step="0.1"
              />
            </div>
          </div>
          <div className="space-y-1 mb-2 pb-2 border-t border-gray-600 pt-2">
            <div className="text-center text-gray-400">
              {showSatelliteMap ? '위성지도' : 'OSM'} 위치 조정
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">가로</span>
              <input
                type="range"
                min="-200"
                max="200"
                step="0.1"
                value={showSatelliteMap ? satelliteOffsetX : globalOffsetX}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (showSatelliteMap) {
                    setSatelliteOffsetX(value);
                  } else {
                    setGlobalOffsetX(value);
                  }
                }}
                className="w-16 h-1"
              />
              <input
                type="number"
                value={showSatelliteMap ? satelliteOffsetX : globalOffsetX}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (showSatelliteMap) {
                    setSatelliteOffsetX(value);
                  } else {
                    setGlobalOffsetX(value);
                  }
                }}
                className="w-12 text-xs bg-gray-700 text-white px-1 rounded"
                step="0.1"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">세로</span>
              <input
                type="range"
                min="-200"
                max="200"
                step="0.1"
                value={showSatelliteMap ? satelliteOffsetY : globalOffsetY}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (showSatelliteMap) {
                    setSatelliteOffsetY(value);
                  } else {
                    setGlobalOffsetY(value);
                  }
                }}
                className="w-16 h-1"
              />
              <input
                type="number"
                value={showSatelliteMap ? satelliteOffsetY : globalOffsetY}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (showSatelliteMap) {
                    setSatelliteOffsetY(value);
                  } else {
                    setGlobalOffsetY(value);
                  }
                }}
                className="w-12 text-xs bg-gray-700 text-white px-1 rounded"
                step="0.1"
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 text-center py-2">
            <div className="mb-1">💡 맵 레이어 전환은</div>
            <div>레이어 컨트롤에서 관리</div>
          </div>
          {(showOSMMap || showSatelliteMap) && (
            <div className="space-y-1 mt-2 pt-2 border-t border-gray-600">
              <div className="text-center text-gray-400">지도 조정</div>
              <div className="flex items-center justify-between">
                <span className="text-xs">밝기</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={osmBrightness}
                  onChange={(e) => setOsmBrightness(parseFloat(e.target.value))}
                  className="w-16 h-1"
                />
                <span className="text-xs w-10 text-right">{(osmBrightness * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">투명도</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={osmOpacity}
                  onChange={(e) => setOsmOpacity(parseFloat(e.target.value))}
                  className="w-16 h-1"
                />
                <span className="text-xs w-10 text-right">{(osmOpacity * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
          {showVectorMap && mapImage && (
            <div className="space-y-1 mt-2 pt-2 border-t border-gray-600">
              <div className="text-center text-gray-400">벡터맵 조정</div>
              <div className="flex items-center justify-between">
                <span className="text-xs">크기</span>
                <input
                  type="range"
                  min="0.003"
                  max="15"
                  step="0.001"
                  value={mapScaleAdjust}
                  onChange={(e) => setMapScaleAdjust(parseFloat(e.target.value))}
                  className="w-16 h-1"
                />
                <input
                  type="number"
                  value={mapScaleAdjust}
                  onChange={(e) => setMapScaleAdjust(parseFloat(e.target.value) || 0)}
                  className="w-14 text-xs bg-gray-700 text-white px-1 rounded"
                  step="0.001"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">회전</span>
                <input
                  type="range"
                  min="-360"
                  max="360"
                  step="0.01"
                  value={mapRotation}
                  onChange={(e) => setMapRotation(parseFloat(e.target.value))}
                  className="w-16 h-1"
                />
                <input
                  type="number"
                  value={mapRotation}
                  onChange={(e) => setMapRotation(parseFloat(e.target.value) || 0)}
                  className="w-14 text-xs bg-gray-700 text-white px-1 rounded"
                  step="0.01"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">가로</span>
                <input
                  type="range"
                  min="-3000"
                  max="3000"
                  step="0.1"
                  value={showSatelliteMap ? satelliteMapOffsetX : mapOffsetX}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (showSatelliteMap) {
                      setSatelliteMapOffsetX(value);
                    } else {
                      setMapOffsetX(value);
                    }
                  }}
                  className="w-16 h-1"
                />
                <input
                  type="number"
                  value={showSatelliteMap ? satelliteMapOffsetX : mapOffsetX}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (showSatelliteMap) {
                      setSatelliteMapOffsetX(value);
                    } else {
                      setMapOffsetX(value);
                    }
                  }}
                  className="w-14 text-xs bg-gray-700 text-white px-1 rounded"
                  step="0.1"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">세로</span>
                <input
                  type="range"
                  min="-3000"
                  max="3000"
                  step="0.1"
                  value={showSatelliteMap ? satelliteMapOffsetY : mapOffsetY}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (showSatelliteMap) {
                      setSatelliteMapOffsetY(value);
                    } else {
                      setMapOffsetY(value);
                    }
                  }}
                  className="w-16 h-1"
                />
                <input
                  type="number"
                  value={showSatelliteMap ? satelliteMapOffsetY : mapOffsetY}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (showSatelliteMap) {
                      setSatelliteMapOffsetY(value);
                    } else {
                      setMapOffsetY(value);
                    }
                  }}
                  className="w-14 text-xs bg-gray-700 text-white px-1 rounded"
                  step="0.1"
                />
              </div>
            </div>
          )}
        </div>
        </div>
      )}
      
      {/* 항공기 툴팁 제거됨 - 영구 라벨로 대체 */}
      
      {/* Hidden OSM Canvas */}
      <canvas
        ref={osmCanvasRef}
        width={CANVAS_SIZE.width}
        height={CANVAS_SIZE.height}
        style={{ display: 'none' }}
      />
      
      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE.width}
        height={CANVAS_SIZE.height}
        className={relDrawMode ? "cursor-crosshair" : "cursor-move"}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
      />
      
      {/* RWSL 디버그 정보 패널 */}
      {showDebugPanel && systemStatus && (
        <div className="absolute bottom-2 left-2 bg-black/90 p-3 rounded text-white text-xs max-w-md">
          <div className="font-bold text-blue-400 mb-2">RWSL 디버그 정보</div>
          
          {/* 시스템 상태 */}
          <div className="mb-2">
            <div className="text-yellow-400 font-semibold">시스템 상태:</div>
            <div className="text-xs">
              • 상태: <span className={systemStatus?.systemHealth?.status === 'ONLINE' ? 'text-green-400' : 'text-red-400'}>
                {systemStatus?.systemHealth?.status || 'UNKNOWN'}
              </span>
            </div>
            <div className="text-xs">
              • 처리 시간: {systemStatus?.collisionDetection?.processingTime?.toFixed(1) || 0}ms
            </div>
            <div className="text-xs">
              • 감지된 충돌: {systemStatus?.collisionDetection?.activeConflicts?.length || 0}건
            </div>
          </div>
          
          {/* 활주로 점유 상태 */}
          <div className="mb-2">
            <div className="text-orange-400 font-semibold">활주로 점유:</div>
            {runwayOccupancy.size > 0 ? (
              Array.from(runwayOccupancy.entries()).map(([runway, info]) => (
                <div key={runway} className="text-xs">
                  <span className={info.occupied ? 'text-red-400' : 'text-green-400'}>
                    • {runway}: {info.occupied ? '점유됨' : '비어있음'}
                  </span>
                  {info.occupied && info.occupancyType && (
                    <span className="text-gray-400 ml-2">
                      ({info.occupancyType})
                    </span>
                  )}
                  {info.occupied && info.aircraft?.length > 0 && (
                    <span className="text-gray-400 ml-1">
                      - {info.aircraft[0].callsign}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-400">데이터 없음</div>
            )}
          </div>
          
          {/* 충돌 정보 */}
          {conflicts && conflicts.length > 0 && (
            <div className="mb-2">
              <div className="text-red-400 font-semibold">활성 충돌:</div>
              {conflicts.slice(0, 3).map((conflict, idx) => (
                <div key={idx} className="text-xs text-orange-400">
                  • {conflict.type}: {conflict.aircraftInvolved?.[0] || 'N/A'} - {conflict.aircraftInvolved?.[1] || 'N/A'}
                </div>
              ))}
              {conflicts.length > 3 && (
                <div className="text-xs text-gray-400">... 외 {conflicts.length - 3}건</div>
              )}
            </div>
          )}
          
          {/* 등화 상태 */}
          <div className="mb-2">
            <div className="text-purple-400 font-semibold">등화 활성화:</div>
            <div className="text-xs">
              • REL: {rwslDisplay.activeRELCount}/{rwslLines.filter(l => l.type === 'REL').length}개
            </div>
            <div className="text-xs">
              • THL: {rwslDisplay.activeTHLCount}/{rwslLines.filter(l => l.type === 'THL').length}개
            </div>
          </div>
          
          {/* 접근 항공기 */}
          {approachingAircraft.size > 0 && (
            <div className="mb-2">
              <div className="text-cyan-400 font-semibold">접근 항공기:</div>
              {Array.from(approachingAircraft.entries()).map(([runway, aircraftList]) => (
                <div key={runway} className="text-xs">
                  • {runway}: {aircraftList.join(', ')}
                </div>
              ))}
            </div>
          )}
          
          {/* 항공기 상태 요약 */}
          <div>
            <div className="text-green-400 font-semibold">항공기 상태:</div>
            <div className="text-xs">
              • 전체: {aircraft.length}대
            </div>
            <div className="text-xs">
              • 지상: {aircraft.filter(ac => ac.altitude <= 100).length}대
            </div>
            <div className="text-xs">
              • 공중: {aircraft.filter(ac => ac.altitude > 100).length}대
            </div>
            <div className="text-xs">
              • Airborne: {aircraft.filter(ac => 
                ac.speed >= 50 && (ac.verticalSpeed || 0) >= 500 && ac.altitude >= 100
              ).length}대
            </div>
            <div className="text-xs">
              • 고속이동: {aircraft.filter(ac => ac.speed >= 80).length}대
            </div>
          </div>
        </div>
      )}
      
      {/* 레이어 컨트롤 패널 */}
      {showLayerControls && (
        <div className="absolute top-20 right-2 bg-black/90 p-4 rounded-lg text-white text-sm max-h-[80vh] overflow-y-auto z-[9999]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold">레이어 컨트롤</h3>
            <button
              onClick={() => setShowLayerControls(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          {/* 맵 레이어 */}
          <div className="mb-4">
            <h4 className="text-yellow-400 font-semibold mb-2">맵 레이어</h4>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showOSMMap}
                onChange={(e) => setShowOSMMap(e.target.checked)}
                className="mr-2"
              />
              OSM 지도
            </label>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showSatelliteMap}
                onChange={(e) => setShowSatelliteMap(e.target.checked)}
                className="mr-2"
              />
              위성 지도
            </label>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showVectorMap}
                onChange={(e) => {
                  if (e.target.checked && !mapImage) {
                    // 벡터맵 로드
                    const img = new Image();
                    img.src = '/rkss-map.svg';
                    img.onload = () => {
                      setMapImage(img);
                      setShowVectorMap(true);
                      console.log('공항 다이어그램 로드 성공');
                    };
                    img.onerror = () => {
                      console.error('공항 다이어그램 로드 실패');
                      setShowVectorMap(false);
                    };
                  } else {
                    setShowVectorMap(e.target.checked);
                    if (!e.target.checked) {
                      setMapImage(null);
                    }
                  }
                }}
                className="mr-2"
              />
              공항 다이어그램 (SVG)
            </label>
          </div>
          
          {/* RWSL 레이어 */}
          <div className="mb-4">
            <h4 className="text-orange-400 font-semibold mb-2">RWSL 시스템</h4>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showRELLights}
                onChange={(e) => setShowRELLights(e.target.checked)}
                className="mr-2"
              />
              REL 등화
            </label>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showTHLLights}
                onChange={(e) => setShowTHLLights(e.target.checked)}
                className="mr-2"
              />
              THL 등화
            </label>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showRWSLLines}
                onChange={(e) => setShowRWSLLines(e.target.checked)}
                className="mr-2"
              />
              RWSL 연결선
            </label>
          </div>
          
          {/* 내부 로직 뷰 */}
          <div className="mb-4">
            <h4 className="text-green-400 font-semibold mb-2">내부 로직 뷰</h4>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showInternalLogic}
                onChange={(e) => setShowInternalLogic(e.target.checked)}
                className="mr-2"
              />
              내부 로직 뷰 활성화
            </label>
            {showInternalLogic && (
              <div className="ml-6 mt-2">
              <label className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={showDetectionZones}
                  onChange={(e) => setShowDetectionZones(e.target.checked)}
                  className="mr-2"
                />
                감지 구역
              </label>
              <label className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={showConflictVisuals}
                  onChange={(e) => setShowConflictVisuals(e.target.checked)}
                  className="mr-2"
                />
                충돌 시각화
              </label>
              <label className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={showAircraftStatus}
                  onChange={(e) => setShowAircraftStatus(e.target.checked)}
                  className="mr-2"
                />
                항공기 상태
              </label>
              <label className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={showRunwayOccupancyInfo}
                  onChange={(e) => setShowRunwayOccupancyInfo(e.target.checked)}
                  className="mr-2"
                />
                활주로 점유 정보
              </label>
              <label className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={showRunwayBounds}
                  onChange={(e) => setShowRunwayBounds(e.target.checked)}
                  className="mr-2"
                />
                활주로 경계
              </label>
              </div>
            )}
          </div>
          
          {/* UI 패널 */}
          <div className="mb-4">
            <h4 className="text-blue-400 font-semibold mb-2">UI 패널</h4>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showZoomControls}
                onChange={(e) => setShowZoomControls(e.target.checked)}
                className="mr-2"
              />
              줌 컨트롤
            </label>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showMapControls}
                onChange={(e) => setShowMapControls(e.target.checked)}
                className="mr-2"
              />
              맵 컨트롤
            </label>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showBottomStatus}
                onChange={(e) => setShowBottomStatus(e.target.checked)}
                className="mr-2"
              />
              하단 상태 정보
            </label>
            <label className="flex items-center mb-1">
              <input
                type="checkbox"
                checked={showDebugPanel}
                onChange={(e) => setShowDebugPanel(e.target.checked)}
                className="mr-2"
              />
              디버그 패널
            </label>
          </div>
        </div>
      )}
      
      {/* 레이어 컨트롤 토글 버튼 */}
      <button
        onClick={() => setShowLayerControls(!showLayerControls)}
        className="absolute top-20 right-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm z-[9998]"
        style={{ display: showLayerControls ? 'none' : 'block' }}
      >
        🎛️ 레이어
      </button>
      
      {/* 하단 상태 정보 */}
      {showBottomStatus && (
        <div className="absolute bottom-2 right-2 bg-black/80 p-2 rounded text-white text-xs">
        <div className="text-green-400">
          추적: {aircraft.length}대
        </div>
        <div className="text-gray-400">
          지상: {aircraft.filter(ac => !ac.isActive || ac.altitude === 0).length}대
        </div>
        <div className="text-blue-400">
          줌: {(scale * 100).toFixed(0)}% | 휠/+/-/0
        </div>
        <div className="text-purple-400">
          맵: {showOSMMap ? 'OSM' : ''}{showOSMMap && mapImage ? '+' : ''}{mapImage ? '벡터' : showOSMMap ? '' : '없음'}
        </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default RadarDisplay;

// Helper function: Convert lat/lng to pixel coordinates
function latLngToPixel(lat: number, lng: number, zoom: number, centerLat: number, centerLng: number) {
  const tileSize = 256;
  const scale = Math.pow(2, zoom);
  
  // Convert center point to world coordinates
  const centerWorldX = (centerLng + 180) / 360;
  const centerWorldY = (1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2;
  const centerPixelX = centerWorldX * tileSize * scale;
  const centerPixelY = centerWorldY * tileSize * scale;
  
  // Convert target point to world coordinates
  const worldX = (lng + 180) / 360;
  const worldY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2;
  const pixelX = worldX * tileSize * scale;
  const pixelY = worldY * tileSize * scale;
  
  // Return relative position from center
  return {
    x: pixelX - centerPixelX,
    y: pixelY - centerPixelY
  };
}

// Helper function: Convert Local Tangent Plane coordinates to pixel coordinates
function localToPixel(localX: number, localY: number, scale: number = 0.3) {
  // Local 좌표계: 김포공항 중심(0,0), 미터 단위
  // X: 동쪽이 양수, Y: 북쪽이 양수
  // scale: 미터당 픽셀 비율 (0.3 = 1미터당 0.3픽셀)
  
  return {
    x: localX * scale,      // 동서 방향
    y: -localY * scale      // 북남 방향 (화면 좌표계는 Y가 아래쪽이 양수)
  };
}