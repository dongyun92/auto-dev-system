import React, { useEffect, useRef, useState } from 'react';
import { TrackedAircraft, Runway } from '../types';
import { AirportLoader } from '../core/airport';
import { RWSLEngine } from '../core/rwsl';
import { RWSLState } from '../types/rwsl';

interface RWSLIntegrationProps {
  aircraft: TrackedAircraft[];
  runways: Runway[];
  airportId?: string;
  onRWSLStateUpdate?: (state: RWSLState) => void;
}

export const RWSLIntegration: React.FC<RWSLIntegrationProps> = ({
  aircraft,
  runways,
  airportId = 'RKSS',
  onRWSLStateUpdate
}) => {
  const [rwslEngine, setRwslEngine] = useState<RWSLEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();

  // 공항 설정 로드 및 RWSL 엔진 초기화
  useEffect(() => {
    const initializeRWSL = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 공항 설정 로드
        const airportConfig = await AirportLoader.loadAirport(airportId);
        
        // RWSL 엔진 생성
        const engine = new RWSLEngine(airportConfig);
        setRwslEngine(engine);
        
        console.log(`RWSL Engine initialized for ${airportId}`);
      } catch (err) {
        console.error('Failed to initialize RWSL:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    initializeRWSL();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [airportId]);

  // 항공기 데이터 업데이트 및 RWSL 상태 계산
  useEffect(() => {
    if (!rwslEngine || isLoading) return;

    const updateRWSL = () => {
      // 항공기 위치 업데이트
      rwslEngine.updateAircraft(aircraft);
      
      // RWSL 상태 계산
      const rwslState = rwslEngine.calculateRWSLState();
      
      // 상태 콜백 호출
      if (onRWSLStateUpdate) {
        onRWSLStateUpdate(rwslState);
      }

      // 다음 프레임 예약
      animationFrameRef.current = requestAnimationFrame(updateRWSL);
    };

    // 초기 업데이트
    updateRWSL();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [aircraft, rwslEngine, isLoading, onRWSLStateUpdate]);

  // 디버그 정보 렌더링 (개발 모드에서만)
  if (process.env.NODE_ENV === 'development') {
    return (
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: 10, fontSize: 12 }}>
        <div>RWSL Integration Status</div>
        <div>Airport: {airportId}</div>
        <div>Status: {isLoading ? 'Loading...' : error ? `Error: ${error}` : 'Active'}</div>
        <div>Engine: {rwslEngine ? 'Initialized' : 'Not initialized'}</div>
      </div>
    );
  }

  return null;
};

// RWSL 상태를 캔버스에 렌더링하는 헬퍼 함수
export const renderRWSLLights = (
  ctx: CanvasRenderingContext2D,
  rwslState: RWSLState,
  latLngToCanvas: (lat: number, lng: number) => { x: number; y: number },
  coordinateSystem: any
) => {
  // REL 등화 렌더링
  rwslState.rel.forEach(light => {
    const wgs84 = coordinateSystem.toWGS84(light.position.x, light.position.y);
    const canvasPos = latLngToCanvas(wgs84.lat, wgs84.lng);
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvasPos.x, canvasPos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = light.active ? '#FF0000' : '#440000';
    ctx.fill();
    ctx.strokeStyle = light.active ? '#FFFF00' : '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });

  // THL 등화 렌더링
  rwslState.thl.forEach(light => {
    const wgs84 = coordinateSystem.toWGS84(light.position.x, light.position.y);
    const canvasPos = latLngToCanvas(wgs84.lat, wgs84.lng);
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(canvasPos.x - 6, canvasPos.y - 6, 12, 12);
    ctx.fillStyle = light.active ? '#FF0000' : '#440000';
    ctx.fill();
    ctx.strokeStyle = light.active ? '#FFFF00' : '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });
};

// RWSL 감지 영역을 캔버스에 렌더링하는 헬퍼 함수
export const renderRWSLDetectionZones = (
  ctx: CanvasRenderingContext2D,
  rwslEngine: RWSLEngine,
  latLngToCanvas: (lat: number, lng: number) => { x: number; y: number }
) => {
  const coordSystem = rwslEngine.getCoordinateSystem();
  const airport = AirportLoader.getCurrentAirport();
  
  if (!airport) return;

  // REL 감지 영역 렌더링
  if (airport.rwsl.rel.enabled) {
    const relConfig = airport.rwsl.rel;
    
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;

    // 각 REL 등화 위치에서 부채꼴 그리기
    rwslEngine.getState().rel.forEach(light => {
      const centerWGS = coordSystem.toWGS84(light.position.x, light.position.y);
      const centerCanvas = latLngToCanvas(centerWGS.lat, centerWGS.lng);
      
      // 부채꼴 그리기 (간단한 버전)
      ctx.beginPath();
      ctx.moveTo(centerCanvas.x, centerCanvas.y);
      ctx.arc(centerCanvas.x, centerCanvas.y, relConfig.detectionRange.outer * 0.5, 
        -Math.PI/4, Math.PI/4); // 시각적 스케일 조정
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    
    ctx.restore();
  }

  // THL 감지 영역 렌더링
  if (airport.rwsl.thl.enabled) {
    const thlConfig = airport.rwsl.thl;
    
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#FF69B4';
    ctx.strokeStyle = '#FF69B4';
    ctx.lineWidth = 1;

    // 각 활주로 임계값에 직사각형 그리기
    airport.runways.forEach(runway => {
      Object.values(runway.directions).forEach(direction => {
        const thresholdPlane = coordSystem.toPlane(direction.threshold.lat, direction.threshold.lng);
        const centerPlane = { 
          x: thresholdPlane.x, 
          y: thresholdPlane.y + thlConfig.detectionArea.length / 2 
        };
        const centerWGS = coordSystem.toWGS84(centerPlane.x, centerPlane.y);
        const centerCanvas = latLngToCanvas(centerWGS.lat, centerWGS.lng);
        
        // 직사각형 그리기 (간단한 버전)
        ctx.fillRect(
          centerCanvas.x - thlConfig.detectionArea.width * 0.25,
          centerCanvas.y - thlConfig.detectionArea.length * 0.25,
          thlConfig.detectionArea.width * 0.5,
          thlConfig.detectionArea.length * 0.5
        );
      });
    });
    
    ctx.restore();
  }
};