import React from 'react';
import { Runway, TrackedAircraft } from '../types';

interface RunwayPanelProps {
  runways: Runway[];
  approachingAircraft: TrackedAircraft[];
}

const RunwayPanel: React.FC<RunwayPanelProps> = ({ runways, approachingAircraft }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return 'text-green-500';
      case 'CLOSED':
        return 'text-red-500';
      case 'MAINTENANCE':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return '운용중';
      case 'CLOSED':
        return '폐쇄';
      case 'MAINTENANCE':
        return '정비중';
      case 'EMERGENCY':
        return '긴급';
      default:
        return '알 수 없음';
    }
  };

  return (
    <div className="status-panel h-full flex flex-col">
      <h3 className="text-xs font-semibold mb-1 text-gray-300 px-2 pt-2">활주로 상태</h3>
      
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="space-y-1">
          {runways.map((runway) => (
            <div key={runway.id} className="border border-gray-700 rounded p-1.5 bg-gray-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-white text-xs">{runway.name}</h4>
                  <span className={`text-xs ${getStatusColor(runway.status)}`}>
                    {getStatusText(runway.status)}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {runway.heading}°
                </div>
              </div>
              
              {/* RWSL Status */}
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span className="text-[10px] text-gray-500">THL</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span className="text-[10px] text-gray-500">REL</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                  <span className="text-[10px] text-gray-500">RIL</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Approaching Aircraft Summary */}
        {approachingAircraft.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-[10px] text-gray-400 mb-0.5">접근 중인 항공기</div>
            <div className="space-y-0.5">
              {approachingAircraft.slice(0, 4).map((ac) => (
                <div key={ac.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-300">{ac.callsign}</span>
                  <span className="text-gray-500">
                    {ac.assignedRunway} • {ac.altitude}ft
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunwayPanel;