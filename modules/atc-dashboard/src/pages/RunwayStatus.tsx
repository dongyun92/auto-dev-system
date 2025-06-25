import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { TrackedAircraft, Runway } from '../types';

const RunwayStatus: React.FC = () => {
  const { runwayId } = useParams<{ runwayId: string }>();
  const [runway, setRunway] = useState<Runway | null>(null);
  const [approachingAircraft, setApproachingAircraft] = useState<TrackedAircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!runwayId) return;
      
      try {
        setLoading(true);
        const [runways, aircraft] = await Promise.all([
          apiService.getRunways(),
          apiService.getAircraftApproachingRunway(runwayId)
        ]);
        
        const foundRunway = runways.find(r => r.runwayId === runwayId);
        setRunway(foundRunway || null);
        setApproachingAircraft(aircraft);
      } catch (err) {
        setError('활주로 데이터를 불러올 수 없습니다.');
        console.error('Failed to load runway data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (runwayId) {
      loadData();
    }
  }, [runwayId]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-300">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error || !runway) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-xl text-red-400 mb-4">{error || '활주로를 찾을 수 없습니다.'}</div>
        <Link to="/" className="text-atc-blue hover:text-blue-300">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return 'text-atc-green';
      case 'CLOSED':
        return 'text-atc-red';
      case 'MAINTENANCE':
        return 'text-atc-yellow';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="container mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{runway.name}</h1>
          <div className="text-gray-400">
            {runway.length}m × {runway.width}m • 방향: {runway.heading}°
          </div>
        </div>
        <Link
          to="/"
          className="px-4 py-2 bg-atc-blue text-white rounded hover:bg-blue-600"
        >
          대시보드로 돌아가기
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Runway Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">활주로 상태</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400">운용 상태</div>
                <div className={`text-xl font-bold ${getStatusColor(runway.status)}`}>
                  {runway.status === 'OPERATIONAL' ? '운용중' :
                   runway.status === 'CLOSED' ? '폐쇄' :
                   runway.status === 'MAINTENANCE' ? '정비중' : '알 수 없음'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">접근 중인 항공기</div>
                <div className="text-xl font-bold text-atc-blue">
                  {approachingAircraft.length}대
                </div>
              </div>
            </div>
          </div>

          {/* RWSL Status */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">RWSL 상태</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">THL (Takeoff Hold Lights)</span>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-atc-green rounded"></div>
                  <span className="text-atc-green text-sm">정상</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">REL (Runway Entrance Lights)</span>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-atc-red rounded animate-pulse"></div>
                  <span className="text-atc-red text-sm">활성</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">RIL (Runway Intersection Lights)</span>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-atc-yellow rounded"></div>
                  <span className="text-atc-yellow text-sm">대기</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">제어</h3>
            <div className="space-y-3">
              <button className="w-full px-4 py-2 bg-atc-red text-white rounded hover:bg-red-600">
                활주로 폐쇄
              </button>
              <button className="w-full px-4 py-2 bg-atc-yellow text-black rounded hover:bg-yellow-400">
                RWSL 테스트
              </button>
              <button className="w-full px-4 py-2 bg-atc-green text-white rounded hover:bg-green-600">
                활주로 개방
              </button>
            </div>
          </div>
        </div>

        {/* Approaching Aircraft */}
        <div className="lg:col-span-2 space-y-6">
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">
              접근 중인 항공기 ({approachingAircraft.length})
            </h3>
            
            {approachingAircraft.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-2 text-gray-400">순서</th>
                      <th className="text-left py-2 text-gray-400">콜사인</th>
                      <th className="text-left py-2 text-gray-400">편명</th>
                      <th className="text-left py-2 text-gray-400">기종</th>
                      <th className="text-left py-2 text-gray-400">고도</th>
                      <th className="text-left py-2 text-gray-400">속도</th>
                      <th className="text-left py-2 text-gray-400">단계</th>
                      <th className="text-left py-2 text-gray-400">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approachingAircraft.map((aircraft, index) => (
                      <tr key={aircraft.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                        <td className="py-3">
                          <span className="px-2 py-1 bg-atc-blue text-white rounded text-xs font-medium">
                            #{aircraft.approachSequence || index + 1}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="font-medium text-white">{aircraft.callsign}</span>
                          {aircraft.isEmergency && (
                            <span className="ml-2 px-2 py-1 bg-atc-red text-white rounded text-xs animate-blink">
                              긴급
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-gray-300">{aircraft.flightNumber || 'N/A'}</td>
                        <td className="py-3 text-gray-300">{aircraft.aircraftType || 'N/A'}</td>
                        <td className="py-3 text-gray-300">{aircraft.altitude}ft</td>
                        <td className="py-3 text-gray-300">{aircraft.speed}kt</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            aircraft.flightPhase === 'APPROACH' ? 'bg-atc-yellow text-black' :
                            aircraft.flightPhase === 'LANDING' ? 'bg-atc-green text-white' :
                            'bg-gray-600 text-white'
                          }`}>
                            {aircraft.flightPhase}
                          </span>
                        </td>
                        <td className="py-3">
                          <Link
                            to={`/aircraft/${aircraft.callsign}`}
                            className="text-atc-blue hover:text-blue-300 text-xs"
                          >
                            상세보기
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                현재 접근 중인 항공기가 없습니다
              </div>
            )}
          </div>

          {/* Runway Layout */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">활주로 레이아웃</h3>
            <div className="relative bg-gray-900 rounded p-8 min-h-48">
              {/* Runway representation */}
              <div className="absolute inset-4 flex items-center justify-center">
                <div className={`w-full h-12 rounded ${
                  runway.status === 'OPERATIONAL' ? 'bg-atc-green' : 'bg-atc-red'
                } opacity-80 flex items-center justify-center`}>
                  <span className="text-white font-bold">{runway.runwayId}</span>
                </div>
              </div>
              
              {/* Aircraft positions (simplified) */}
              {approachingAircraft.slice(0, 3).map((aircraft, index) => (
                <div
                  key={aircraft.id}
                  className={`absolute w-6 h-6 bg-atc-blue rounded-full flex items-center justify-center text-xs text-white font-bold`}
                  style={{
                    right: `${20 + index * 60}px`,
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunwayStatus;