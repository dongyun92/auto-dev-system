# 모듈 스펙 예시 파일

# 이 파일은 모듈별 개발 스펙을 정의하는 예시입니다.
# 실제 프로젝트에서는 이 형식을 따라 각 모듈의 YAML 파일을 작성하세요.

# 예시: user-service.yaml
# name: "user-service"
# description: "사용자 관리 서비스"
# version: "1.0.0"
# depends_on: ["database-setup"]
# endpoints:
#   - path: "/api/users"
#     method: "GET"
#     description: "사용자 목록 조회"
#   - path: "/api/users/{id}"
#     method: "GET"
#     description: "특정 사용자 조회"
# tests:
#   unit_test_coverage: 80
#   integration_tests: true
# tech_stack:
#   - "spring-boot"
#   - "jpa"
#   - "postgresql"
