# Lunel System - API Specification

Base URL: `/api/v1`

## Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | 회원가입 |
| POST | /auth/login | 로그인 (JWT 발급) |
| POST | /auth/refresh | 토큰 갱신 |
| GET | /users/me | 현재 사용자 정보 |

## Schedules
| Method | Path | Description |
|--------|------|-------------|
| POST | /schedules | 일정 생성 |
| GET | /schedules | 일정 목록 (필터: type, subtype, group_id, project_id, visible_to_me, start, end, importance_min) |
| GET | /schedules/{id} | 일정 상세 |
| PATCH | /schedules/{id} | 일정 수정 |
| DELETE | /schedules/{id} | 일정 삭제 |

## Projects
| Method | Path | Description |
|--------|------|-------------|
| POST | /projects | 프로젝트 생성 |
| GET | /projects | 프로젝트 목록 |
| GET | /projects/{id} | 프로젝트 상세 |
| PATCH | /projects/{id} | 프로젝트 수정 |
| POST | /projects/{id}/nodes | 활동 노드 추가 (Phase 2) |
| POST | /projects/{id}/edges | 활동 엣지 추가 (Phase 2) |
| GET | /projects/{id}/tree | 활동 트리 조회 (Phase 2) |

## Groups
| Method | Path | Description |
|--------|------|-------------|
| POST | /groups | 그룹 생성 |
| GET | /groups | 그룹 목록 |
| GET | /groups/{id} | 그룹 상세 |
| POST | /groups/{id}/members | 멤버 추가 |
| DELETE | /groups/{id}/members/{userId} | 멤버 제거 |

## Ratings
| Method | Path | Description |
|--------|------|-------------|
| POST | /schedules/{id}/ratings | 일정 평가 |
| GET | /schedules/{id}/ratings-summary | 평가 요약 |

## Events (Phase 2)
| Method | Path | Description |
|--------|------|-------------|
| POST | /events | 이벤트 생성 |
| GET | /events/{id} | 이벤트 상세 |
| POST | /events/{id}/sync | 결과 동기화 |

## Visibility Policies
| Method | Path | Description |
|--------|------|-------------|
| POST | /visibility-policies | 권한 정책 생성 |
| GET | /visibility-policies/{id} | 정책 조회 |

## Notifications (Phase 2)
| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications | 알림 목록 |
| PATCH | /notifications/{id}/read | 읽음 처리 |
