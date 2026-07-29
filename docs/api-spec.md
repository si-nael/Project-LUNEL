# Lunel API

Base URL: `/api/v1`

모든 보호 API는 `Authorization: Bearer <access-token>`을 사용한다.

## Core Engine

| Method | Path | 설명 |
|---|---|---|
| GET | `/engine/projects/{projectId}/state` | 실행 가능·막힘·기한 초과를 포함한 권위 상태 투영 |
| POST | `/engine/projects/{projectId}/nodes/{nodeId}/transition` | 버전·선행 조건을 검사한 상태 전환 |
| GET | `/engine/oracle/schedules?from_at=&to_at=` | 가시 일정 충돌과 승인형 조정안 |

전환 명령 예시:

```json
{
  "target_status": "IN_PROGRESS",
  "expected_version": 3
}
```

## Problem Forge

| Method | Path | 설명 |
|---|---|---|
| GET/POST | `/problems` | 문제 검색·생성 |
| GET/PATCH/DELETE | `/problems/{id}` | 패키지 조회·수정·보관 |
| POST | `/problems/{id}/revisions` | 현재 버전 스냅샷 |
| POST | `/problems/{id}/test-groups` | 테스트 그룹 추가 |
| PATCH/DELETE | `/problems/test-groups/{id}` | 테스트 그룹 수정·삭제 |
| POST | `/problems/test-groups/{id}/cases` | 테스트 케이스 추가 |
| PATCH/DELETE | `/problems/test-cases/{id}` | 테스트 케이스 수정·삭제 |
| POST | `/problems/{id}/solutions` | 기준 풀이 추가 |
| DELETE | `/problems/solutions/{id}` | 기준 풀이 삭제 |

학생의 `GET /problems/{id}` 응답은 `test_groups`, `solutions`, `revisions`가 빈
배열이다.

## Competition Runtime

| Method | Path | 설명 |
|---|---|---|
| GET/POST | `/competitions` | 런타임 목록·생성 |
| GET/PATCH | `/competitions/{id}` | 런타임 조회·설정 |
| GET/POST | `/competitions/{id}/problems` | 행사 문제 릴리스 조회·연결 |
| PATCH/DELETE | `/competitions/{id}/problems/{releaseId}` | 릴리스 설정·해제 |
| GET/POST | `/competitions/{id}/participants` | 참가자 조회·등록 |
| GET/POST | `/competitions/{id}/submissions` | 제출 조회·생성 |
| PATCH | `/competitions/{id}/submissions/{submissionId}/grade` | 수동 점수 |
| PATCH | `/competitions/{id}/submissions/{submissionId}/judge` | 판정 결과 기록 |
| GET | `/competitions/{id}/scoreboard/live` | IOI/ICPC 실시간 투영 |
| GET/POST | `/competitions/{id}/scoreboard` | 최근 스냅샷 조회·새 스냅샷 생성 |

소스 코드 제출은 `QUEUED`, 단답 제출은 지원 체커에서 즉시 판정된다.

## Existing Platform APIs

| 영역 | 대표 경로 |
|---|---|
| 인증 | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| 사용자 | `/users/me` |
| 그룹·권한 | `/groups`, `/visibility-policies`, `/challenges` |
| 일정 | `/schedules`, `/schedules/{id}/ratings` |
| 프로젝트 | `/projects`, `/projects/{id}/nodes`, `/projects/{id}/edges` |
| DAG | `/projects/{id}/dag-order`, `/dag-layers`, `/dag-check` |
| 행사 | `/events`, `/events/{id}/sync` |
| 이력 | `/history/schedules/{id}`, `/history/projects/{id}` |
| 분석 | `/analysis/expected-value` |
| 알림 | `/notifications` |

전체 요청·응답 스키마는 실행 중인 `/docs`의 OpenAPI 문서를 기준으로 한다.
