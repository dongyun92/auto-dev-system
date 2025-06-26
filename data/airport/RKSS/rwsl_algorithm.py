#!/usr/bin/env python3
"""
김포공항 RWSL(Runway Status Lights) 시스템 알고리즘
= 공간-시간 그리드 기반 충돌 예측 시스템 =

핵심 아이디어:
1. 공간 해싱: 공항을 50m x 50m 격자로 분할
2. 벡터 예측: 항공기 궤적을 선형 벡터로 모델링  
3. 시간 윈도우: 30초 예측 범위로 충돌 가능성 계산
4. 영역 기반 판단: 활주로/유도로를 다각형 영역으로 처리

자동차 신호등과의 유사점:
- 교차로 = 활주로/유도로 교차점
- 신호등 = REL/THL 등화
- 차량 = 항공기
- 속도 제한 = 택싱 속도
"""

import numpy as np
import json
import time
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict
from enum import Enum
import math

class LightState(Enum):
    """등화 상태"""
    OFF = 0      # 소등
    RED = 1      # 적색 (정지)
    AMBER = 2    # 호박색 (주의)

class AircraftType(Enum):
    """항공기 분류"""
    SMALL = "small"     # Code A/B
    MEDIUM = "medium"   # Code C/D  
    LARGE = "large"     # Code E/F

@dataclass
class Position:
    """2D 위치 정보"""
    x: float    # 로컬 X 좌표 (미터)
    y: float    # 로컬 Y 좌표 (미터)
    
    def distance_to(self, other: 'Position') -> float:
        """다른 위치까지의 거리"""
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)

@dataclass
class Velocity:
    """속도 벡터"""
    vx: float   # X 방향 속도 (m/s)
    vy: float   # Y 방향 속도 (m/s)
    
    @property
    def speed(self) -> float:
        """속력 (m/s)"""
        return math.sqrt(self.vx**2 + self.vy**2)
    
    @property
    def heading(self) -> float:
        """진행 방향 (도, 북쪽 기준)"""
        return math.degrees(math.atan2(self.vx, self.vy)) % 360

@dataclass
class Aircraft:
    """항공기 정보"""
    callsign: str
    position: Position
    velocity: Velocity
    aircraft_type: AircraftType
    wingspan: float         # 날개폭 (미터)
    length: float          # 동체 길이 (미터)
    last_update: float     # 마지막 업데이트 시간
    
    def predict_position(self, time_delta: float) -> Position:
        """시간 후 예상 위치 계산"""
        future_x = self.position.x + self.velocity.vx * time_delta
        future_y = self.position.y + self.velocity.vy * time_delta
        return Position(future_x, future_y)
    
    def get_bounding_box(self, time_delta: float = 0) -> Tuple[Position, Position]:
        """항공기 바운딩 박스 (현재 또는 미래 시점)"""
        pos = self.predict_position(time_delta) if time_delta > 0 else self.position
        half_width = max(self.wingspan, self.length) / 2
        
        min_pos = Position(pos.x - half_width, pos.y - half_width)
        max_pos = Position(pos.x + half_width, pos.y + half_width)
        return min_pos, max_pos

@dataclass
class GridCell:
    """공간 해싱용 격자 셀"""
    x_index: int
    y_index: int
    aircraft_ids: Set[str] = field(default_factory=set)
    
    def add_aircraft(self, aircraft_id: str):
        self.aircraft_ids.add(aircraft_id)
    
    def remove_aircraft(self, aircraft_id: str):
        self.aircraft_ids.discard(aircraft_id)

@dataclass
class ProtectionZone:
    """보호 구역 (활주로, 유도로 등)"""
    zone_id: str
    zone_type: str  # 'runway', 'taxiway', 'intersection'
    polygon: List[Position]  # 다각형 꼭짓점들
    runway_id: Optional[str] = None
    
    def contains_point(self, point: Position) -> bool:
        """점이 보호 구역 내부에 있는지 판단 (Ray casting algorithm)"""
        x, y = point.x, point.y
        n = len(self.polygon)
        inside = False
        
        p1x, p1y = self.polygon[0].x, self.polygon[0].y
        for i in range(1, n + 1):
            p2x, p2y = self.polygon[i % n].x, self.polygon[i % n].y
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside

