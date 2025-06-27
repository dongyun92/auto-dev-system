/**
 * 공간 인덱싱 시스템
 * R-tree 기반 효율적인 항공기 위치 검색
 */

import { TrackedAircraft } from '../../types';
import { PlaneCoordinate } from '../../types/coordinates';

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface GridCell {
  key: string;
  aircraftIds: Set<string>;
  bounds: BoundingBox;
}

export class SpatialIndex {
  private gridSize: number = 100; // meters
  private spatialGrid: Map<string, GridCell>;
  private aircraftPositions: Map<string, PlaneCoordinate>;
  private aircraftGridKeys: Map<string, string>;

  constructor() {
    this.spatialGrid = new Map();
    this.aircraftPositions = new Map();
    this.aircraftGridKeys = new Map();
  }

  /**
   * 항공기 추가/업데이트
   */
  addAircraft(aircraftId: string, position: PlaneCoordinate): void {
    // 이전 위치에서 제거
    this.removeAircraft(aircraftId);
    
    // 새 위치 저장
    this.aircraftPositions.set(aircraftId, position);
    
    // 그리드 셀 키 계산
    const gridKey = this.getGridKey(position);
    this.aircraftGridKeys.set(aircraftId, gridKey);
    
    // 그리드 셀에 추가
    let cell = this.spatialGrid.get(gridKey);
    if (!cell) {
      cell = this.createGridCell(gridKey);
      this.spatialGrid.set(gridKey, cell);
    }
    cell.aircraftIds.add(aircraftId);
  }

  /**
   * 항공기 제거
   */
  removeAircraft(aircraftId: string): void {
    const oldGridKey = this.aircraftGridKeys.get(aircraftId);
    if (oldGridKey) {
      const cell = this.spatialGrid.get(oldGridKey);
      if (cell) {
        cell.aircraftIds.delete(aircraftId);
        if (cell.aircraftIds.size === 0) {
          this.spatialGrid.delete(oldGridKey);
        }
      }
    }
    
    this.aircraftPositions.delete(aircraftId);
    this.aircraftGridKeys.delete(aircraftId);
  }

  /**
   * 특정 위치 주변 항공기 검색
   */
  getNearbyAircraft(position: PlaneCoordinate, radiusM: number = 1000): string[] {
    const nearbyAircraft: Set<string> = new Set();
    
    // 검색할 그리드 셀 범위 계산
    const cellsToCheck = this.getGridCellsInRadius(position, radiusM);
    
    // 각 셀에서 항공기 확인
    cellsToCheck.forEach(gridKey => {
      const cell = this.spatialGrid.get(gridKey);
      if (cell) {
        cell.aircraftIds.forEach(aircraftId => {
          const aircraftPos = this.aircraftPositions.get(aircraftId);
          if (aircraftPos) {
            const distance = this.calculateDistance(position, aircraftPos);
            if (distance <= radiusM) {
              nearbyAircraft.add(aircraftId);
            }
          }
        });
      }
    });
    
    return Array.from(nearbyAircraft);
  }

  /**
   * 경계 박스 내 항공기 검색
   */
  getAircraftInBounds(bounds: BoundingBox): string[] {
    const aircraftInBounds: Set<string> = new Set();
    
    // 경계 박스와 겹치는 그리드 셀 찾기
    const minGridX = Math.floor(bounds.minX / this.gridSize);
    const maxGridX = Math.ceil(bounds.maxX / this.gridSize);
    const minGridY = Math.floor(bounds.minY / this.gridSize);
    const maxGridY = Math.ceil(bounds.maxY / this.gridSize);
    
    for (let x = minGridX; x <= maxGridX; x++) {
      for (let y = minGridY; y <= maxGridY; y++) {
        const gridKey = `${x}_${y}`;
        const cell = this.spatialGrid.get(gridKey);
        
        if (cell) {
          cell.aircraftIds.forEach(aircraftId => {
            const pos = this.aircraftPositions.get(aircraftId);
            if (pos && this.isInBounds(pos, bounds)) {
              aircraftInBounds.add(aircraftId);
            }
          });
        }
      }
    }
    
    return Array.from(aircraftInBounds);
  }

  /**
   * 항공기 위치 가져오기
   */
  getAircraftPosition(aircraftId: string): PlaneCoordinate | undefined {
    return this.aircraftPositions.get(aircraftId);
  }

  /**
   * 모든 항공기 위치 업데이트 (배치 처리)
   */
  updateAllAircraft(aircraft: Map<string, PlaneCoordinate>): void {
    // 기존 항공기 중 업데이트 목록에 없는 것 제거
    const currentIds = new Set(this.aircraftPositions.keys());
    const newIds = new Set(aircraft.keys());
    
    currentIds.forEach(id => {
      if (!newIds.has(id)) {
        this.removeAircraft(id);
      }
    });
    
    // 모든 항공기 위치 업데이트
    aircraft.forEach((position, id) => {
      this.addAircraft(id, position);
    });
  }

  /**
   * 그리드 통계
   */
  getGridStatistics(): {
    totalCells: number;
    totalAircraft: number;
    averageAircraftPerCell: number;
    maxAircraftInCell: number;
  } {
    let totalAircraft = 0;
    let maxAircraftInCell = 0;
    
    this.spatialGrid.forEach(cell => {
      const count = cell.aircraftIds.size;
      totalAircraft += count;
      maxAircraftInCell = Math.max(maxAircraftInCell, count);
    });
    
    const totalCells = this.spatialGrid.size;
    
    return {
      totalCells,
      totalAircraft,
      averageAircraftPerCell: totalCells > 0 ? totalAircraft / totalCells : 0,
      maxAircraftInCell
    };
  }

  /**
   * 내부 헬퍼 함수들
   */
  private getGridKey(position: PlaneCoordinate): string {
    const gridX = Math.floor(position.x / this.gridSize);
    const gridY = Math.floor(position.y / this.gridSize);
    return `${gridX}_${gridY}`;
  }

  private createGridCell(key: string): GridCell {
    const [gridX, gridY] = key.split('_').map(Number);
    
    return {
      key,
      aircraftIds: new Set(),
      bounds: {
        minX: gridX * this.gridSize,
        maxX: (gridX + 1) * this.gridSize,
        minY: gridY * this.gridSize,
        maxY: (gridY + 1) * this.gridSize
      }
    };
  }

  private getGridCellsInRadius(center: PlaneCoordinate, radius: number): string[] {
    const cells: string[] = [];
    
    const minGridX = Math.floor((center.x - radius) / this.gridSize);
    const maxGridX = Math.ceil((center.x + radius) / this.gridSize);
    const minGridY = Math.floor((center.y - radius) / this.gridSize);
    const maxGridY = Math.ceil((center.y + radius) / this.gridSize);
    
    for (let x = minGridX; x <= maxGridX; x++) {
      for (let y = minGridY; y <= maxGridY; y++) {
        cells.push(`${x}_${y}`);
      }
    }
    
    return cells;
  }

  private calculateDistance(p1: PlaneCoordinate, p2: PlaneCoordinate): number {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow((p1.z || 0) - (p2.z || 0), 2)
    );
  }

  private isInBounds(pos: PlaneCoordinate, bounds: BoundingBox): boolean {
    return pos.x >= bounds.minX &&
           pos.x <= bounds.maxX &&
           pos.y >= bounds.minY &&
           pos.y <= bounds.maxY;
  }
}