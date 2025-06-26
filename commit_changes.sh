#!/bin/bash

# Git 상태 확인
echo "=== Git 상태 확인 ==="
git status

# 변경사항 추가
echo -e "\n=== 변경사항 추가 ==="
git add modules/atc-dashboard/src/components/RadarDisplay.tsx

# 커밋
echo -e "\n=== 커밋 생성 ==="
git commit -m "feat: 위성지도와 OSM 별도 오프셋 관리 구현

- 위성지도 전용 오프셋 (-0.4, -14.9) 적용
- 위성지도 전용 벡터맵 조정값 (159.1, 242.1) 적용
- OSM과 위성지도 독립적인 위치 조정 가능
- 타일 렌더링 시 조건부 오프셋 적용 버그 수정

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# 결과 확인
echo -e "\n=== 커밋 완료 ==="
git log --oneline -1