import React, { useEffect, useRef, useState } from 'react';
import { TrackedAircraft, Runway } from '../types';
import { CoordinateSystem } from '../core/coordinates';
import { RWSLAdapter } from '../services/rwsl/RWSLAdapter';
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
  const [rwslAdapter, setRwslAdapter] = useState<RWSLAdapter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();

  // RWSL 시스템 초기화
  useEffect(() => {
    const initializeRWSL = () => {
      try {
        setIsLoading(true);
        setError(null);

        // 김포공항 좌표계 생성
        const coordinateSystem = new CoordinateSystem(37.5587, 126.7905);
        
        // RWSL 어댑터 생성
        const adapter = new RWSLAdapter(coordinateSystem);
        
        // 이벤트 리스너 등록
        if (onRWSLStateUpdate) {
          adapter.onStateChange(onRWSLStateUpdate);
        }
        
        adapter.onErrorOccurred((err) => {
          console.error('RWSL 시스템 오류:', err);
          setError(err.message);
        });
        
        // 시스템 시작
        adapter.start();
        setRwslAdapter(adapter);
        
        // console.log(`RWSL System initialized for ${airportId}`);
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
      if (rwslAdapter) {
        rwslAdapter.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [airportId, onRWSLStateUpdate]);

  // 항공기 데이터 업데이트
  useEffect(() => {
    if (!rwslAdapter || isLoading) return;

    // 항공기 데이터 전달
    rwslAdapter.updateAircraftData(aircraft);
  }, [aircraft, rwslAdapter, isLoading]);

  // 디버그 정보 렌더링 (개발 모드에서만)
  if (process.env.NODE_ENV === 'development') {
    return (
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: 10, fontSize: 12 }}>
        <div>RWSL Integration Status</div>
        <div>Airport: {airportId}</div>
        <div>Status: {isLoading ? 'Loading...' : error ? `Error: ${error}` : 'Active'}</div>
        <div>Engine: {rwslAdapter ? 'Initialized' : 'Not initialized'}</div>
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
  rwslAdapter: RWSLAdapter,
  latLngToCanvas: (lat: number, lng: number) => { x: number; y: number }
) => {
  // 감지 영역 렌더링 로직
  // 현재는 비활성화 - 새로운 시스템에서는 별도 구현 필요
  // TODO: 새로운 RWSL 시스템의 감지 영역 시각화 구현
};