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
| GET | /events | 이벤트 목록 |
| GET | /events/{id} | 이벤트 상세 |
| PATCH | /events/{id} | 이벤트 수정 |
| POST | /events/{id}/sync | 결과 동기화 (SyncJob 생성) |
| GET | /events/{id}/sync-jobs | 동기화 작업 목록 |

## Competitions (Phase 2)
| Method | Path | Description |
|--------|------|-------------|
| POST | /competitions | 대회 생성 (event_id 연결) |
| GET | /competitions/{id} | 대회 상세 |
| POST | /competitions/{id}/participants | 참가자 등록 |
| GET | /competitions/{id}/participants | 참가자 목록 |
| POST | /competitions/{id}/submissions | 제출물 생성 |
| GET | /competitions/{id}/submissions | 제출물 목록 |
| PATCH | /competitions/{id}/submissions/{sid}/grade | 채점 |
| POST | /competitions/{id}/scoreboard | 순위표 생성 |
| GET | /competitions/{id}/scoreboard | 최신 순위표 조회 |

## Visibility Policies
| Method | Path | Description |
|--------|------|-------------|
| POST | /visibility-policies | 권한 정책 생성 |
| GET | /visibility-policies/{id} | 정책 조회 |

## Notifications (Phase 2)
| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications | 알림 목록 (unread_only 필터) |
| PATCH | /notifications/{id}/read | 읽음 처리 |
| POST | /notifications/read-all | 전체 읽음 처리 |
| GET | /notifications/unread-count | 미읽은 알림 수 |

## Activity Nodes (Phase 2)
| Method | Path | Description |
|--------|------|-------------|
| GET | /projects/{id}/nodes | 프로젝트 활동 노드 목록 |
| POST | /projects/{id}/nodes | 활동 노드 생성 |
| PATCH | /projects/{id}/nodes/{nid} | 노드 수정 (진행률/상태) |
| DELETE | /projects/{id}/nodes/{nid} | 노드 삭제 |
| GET | /projects/{id}/tree | 트리 순서 조회 |
| POST | /projects/{id}/edges | 엣지 생성 (의존성/관계) |

## DAG (Phase 3)
| Method | Path | Description |
|--------|------|-------------|
| GET | /projects/{id}/dag-order | 위상 정렬 순서 |
| GET | /projects/{id}/dag-layers | DAG 레이어 그룹 (시각화) |
| GET | /projects/{id}/dag-check | 사이클 존재 여부 확인 |

## History (Phase 3)
| Method | Path | Description |
|--------|------|-------------|
| GET | /schedules/{id}/history | 일정 변경 이력 |
| GET | /schedules/{id}/at?timestamp= | 특정 시점 일정 상태 조회 |
| GET | /projects/{id}/history | 프로젝트 변경 이력 |
| GET | /projects/{id}/at?timestamp= | 특정 시점 프로젝트 상태 조회 |

## Analysis (Phase 3)
| Method | Path | Description |
|--------|------|-------------|
| POST | /analysis/expected-value | 기댓값 분석 (ADMIN/TEACHER 전용) |

## Challenges (Phase 3)
| Method | Path | Description |
|--------|------|-------------|
| POST | /challenges | 챌린지 요청 (절차적 키) |
| POST | /challenges/{id}/verify | 챌린지 응답 검증 |