class SpatialHashGrid:
    """공간 해싱 그리드 - 빠른 근처 항공기 검색"""
    
    def __init__(self, cell_size: float = 50.0):
        self.cell_size = cell_size
        self.grid: Dict[Tuple[int, int], GridCell] = {}
    
    def _get_cell_indices(self, position: Position) -> Tuple[int, int]:
        """위치에 해당하는 셀 인덱스 계산"""
        x_idx = int(position.x // self.cell_size)
        y_idx = int(position.y // self.cell_size)
        return x_idx, y_idx
    
    def _get_cell(self, x_idx: int, y_idx: int) -> GridCell:
        """셀 가져오기 (없으면 생성)"""
        key = (x_idx, y_idx)
        if key not in self.grid:
            self.grid[key] = GridCell(x_idx, y_idx)
        return self.grid[key]
    
    def add_aircraft(self, aircraft: Aircraft):
        """항공기를 그리드에 추가"""
        x_idx, y_idx = self._get_cell_indices(aircraft.position)
        cell = self._get_cell(x_idx, y_idx)
        cell.add_aircraft(aircraft.callsign)
    
    def remove_aircraft(self, aircraft: Aircraft):
        """항공기를 그리드에서 제거"""
        x_idx, y_idx = self._get_cell_indices(aircraft.position)
        if (x_idx, y_idx) in self.grid:
            self.grid[(x_idx, y_idx)].remove_aircraft(aircraft.callsign)
    
    def get_nearby_aircraft(self, position: Position, radius: float = 100.0) -> Set[str]:
        """반경 내 근처 항공기 ID 목록"""
        nearby_aircraft = set()
        
        # 검색할 셀 범위 계산
        cell_radius = int(radius // self.cell_size) + 1
        center_x, center_y = self._get_cell_indices(position)
        
        for dx in range(-cell_radius, cell_radius + 1):
            for dy in range(-cell_radius, cell_radius + 1):
                cell_key = (center_x + dx, center_y + dy)
                if cell_key in self.grid:
                    nearby_aircraft.update(self.grid[cell_key].aircraft_ids)
        
        return nearby_aircraft

class ConflictDetector:
    """충돌 탐지 엔진 - 핵심 알고리즘"""
    
    def __init__(self, prediction_horizon: float = 30.0):
        self.prediction_horizon = prediction_horizon  # 예측 범위 (초)
        self.time_steps = 30  # 시간 분할 수 (1초씩)
        
    def predict_trajectory(self, aircraft: Aircraft) -> List[Position]:
        """항공기 궤적 예측 (등속 직선 운동 가정)"""
        trajectory = []
        dt = self.prediction_horizon / self.time_steps
        
        for i in range(self.time_steps + 1):
            time_offset = i * dt
            future_pos = aircraft.predict_position(time_offset)
            trajectory.append(future_pos)
        
        return trajectory
    
    def check_zone_occupation(self, aircraft: Aircraft, zone: ProtectionZone) -> Tuple[bool, float]:
        """보호구역 점유 여부와 점유 시작 시간 예측"""
        trajectory = self.predict_trajectory(aircraft)
        dt = self.prediction_horizon / self.time_steps
        
        for i, pos in enumerate(trajectory):
            if zone.contains_point(pos):
                occupation_time = i * dt
                return True, occupation_time
        
        return False, -1
    
    def detect_conflicts(self, aircraft1: Aircraft, aircraft2: Aircraft) -> bool:
        """두 항공기 간 충돌 가능성 검사"""
        # 간단한 거리 기반 충돌 검사
        min_separation = max(aircraft1.wingspan, aircraft1.length, 
                           aircraft2.wingspan, aircraft2.length) + 10  # 10m 안전 여유
        
        dt = self.prediction_horizon / self.time_steps
        for i in range(self.time_steps + 1):
            time_offset = i * dt
            pos1 = aircraft1.predict_position(time_offset)
            pos2 = aircraft2.predict_position(time_offset)
            
            distance = pos1.distance_to(pos2)
            if distance < min_separation:
                return True
        
        return False

class RWSLController:
    """RWSL 등화 제어 시스템"""
    
    def __init__(self, config_path: str):
        self.load_configuration(config_path)
        self.spatial_grid = SpatialHashGrid(cell_size=50.0)
        self.conflict_detector = ConflictDetector(prediction_horizon=30.0)
        self.aircraft_registry: Dict[str, Aircraft] = {}
        self.light_states: Dict[str, LightState] = {}
        self.protection_zones: Dict[str, ProtectionZone] = {}
        
        # 등화 상태 초기화
        self._initialize_lights()
        self._initialize_protection_zones()
    
    def load_configuration(self, config_path: str):
        """설정 파일 로드"""
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
    
    def _initialize_lights(self):
        """모든 등화를 OFF 상태로 초기화"""
        lights_file = "/Users/dykim/dev/auto-dev-system/data/airport/RKSS/rwsl_lights.json"
        with open(lights_file, 'r', encoding='utf-8') as f:
            lights_data = json.load(f)
        
        # REL 등화 초기화
        for rel_group in lights_data['REL']['lights']:
            for light in rel_group['lights']:
                self.light_states[light['id']] = LightState.OFF
        
        # THL 등화 초기화  
        for thl_group in lights_data['THL']['lights']:
            for light in thl_group['lights']:
                self.light_states[light['id']] = LightState.OFF
    
    def _initialize_protection_zones(self):
        """보호 구역 초기화"""
        # 활주로 보호 구역
        runways = [
            {
                'id': 'RW_14R_32L',
                'polygon': [
                    Position(-100, -30), Position(3300, -30),
                    Position(3300, 30), Position(-100, 30)
                ]
            },
            {
                'id': 'RW_14L_32R', 
                'polygon': [
                    Position(-100, 120), Position(3700, 120),
                    Position(3700, 180), Position(-100, 180)
                ]
            }