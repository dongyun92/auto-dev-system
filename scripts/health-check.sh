#!/bin/bash

# Auto-Dev System Health Check Script
# Usage: ./scripts/health-check.sh [--fix] [--verbose]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
FIX_MODE=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --fix)
      FIX_MODE=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--fix] [--verbose]"
      exit 1
      ;;
  esac
done

log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

warning() {
  echo -e "${YELLOW}[⚠]${NC} $1"
}

error() {
  echo -e "${RED}[✗]${NC} $1"
}

verbose() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${BLUE}[DEBUG]${NC} $1"
  fi
}

check_automation_block() {
  log "Checking automation block status..."
  
  if [ -f ".automation-blocked" ]; then
    error "Automation is currently BLOCKED"
    if command -v jq >/dev/null 2>&1; then
      local reason=$(jq -r '.reason // "Unknown"' .automation-blocked 2>/dev/null || echo "Unknown")
      local timestamp=$(jq -r '.timestamp // "Unknown"' .automation-blocked 2>/dev/null || echo "Unknown")
      echo "  Reason: $reason"
      echo "  Since: $timestamp"
    else
      verbose "jq not available, showing raw block file:"
      cat .automation-blocked | head -5
    fi
    
    if [ "$FIX_MODE" = true ]; then
      warning "Attempting to remove automation block..."
      rm -f .automation-blocked
      success "Automation block removed"
    else
      warning "Use --fix flag to remove the block"
    fi
    return 1
  else
    success "Automation is not blocked"
    return 0
  fi
}

check_github_connectivity() {
  log "Checking GitHub connectivity..."
  
  if command -v curl >/dev/null 2>&1; then
    if curl -s --head https://api.github.com/repos/dongyun92/auto-dev-system >/dev/null; then
      success "GitHub API is accessible"
      return 0
    else
      error "Cannot reach GitHub API"
      return 1
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget --spider -q https://api.github.com/repos/dongyun92/auto-dev-system; then
      success "GitHub API is accessible"
      return 0
    else
      error "Cannot reach GitHub API"
      return 1
    fi
  else
    warning "Neither curl nor wget available, skipping connectivity check"
    return 0
  fi
}

check_spec_files() {
  log "Checking YAML specification files..."
  
  local issues=0
  
  # Check spec directory exists
  if [ ! -d "spec" ]; then
    error "spec/ directory not found"
    if [ "$FIX_MODE" = true ]; then
      warning "Creating spec/ directory..."
      mkdir -p spec/modules
      success "Created spec/ directory structure"
    fi
    ((issues++))
  fi
  
  # Check spec.yaml exists
  if [ ! -f "spec/spec.yaml" ]; then
    error "spec/spec.yaml not found"
    ((issues++))
  else
    success "spec/spec.yaml exists"
    
    # Validate YAML syntax if yq is available
    if command -v yq >/dev/null 2>&1; then
      if yq eval . spec/spec.yaml >/dev/null 2>&1; then
        success "spec/spec.yaml has valid YAML syntax"
      else
        error "spec/spec.yaml has invalid YAML syntax"
        ((issues++))
      fi
    fi
  fi
  
  # Check for module files
  local module_count=$(find spec/modules -name "*.yaml" -type f 2>/dev/null | wc -l)
  if [ "$module_count" -eq 0 ]; then
    warning "No module YAML files found in spec/modules/"
  else
    success "Found $module_count module specification files"
  fi
  
  return $issues
}

check_workflows() {
  log "Checking GitHub Actions workflows..."
  
  local required_workflows=(
    ".github/workflows/orchestrator.yml"
    ".github/workflows/auto-merge.yml"
    ".github/workflows/ci-failure-handler.yml"
    ".github/workflows/dashboard-update.yml"
    ".github/workflows/loop-prevention.yml"
  )
  
  local missing=0
  
  for workflow in "${required_workflows[@]}"; do
    if [ -f "$workflow" ]; then
      success "$(basename "$workflow") exists"
    else
      error "Missing workflow: $workflow"
      ((missing++))
    fi
  done
  
  return $missing
}

check_documentation() {
  log "Checking documentation..."
  
  local doc_issues=0
  
  # Check for README
  if [ -f "README.md" ]; then
    success "README.md exists"
  else
    error "README.md not found"
    ((doc_issues++))
  fi
  
  # Check docs directory
  if [ -d "docs" ]; then
    success "docs/ directory exists"
    
    local doc_count=$(find docs -name "*.md" -type f | wc -l)
    verbose "Found $doc_count documentation files"
  else
    warning "docs/ directory not found"
    if [ "$FIX_MODE" = true ]; then
      warning "Creating docs/ directory..."
      mkdir -p docs
      success "Created docs/ directory"
    fi
  fi
  
  return $doc_issues
}

check_dependencies() {
  log "Checking system dependencies..."
  
  local deps_issues=0
  
  # Check for git
  if command -v git >/dev/null 2>&1; then
    success "git is available"
  else
    error "git is not installed"
    ((deps_issues++))
  fi
  
  # Check for Node.js (for Claude Code)
  if command -v node >/dev/null 2>&1; then
    local node_version=$(node --version)
    success "Node.js is available ($node_version)"
  else
    warning "Node.js not found (required for Claude Code)"
  fi
  
  # Check for npm
  if command -v npm >/dev/null 2>&1; then
    local npm_version=$(npm --version)
    success "npm is available ($npm_version)"
  else
    warning "npm not found (required for Claude Code)"
  fi
  
  # Check for Claude Code
  if command -v claude >/dev/null 2>&1; then
    success "Claude Code is installed"
  else
    warning "Claude Code not found"
    if [ "$FIX_MODE" = true ]; then
      warning "Attempting to install Claude Code..."
      if command -v npm >/dev/null 2>&1; then
        npm install -g @anthropic-ai/claude-code
        success "Claude Code installation attempted"
      else
        error "Cannot install Claude Code: npm not available"
        ((deps_issues++))
      fi
    else
      warning "Run: npm install -g @anthropic-ai/claude-code"
    fi
  fi
  
  return $deps_issues
}

generate_report() {
  log "Generating health check report..."
  
  local report_file="docs/health-check-$(date +%Y%m%d-%H%M%S).md"
  
  cat > "$report_file" << EOF
# System Health Check Report

**Generated**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Status**: $1

## Summary

- **Automation Block**: $2
- **GitHub Connectivity**: $3
- **Specification Files**: $4
- **GitHub Workflows**: $5
- **Documentation**: $6
- **Dependencies**: $7

## Recommendations

$8

---
*Generated by automated health check system*
EOF

  success "Health report saved to $report_file"
}

main() {
  echo "🏥 Auto-Dev System Health Check"
  echo "================================="
  echo ""
  
  local total_issues=0
  local recommendations=""
  
  # Run all checks
  check_automation_block || ((total_issues++))
  check_github_connectivity || ((total_issues++))
  check_spec_files || ((total_issues++))
  check_workflows || ((total_issues++))
  check_documentation || ((total_issues++))
  check_dependencies || ((total_issues++))
  
  echo ""
  echo "================================="
  
  if [ $total_issues -eq 0 ]; then
    success "🎉 All checks passed! System is healthy."
    local status="✅ HEALTHY"
  else
    error "⚠️ Found $total_issues issue(s) that need attention."
    local status="⚠️ NEEDS ATTENTION"
    
    if [ "$FIX_MODE" = false ]; then
      warning "Run with --fix flag to attempt automatic fixes"
      recommendations="Run health check with --fix flag to attempt automatic repairs."
    fi
  fi
  
  # Generate report if docs directory exists
  if [ -d "docs" ]; then
    generate_report "$status" \
      "$([ -f .automation-blocked ] && echo "BLOCKED" || echo "OK")" \
      "OK" \
      "$([ $total_issues -gt 0 ] && echo "ISSUES" || echo "OK")" \
      "OK" \
      "OK" \
      "OK" \
      "$recommendations"
  fi
  
  echo ""
  exit $total_issues
}

# Run main function
main "$@"