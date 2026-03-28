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

## 미결 사항
- [ ] 공식 일정 데이터 입력 주체
- [ ] 결과 연동 대상 시스템 API 스펙
- [ ] 평가 공개 범위
- [ ] DAG 편집 UI 제공 여부 (Phase 3)
- [ ] 절차적 키 제품 투입 시점
