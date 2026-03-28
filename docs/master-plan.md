# Lunel System - Master Plan

## 프로젝트 개요
루넬 시스템 = 권한 기반 일정·프로젝트 통합 관리 플랫폼 (학교 전체 서비스)

## 기술 스택
- Backend: FastAPI (Python 3.12+), SQLAlchemy 2.0 (async), Alembic
- DB: PostgreSQL 16+
- Cache/Queue: Redis 7, Celery
- Frontend: Next.js 14+ (App Router)
- Auth: JWT + refresh token
- Platform: 웹 우선 (반응형)

## 구현 Phase
- **Phase 0**: 프로젝트 셋업, DB 스키마, docs/ 폴더 구조
- **Phase 1**: 핵심 MVP (Users, Groups, Schedules, Projects, Permissions, Importance, Ratings)
- **Phase 2**: 운영 (Project Nodes/Edges, Temp Groups, Events, Competition Sync, Notifications)
- **Phase 3**: 확장 (DAG, History/시점조회, 기댓값 예측, 절차적 키/챌린지)

## Phase 1 구현 순서
1. 사용자 & 인증 (JWT)
2. 그룹 & 멤버십
3. 권한 정책 (VisibilityPolicy)
4. 프로젝트 CRUD
5. 일정 CRUD (3 types, 11 subtypes)
6. 중요도 시스템
7. 평가/피드백
8. 프론트엔드 MVP

## Phase 2 구현 순서
1. 프로젝트 노드/엣지 (트리 + DAG)
2. 임시 그룹 강화
3. 이벤트/대회 시스템
4. 알림 시스템
5. 운영자 대시보드

## Phase 3 구현 순서
1. DAG 완전 지원
2. 과거 시점 조회 (event sourcing)
3. 선택의 기댓값 예측
4. 절차적 키 & 챌린지 시스템
