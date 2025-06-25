import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { TrackedAircraft, Trajectory } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AircraftDetail: React.FC = () => {
  const { callsign } = useParams<{ callsign: string }>();
  const [aircraft, setAircraft] = useState<TrackedAircraft | null>(null);
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!callsign) return;
      
      try {
        setLoading(true);
        const [aircraftData, trajectoryData] = await Promise.all([
          apiService.getAircraftByCallsign(callsign),
          apiService.getAircraftTrajectory(callsign)
        ]);
        
        setAircraft(aircraftData);
        setTrajectory(trajectoryData);
      } catch (err) {
        setError('항공기 데이터를 불러올 수 없습니다.');
        console.error('Failed to load aircraft data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (callsign) {
      loadData();
    }
  }, [callsign]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-300">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error || !aircraft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-xl text-red-400 mb-4">{error || '항공기를 찾을 수 없습니다.'}</div>
        <Link to="/" className="text-atc-blue hover:text-blue-300">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const chartData = trajectory?.points.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('ko-KR'),
    altitude: point.altitude,
    speed: point.speed,
    type: point.pointType
  })) || [];

  return (
    <div className="container mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{aircraft.callsign}</h1>
          <div className="text-gray-400">
            {aircraft.flightNumber} • {aircraft.aircraftType}
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
        {/* Aircraft Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Basic Info */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">기본 정보</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-400">콜사인</div>
                <div className="text-white font-medium">{aircraft.callsign}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">편명</div>
                <div className="text-white font-medium">{aircraft.flightNumber || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">기종</div>
                <div className="text-white font-medium">{aircraft.aircraftType || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">등록번호</div>
                <div className="text-white font-medium">{aircraft.registration || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">출발지 → 목적지</div>
                <div className="text-white font-medium">
                  {aircraft.origin || 'N/A'} → {aircraft.destination || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Flight Status */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">비행 상태</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-400">비행 단계</div>
                <div className="text-white font-medium">{aircraft.flightPhase || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">할당된 활주로</div>
                <div className="text-white font-medium">{aircraft.assignedRunway || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">접근 순서</div>
                <div className="text-white font-medium">{aircraft.approachSequence || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">스쿼크</div>
                <div className="text-white font-medium">{aircraft.squawk || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">긴급상황</div>
                <div className={`font-medium ${aircraft.isEmergency ? 'text-atc-red' : 'text-atc-green'}`}>
                  {aircraft.isEmergency ? '예' : '아니오'}
                </div>
              </div>
            </div>
          </div>

          {/* Current Position */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">현재 위치</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-400">위도</div>
                <div className="text-white font-medium">{aircraft.latitude.toFixed(6)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">경도</div>
                <div className="text-white font-medium">{aircraft.longitude.toFixed(6)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">고도</div>
                <div className="text-white font-medium">{aircraft.altitude} feet</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">속도</div>
                <div className="text-white font-medium">{aircraft.speed} knots</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">방향</div>
                <div className="text-white font-medium">{aircraft.heading}°</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">수직 속도</div>
                <div className="text-white font-medium">
                  {aircraft.verticalSpeed ? `${aircraft.verticalSpeed} fpm` : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Trajectory */}
        <div className="lg:col-span-2 space-y-6">
          {/* Altitude Chart */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">고도 변화</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#374151', 
                    border: '1px solid #6b7280',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="altitude" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Speed Chart */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">속도 변화</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#374151', 
                    border: '1px solid #6b7280',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="speed" 
                  stroke="#16a34a" 
                  strokeWidth={2}
                  dot={{ fill: '#16a34a', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent History */}
          <div className="status-panel">
            <h3 className="text-lg font-semibold mb-4 text-white">최근 궤적</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left py-2 text-gray-400">시간</th>
                    <th className="text-left py-2 text-gray-400">위치</th>
                    <th className="text-left py-2 text-gray-400">고도</th>
                    <th className="text-left py-2 text-gray-400">속도</th>
                    <th className="text-left py-2 text-gray-400">타입</th>
                  </tr>
                </thead>
                <tbody>
                  {trajectory?.points.slice(-10).reverse().map((point, index) => (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="py-2 text-white">
                        {new Date(point.timestamp).toLocaleTimeString('ko-KR')}
                      </td>
                      <td className="py-2 text-gray-300">
                        {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                      </td>
                      <td className="py-2 text-gray-300">{point.altitude}ft</td>
                      <td className="py-2 text-gray-300">{point.speed}kt</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          point.pointType === 'ACTUAL' ? 'bg-atc-green text-white' :
                          point.pointType === 'PREDICTED' ? 'bg-atc-yellow text-black' :
                          'bg-gray-600 text-white'
                        }`}>
                          {point.pointType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AircraftDetail;