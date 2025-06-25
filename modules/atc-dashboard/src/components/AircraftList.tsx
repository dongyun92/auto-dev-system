import React from 'react';
import { TrackedAircraft } from '../types';
import { Link } from 'react-router-dom';

interface AircraftListProps {
  aircraft: TrackedAircraft[];
  onSelectAircraft?: (aircraft: TrackedAircraft) => void;
}

const AircraftList: React.FC<AircraftListProps> = ({ aircraft, onSelectAircraft }) => {
  const getFlightPhaseColor = (phase?: string) => {
    switch (phase) {
      case 'TAKEOFF':
      case 'CLIMB':
        return 'text-atc-green';
      case 'APPROACH':
      case 'LANDING':
        return 'text-atc-yellow';
      case 'EMERGENCY':
        return 'text-atc-red';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="status-panel h-full flex flex-col">
      <h3 className="text-xs font-semibold mb-1 text-gray-300 px-2 pt-2">
        추적 중인 항공기 ({aircraft.length})
      </h3>
      
      <div className="space-y-0.5 flex-1 overflow-y-auto px-2 pb-2">
        {aircraft.map((ac) => (
          <div
            key={ac.id}
            className={`p-1.5 rounded border cursor-pointer transition-colors ${
              ac.isEmergency 
                ? 'border-atc-red bg-red-900/20 hover:bg-red-900/30' 
                : 'border-gray-600 bg-gray-800/50 hover:bg-gray-700/50'
            }`}
            onClick={() => onSelectAircraft?.(ac)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-1">
                  <span className="font-medium text-white text-xs">{ac.callsign}</span>
                  {ac.isEmergency && (
                    <span className="px-1 py-0.5 text-xs bg-atc-red text-white rounded animate-blink">
                      긴급
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {ac.flightNumber} • {ac.aircraftType}
                </div>
                <div className="text-xs text-gray-500">
                  {ac.origin} → {ac.destination}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-xs">
                  <span className={getFlightPhaseColor(ac.flightPhase)}>
                    {ac.flightPhase}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {ac.altitude}ft
                </div>
                <div className="text-xs text-gray-400">
                  {ac.speed}kt
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {aircraft.length === 0 && (
          <div className="text-center text-gray-500 py-4 text-xs">
            추적 중인 항공기가 없습니다
          </div>
        )}
      </div>
    </div>
  );
};

export default AircraftList;