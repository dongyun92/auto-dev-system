import React from 'react';
import { RWSLState, RWSLSystemStatus, PerformanceMetrics, ConflictEvent } from '../types/rwsl';
import './RWSLStatusPanel.css';

interface RWSLStatusPanelProps {
  rwslState: RWSLState | null;
  systemStatus: RWSLSystemStatus | null;
  performanceMetrics: PerformanceMetrics | null;
  conflicts: ConflictEvent[];
}

export const RWSLStatusPanel: React.FC<RWSLStatusPanelProps> = ({
  rwslState,
  systemStatus,
  performanceMetrics,
  conflicts
}) => {
  if (!rwslState || !systemStatus) {
    return (
      <div className="rwsl-status-panel">
        <h3>RWSL 시스템 상태</h3>
        <p>시스템 초기화 중...</p>
      </div>
    );
  }

  const formatTime = (ms: number) => `${ms.toFixed(0)}ms`;
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="rwsl-status-panel">
      <h3>RWSL 시스템 상태</h3>
      
      {/* 시스템 건강도 */}
      <div className="status-section">
        <h4>시스템 건강도</h4>
        <div className="status-item">
          <span>상태:</span>
          <span className={`status-value ${systemStatus.systemHealth.status.toLowerCase()}`}>
            {systemStatus.systemHealth.status}
          </span>
        </div>
        <div className="status-item">
          <span>성능 점수:</span>
          <span className="status-value">{systemStatus.systemHealth.performanceScore}/100</span>
        </div>
        <div className="status-item">
          <span>처리 시간:</span>
          <span className="status-value">
            {formatTime(systemStatus.collisionDetection.processingTime)}
          </span>
        </div>
      </div>

      {/* 등화 상태 */}
      <div className="status-section">
        <h4>등화 활성화 상태</h4>
        <div className="status-item">
          <span>REL (활주로 진입등):</span>
          <span className="status-value">
            {systemStatus.relStatus.activeLights} / {systemStatus.relStatus.totalLights}
          </span>
        </div>
        <div className="status-item">
          <span>THL (이륙 대기등):</span>
          <span className="status-value">
            {systemStatus.thlStatus.activeLights} / {systemStatus.thlStatus.totalLights}
          </span>
        </div>
      </div>

      {/* 활성 충돌 */}
      <div className="status-section">
        <h4>활성 충돌 ({conflicts.length})</h4>
        {conflicts.length === 0 ? (
          <p className="no-conflicts">충돌 없음</p>
        ) : (
          <div className="conflicts-list">
            {conflicts.slice(0, 5).map((conflict, index) => (
              <div key={conflict.id} className={`conflict-item severity-${conflict.severity.toLowerCase()}`}>
                <div className="conflict-header">
                  <span className="conflict-type">{getConflictTypeKorean(conflict.type)}</span>
                  <span className="conflict-severity">{conflict.severity}</span>
                </div>
                <div className="conflict-details">
                  <span>항공기: {conflict.aircraftInvolved.join(', ')}</span>
                  <span>활주로: {conflict.runwayInvolved.join(', ')}</span>
                </div>
              </div>
            ))}
            {conflicts.length > 5 && (
              <p className="more-conflicts">... 외 {conflicts.length - 5}개</p>
            )}
          </div>
        )}
      </div>

      {/* REL 제어 결정 */}
      {systemStatus.relStatus.decisions.length > 0 && (
        <div className="status-section">
          <h4>REL 제어 결정</h4>
          {systemStatus.relStatus.decisions.slice(0, 3).map((decision, index) => (
            <div key={index} className="decision-item">
              <div className="decision-header">
                <span>{decision.runway} - {decision.controlAction}</span>
              </div>
              <div className="decision-details">
                <span className="reasoning">{decision.reasoning}</span>
                <span className="affected-lights">
                  영향: {decision.affectedRELLights.length}개 등화
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* THL 제어 결정 */}
      {systemStatus.thlStatus.decisions.length > 0 && (
        <div className="status-section">
          <h4>THL 제어 결정</h4>
          {systemStatus.thlStatus.decisions.slice(0, 3).map((decision, index) => (
            <div key={index} className="decision-item">
              <div className="decision-header">
                <span>{decision.runway} - {decision.controlAction}</span>
              </div>
              <div className="decision-details">
                <span className="reasoning">{decision.reasoning}</span>
                <span className="affected-lights">
                  영향: {decision.affectedTHLLights.length}개 등화
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 성능 메트릭 */}
      {performanceMetrics && (
        <div className="status-section">
          <h4>성능 메트릭</h4>
          <div className="status-item">
            <span>평균 처리 시간:</span>
            <span className="status-value">{formatTime(performanceMetrics.avgProcessingTime)}</span>
          </div>
          <div className="status-item">
            <span>최대 처리 시간:</span>
            <span className="status-value">{formatTime(performanceMetrics.maxProcessingTime)}</span>
          </div>
          <div className="status-item">
            <span>평균 정확도:</span>
            <span className="status-value">{formatPercentage(performanceMetrics.avgAccuracy)}</span>
          </div>
          <div className="status-item">
            <span>감지율:</span>
            <span className="status-value">{formatPercentage(performanceMetrics.detectionRate)}</span>
          </div>
        </div>
      )}

      {/* 마지막 업데이트 */}
      <div className="last-update">
        마지막 업데이트: {new Date(rwslState.lastUpdate).toLocaleTimeString('ko-KR')}
      </div>
    </div>
  );
};

function getConflictTypeKorean(type: string): string {
  const typeMap: Record<string, string> = {
    'runway_intrusion': '활주로 침입',
    'crossing_traffic': '교차 통행',
    'wake_turbulence': '후류 난기류',
    'simultaneous_takeoff': '동시 이륙',
    'head_on': '정면 충돌'
  };
  return typeMap[type] || type;
}