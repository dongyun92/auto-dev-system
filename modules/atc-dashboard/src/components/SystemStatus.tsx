import React from 'react';

interface SystemStatusProps {
  isConnected: boolean;
  aircraftCount: number;
  emergencyCount: number;
  onLoadRkssData?: () => void;
  onStartPlayback?: () => void;
  onStopPlayback?: () => void;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
}

const SystemStatus: React.FC<SystemStatusProps> = ({
  isConnected,
  aircraftCount,
  emergencyCount,
  onLoadRkssData,
  onStartPlayback,
  onStopPlayback,
  playbackSpeed = 1,
  onSpeedChange
}) => {
  const speedOptions = [1, 2, 5, 10, 60];
  
  return (
    <div className="flex items-center justify-between w-full text-sm">
      {/* Left: System Status */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span className="text-gray-400">레이더</span>
          <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
            {isConnected ? '정상' : '오류'}
          </span>
        </div>

        {/* Aircraft Count */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">항공기</span>
          <span className="text-white font-medium">{aircraftCount}대</span>
        </div>

        {/* Emergency Count */}
        {emergencyCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-red-500 animate-pulse">⚠️</span>
            <span className="text-red-500 font-medium">긴급 {emergencyCount}건</span>
          </div>
        )}

        {/* RWSL Status */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-gray-400">RWSL</span>
        </div>
      </div>

      {/* Center: Playback Controls */}
      <div className="flex items-center gap-3">
        {onLoadRkssData && (
          <button
            onClick={onLoadRkssData}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            RKSS 로드
          </button>
        )}
        {onStartPlayback && (
          <button
            onClick={onStartPlayback}
            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
          >
            ▶ 시작
          </button>
        )}
        {onStopPlayback && (
          <button
            onClick={onStopPlayback}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            ■ 중지
          </button>
        )}
        {onSpeedChange && (
          <div className="flex items-center gap-1">
            <span className="text-gray-400">배속:</span>
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-1 text-xs rounded ${
                  playbackSpeed === speed 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Time */}
      <div className="text-gray-400">
        {new Date().toLocaleTimeString('ko-KR')}
      </div>
    </div>
  );
};

export default SystemStatus;