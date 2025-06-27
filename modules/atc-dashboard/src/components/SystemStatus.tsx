import React, { useState } from 'react';

interface SystemStatusProps {
  isConnected: boolean;
  aircraftCount: number;
  emergencyCount: number;
  onLoadRkssData?: () => void;
  onStartPlayback?: () => void;
  onStopPlayback?: () => void;
  onPausePlayback?: () => void;
  onResumePlayback?: () => void;
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
  onPausePlayback,
  onResumePlayback,
  playbackSpeed = 1,
  onSpeedChange
}) => {
  const speedOptions = [1, 2, 5, 10, 60];
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const handleLoadRkss = async () => {
    if (!onLoadRkssData) return;
    setIsLoading(true);
    setError(null);
    try {
      await onLoadRkssData();
      setIsDataLoaded(true);
      setError(null);
    } catch (err) {
      setError('RKSS 데이터 로드 실패');
      console.error('Failed to load RKSS data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPlayback = async () => {
    if (!onStartPlayback) return;
    setIsLoading(true);
    setError(null);
    try {
      await onStartPlayback();
      setIsPlaying(true);
    } catch (err) {
      setError('플레이백 시작 실패');
      console.error('Failed to start playback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopPlayback = async () => {
    if (!onStopPlayback) return;
    setIsLoading(true);
    setError(null);
    try {
      await onStopPlayback();
      setIsPlaying(false);
      setIsPaused(false);
    } catch (err) {
      setError('플레이백 중지 실패');
      console.error('Failed to stop playback:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePausePlayback = async () => {
    if (!onPausePlayback) return;
    setIsLoading(true);
    setError(null);
    try {
      await onPausePlayback();
      setIsPaused(true);
    } catch (err) {
      setError('일시중지 실패');
      console.error('Failed to pause playback:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResumePlayback = async () => {
    if (!onResumePlayback) return;
    setIsLoading(true);
    setError(null);
    try {
      await onResumePlayback();
      setIsPaused(false);
    } catch (err) {
      setError('재개 실패');
      console.error('Failed to resume playback:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-between w-full text-sm">
      {/* Left: System Status */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}></div>
          <span className="text-gray-400">WebSocket</span>
          <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
            {isConnected ? '연결됨' : '연결 끊김'}
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
        {/* Error message */}
        {error && (
          <span className="text-red-500 text-xs animate-pulse">{error}</span>
        )}
        
        {onLoadRkssData && (
          <button
            onClick={handleLoadRkss}
            disabled={isLoading}
            className={`px-3 py-1 rounded text-xs transition-all ${
              isLoading 
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            }`}
          >
            {isLoading ? '로딩 중...' : 'RKSS 로드'}
          </button>
        )}
        {onStartPlayback && (
          <button
            onClick={handleStartPlayback}
            disabled={isLoading || isPlaying || !isDataLoaded}
            className={`px-3 py-1 rounded text-xs transition-all ${
              isLoading || isPlaying || !isDataLoaded
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
            }`}
            title={!isDataLoaded ? 'RKSS 데이터를 먼저 로드하세요' : ''}
          >
            {isLoading ? '시작 중...' : isPlaying ? '▶ 재생 중' : '▶ 시작'}
          </button>
        )}
        {onPausePlayback && onResumePlayback && isPlaying && (
          <button
            onClick={isPaused ? handleResumePlayback : handlePausePlayback}
            disabled={isLoading}
            className={`px-3 py-1 rounded text-xs transition-all ${
              isLoading
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                : isPaused
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700 active:scale-95'
                  : 'bg-orange-600 text-white hover:bg-orange-700 active:scale-95'
            }`}
          >
            {isLoading ? (isPaused ? '재개 중...' : '일시중지 중...') : (isPaused ? '▶ 재개' : '⏸ 일시중지')}
          </button>
        )}
        {onStopPlayback && (
          <button
            onClick={handleStopPlayback}
            disabled={isLoading || !isPlaying}
            className={`px-3 py-1 rounded text-xs transition-all ${
              isLoading || !isPlaying
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
            }`}
          >
            {isLoading ? '중지 중...' : '■ 중지'}
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