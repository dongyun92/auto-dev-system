import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../services/WebSocketProvider';
import { apiService } from '../services/api';
import { TrackedAircraft, Runway } from '../types';
import AircraftList from '../components/AircraftList';
import RadarDisplay from '../components/RadarDisplay';
import SystemStatus from '../components/SystemStatus';
import RunwayPanel from '../components/RunwayPanel';

const Dashboard: React.FC = () => {
  const { aircraft: wsAircraft, isConnected } = useWebSocket();
  const [aircraft, setAircraft] = useState<TrackedAircraft[]>([]);
  const [runways, setRunways] = useState<Runway[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<TrackedAircraft | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  useEffect(() => {
    loadInitialData();
    loadPlaybackSpeed();
  }, []);

  const loadPlaybackSpeed = async () => {
    try {
      const speed = await apiService.getPlaybackSpeed();
      setPlaybackSpeed(speed);
    } catch (err) {
      console.error('Failed to load playback speed:', err);
    }
  };

  useEffect(() => {
    // Update aircraft from WebSocket if connected, otherwise use polling
    if (isConnected && wsAircraft.length > 0) {
      setAircraft(wsAircraft);
    } else if (!isConnected) {
      // Fallback to polling when WebSocket is disconnected
      const interval = setInterval(loadAircraft, 5000);
      return () => clearInterval(interval);
    }
  }, [wsAircraft, isConnected]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Just load aircraft and runway data without forcing RKSS load
      const [aircraftData, runwayData] = await Promise.all([
        apiService.getAllAircraft(),
        apiService.getRunways()
      ]);
      
      setAircraft(aircraftData);
      setRunways(runwayData);
      
      console.log(`Loaded ${aircraftData.length} aircraft and ${runwayData.length} runways`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`데이터 로딩 중 오류가 발생했습니다: ${errorMessage}`);
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAircraft = async () => {
    try {
      const aircraftData = await apiService.getAllAircraft();
      setAircraft(aircraftData);
    } catch (err) {
      console.error('Failed to load aircraft data:', err);
    }
  };

  const handleSelectAircraft = (aircraft: TrackedAircraft) => {
    setSelectedAircraft(aircraft);
  };

  const handleLoadRkssData = async () => {
    try {
      console.log('Loading RKSS data...');
      setError(null);
      const rkssAircraft = await apiService.loadRkssData();
      console.log(`Loaded ${rkssAircraft.length} RKSS aircraft`);
      setAircraft(rkssAircraft);
      // Return success for the SystemStatus component
      return Promise.resolve();
    } catch (err) {
      console.error('Failed to load RKSS data:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`RKSS 데이터 로딩 실패: ${errorMessage}`);
      // Re-throw for SystemStatus component to handle
      throw err;
    }
  };

  const handleStartPlayback = async () => {
    try {
      console.log('Starting RKSS playback...');
      setError(null);
      await apiService.startPlayback();
      console.log('RKSS playback started');
      // Refresh aircraft data after starting playback
      setTimeout(() => {
        loadAircraft();
      }, 2000);
      return Promise.resolve();
    } catch (err) {
      console.error('Failed to start playback:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`플레이백 시작 실패: ${errorMessage}`);
      throw err;
    }
  };

  const handleStopPlayback = async () => {
    try {
      setError(null);
      await apiService.stopPlayback();
      console.log('RKSS playback stopped');
      return Promise.resolve();
    } catch (err) {
      console.error('Failed to stop playback:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`플레이백 중지 실패: ${errorMessage}`);
      throw err;
    }
  };

  const handleSpeedChange = async (newSpeed: number) => {
    try {
      await apiService.setPlaybackSpeed(newSpeed);
      setPlaybackSpeed(newSpeed);
      console.log(`Playback speed changed to ${newSpeed}x`);
    } catch (err) {
      console.error('Failed to change playback speed:', err);
      setError(`배속 변경 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePausePlayback = async () => {
    try {
      setError(null);
      await apiService.pausePlayback();
      console.log('RKSS playback paused');
      return Promise.resolve();
    } catch (err) {
      console.error('Failed to pause playback:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`일시중지 실패: ${errorMessage}`);
      throw err;
    }
  };

  const handleResumePlayback = async () => {
    try {
      setError(null);
      await apiService.resumePlayback();
      console.log('RKSS playback resumed');
      return Promise.resolve();
    } catch (err) {
      console.error('Failed to resume playback:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`재개 실패: ${errorMessage}`);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-300">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-400">{error}</div>
      </div>
    );
  }

  const emergencyAircraft = aircraft.filter(ac => ac.isEmergency);
  const approachingAircraft = aircraft.filter(ac => 
    ac.flightPhase === 'APPROACH' || ac.flightPhase === 'LANDING'
  );

  return (
    <div className="dashboard-grid">
      {/* Left panel */}
      <div className="left-panel">
        {/* Aircraft List */}
        <div className="aircraft-panel">
          <AircraftList 
            aircraft={aircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>
        
        {/* Runway Status */}
        <div className="runway-panel">
          <RunwayPanel
            runways={runways}
            approachingAircraft={approachingAircraft}
          />
        </div>
      </div>

      {/* Main Radar Display */}
      <div className="radar-panel">
        <RadarDisplay
          aircraft={aircraft}
          runways={runways}
          selectedAircraft={selectedAircraft}
          onSelectAircraft={handleSelectAircraft}
        />
      </div>

      {/* Bottom Status Bar */}
      <div className="status-bar">
        <SystemStatus 
          isConnected={isConnected}
          aircraftCount={aircraft.length}
          emergencyCount={emergencyAircraft.length}
          onLoadRkssData={handleLoadRkssData}
          onStartPlayback={handleStartPlayback}
          onStopPlayback={handleStopPlayback}
          onPausePlayback={handlePausePlayback}
          onResumePlayback={handleResumePlayback}
          playbackSpeed={playbackSpeed}
          onSpeedChange={handleSpeedChange}
        />
      </div>
    </div>
  );
};

export default Dashboard;