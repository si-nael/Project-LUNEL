# Lunel System - Change Log

## 2026-03-29: 프로젝트 초기화
- 구현 명세 v1 확정
- 기술 스택 확정: FastAPI + PostgreSQL + Redis + Next.js
- 규모: 학교 전체 서비스
- 플랫폼: 웹 우선 (반응형)
- Phase 0 구현 시작: 워크스페이스 구조, Docker, DB 스키마, 보일러플레이트

## 2026-03-29: Phase 0 검증 + Phase 1 준비
- Python 3.12.10, Node.js 24.14.1 설치
- email-validator 누락 수정
- passlib → bcrypt 직접 사용으로 변경 (Python 3.12 호환)
- PG-specific types → cross-DB types (Uuid, JSON) 변경
- auth refresh UUID 변환 버그 수정
- 49개 테스트 작성 및 전부 통과 (auth 7, importance 7, visibility 11, api 24)
- Frontend npm install 완료
- FastAPI 27개 라우트 정상 등록 확인
- Phase 0 상태: 완전 검증 완료

## 2026-03-29: Phase 1.8 프론트엔드 MVP 완료
- 프론트엔드 페이지 9개 생성 (Next.js 14 App Router):
  - /login, /register — 인증 페이지
  - /dashboard — 대시보드 홈 (오늘 일정, 마감 임박, 중요 일정)
  - /dashboard/calendar — 월/주 뷰 캘린더
  - /dashboard/schedules — 일정 목록 (필터), /schedules/[id] — 상세, /schedules/new — 생성
  - /dashboard/groups — 그룹 목록 + 생성
  - /dashboard/projects — 프로젝트 목록 + 진행률 바
- AuthProvider context, axios interceptor (자동 토큰 갱신)
- Dashboard layout (보호 라우트 + 사이드바 네비게이션)
- 랜딩 페이지 → /login 리다이렉트
- `npm run build` 성공 (12/12 페이지, TypeScript 오류 없음)

## 2026-03-29: Phase 2 — 운영 기능 구현 완료

### 인프라
- Docker Desktop 4.66.1 설치, PostgreSQL 16 + Redis 7 컨테이너 기동
- Alembic migration 001 (Phase 1 9테이블) + 002 (Phase 2 8테이블) 적용 → 총 18테이블
- DateTime(timezone=True) 수정 (전 모델 7개 파일)
- E2E 통합 테스트 16/16 통과 (실 PostgreSQL 대상)

### 2.1 프로젝트 노드 구조
- 모델: ActivityNode, ActivityEdge
- API 6개: 노드 CRUD, 트리 조회, 엣지 생성
- 재귀 진행률 전파 (_recalc_parent_progress → 프로젝트 progress_percent 자동 업데이트)
- 프론트엔드: /dashboard/projects/[id] — 작업 트리 UI (노드 추가, 완료 처리)

### 2.2 임시 그룹 강화
- 서비스: group_lifecycle.py — deactivate_expired_groups() (만료 임시 그룹 자동 비활성화)
- Celery periodic task 연동 준비 완료 (async 함수)
- 테스트: 만료 그룹 비활성화 + 미만료 그룹 유지 검증

### 2.3 이벤트/대회 시스템
- 이벤트 API 5개: 생성, 목록, 상세, 수정, 동기화 (POST /events/{id}/sync)
- 대회 API 9개: CRUD, 참가자 등록(인원제한), 제출, 채점, 순위표 생성/조회
- 동기화 작업(SyncJob) 관리: 생성, 목록 조회
- v1은 수동 동기화 (placeholder) — 외부 시스템 연동 미구현

### 2.4 알림 시스템
- API 4개: 목록, 읽음처리, 전체읽음, 미읽수 카운트
- 서비스: notifications.py — 5가지 트리거 함수 (마감임박, 일정변경, 평가수신, 그룹초대, 결과확정)
- 프론트엔드: /dashboard/notifications — 알림 목록, 필터, 전체읽음

### 2.5 운영자 대시보드
- 프론트엔드: /dashboard/admin — 전체 일정/프로젝트/그룹 현황, 중요도 상위 일정 Top 10
- 권한 검사: ADMIN 또는 TEACHER만 접근 가능

### 테스트 현황
- 총 87개 테스트 전부 통과
  - test_api: 24 (Phase 1 API 전체)
  - test_auth_security: 7 (비밀번호 + JWT)
  - test_importance: 7 (긴급도 가중치)
  - test_visibility: 11 (권한 정책)
  - test_activity: 9 (노드/엣지 CRUD)
  - test_notifications: 6 (알림 API)
  - test_competitions: 7 (대회/참가/제출/채점/순위)
  - test_events: 7 (이벤트 CRUD + 동기화)
  - test_services: 9 (알림 트리거 7 + 임시그룹 생명주기 2)

### 프론트엔드
- 총 15페이지 빌드 성공 (TypeScript 오류 없음)
- 신규 4페이지: notifications, competitions, projects/[id], admin
- 사이드바 네비게이션 8항목: 홈, 캘린더, 일정, 프로젝트, 그룹, 알림, 대회, 운영
- TypeScript 타입 추가: ActivityNode, ActivityEdge, Notification, Competition, Participant, Submission, Scoreboard

### 전체 엔드포인트: 37개
- Phase 1: 17개 (auth 3, users 1, groups 5, schedules 5, projects 4, ratings 2, visibility 2)
- Phase 2: 20개 (activity 6, notifications 4, competitions 9, events 5, sync-jobs 1 내 events)

## 미결 사항
- [ ] 공식 일정 데이터 입력 주체
- [ ] 결과 연동 대상 시스템 API 스펙
- [ ] 평가 공개 범위

## 2026-03-30: Phase 3 — 루넬다움 확장 구현 완료

### 3.1 DAG 완전 지원
- 서비스: dag.py — DFS 사이클 감지 (has_cycle, would_create_cycle), 위상 정렬 (Kahn's algorithm), 레이어 그룹핑 (DAG 시각화용)
- API 3개 추가: GET /projects/{id}/dag-order, /dag-layers, /dag-check
- 엣지 생성 시 DEPENDS_ON/BLOCKS 타입에 자동 사이클 감지 검증
- 프론트엔드: /dashboard/dag — 프로젝트 선택 → 레이어 뷰 시각화 + 사이클 상태 표시

### 3.2 과거 시점 조회 (Event Sourcing)
- 모델: ScheduleHistory, ProjectHistory (+ ChangeType enum: CREATE/UPDATE/DELETE)
- 서비스: history.py — record_schedule_change, record_project_change, get_schedule_at, get_project_at
- API 4개: GET /schedules/{id}/history, /schedules/{id}/at?timestamp=, /projects/{id}/history, /projects/{id}/at?timestamp=
- 프론트엔드: /dashboard/history — 일정/프로젝트 선택 → 변경 이력 타임라인 (이전/이후 diff 뷰)

### 3.3 기댓값 예측
- 서비스: expected_value.py — 선택지별 기댓값/분산/표준편차 계산, 추천 전략 생성
- API 1개: POST /analysis/expected-value (ADMIN/TEACHER 전용)
- 확률 합 검증 (≈1.0)
- 프론트엔드: /dashboard/analysis — 선택지/결과 입력 UI → 기댓값 분석 결과 테이블 + 추천

### 3.4 절차적 키 & 챌린지 시스템
- 모델: Challenge (+ ChallengeStatus enum: PENDING/VERIFIED/FAILED/EXPIRED)
- 서비스: procedural_key.py — challenge-response 인증 엔진 (수학 챌린지, 텍스트 챌린지, 패스프레이즈)
- API 2개: POST /challenges (챌린지 요청), POST /challenges/{id}/verify (응답 검증)
- 시도 횟수 제한 (max_attempts), 만료 시간 (TTL) 지원
- VisibilityPolicy PROCEDURAL_KEY 스코프 통합: 검증 완료 시 접근 허용
- visibility.py 업데이트: PROCEDURAL_KEY → has_verified_challenge 연동

### 마이그레이션
- Alembic 003: schedule_history, project_history, challenges 테이블 생성
- 총 21개 테이블

### 테스트 현황
- 총 109개 테스트 전부 통과 (기존 87 + Phase 3 22개)
  - test_phase3: 22 (DAG 7 + History 6 + Expected Value 4 + Procedural Key 5)

### 프론트엔드
- 총 18페이지 빌드 성공
- 신규 3페이지: dag, history, analysis
- 사이드바 네비게이션 11항목: 홈, 캘린더, 일정, 프로젝트, 그룹, 알림, 대회, DAG, 변경이력, 분석, 운영

### 전체 엔드포인트: 47개
- Phase 1: 17개
- Phase 2: 20개
- Phase 3: 10개 (DAG 3, History 4, Analysis 1, Challenges 2)
