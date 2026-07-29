# Lunel Data Model

## 관계 개요

```text
User ──< GroupMembership >── Group ──< Project
  │                                └──< Schedule
  ├──< ActivityNode >── ActivityEdge
  ├──< Problem ──< ProblemRevision
  │             ├──< ProblemTestGroup ──< ProblemTestCase
  │             └──< ProblemSolution
  └──< Participant >── Competition >── Event
                         │
                         ├──< CompetitionProblem >── Problem
                         ├──< Submission
                         └──< Scoreboard
```

## 코어

### `schedules`

프로젝트, 구간, 이벤트의 세 일정 유형과 시작·종료, 위치, 상태를 저장한다.
`importance_score`는 base, authority, urgency, feedback, dependency 구성 요소의 합으로
설명 가능하게 유지한다.

### `projects`, `activity_nodes`, `activity_edges`

프로젝트는 그룹이 소유한다. 노드는 담당자, 공개 시각, 기한, 완료 시각과 `version`을
갖는다. 에지는 계층, 의존, 차단, 참조 관계를 표현한다. 의존·차단 에지는 DAG를
유지해야 한다.

### `visibility_policies`

공개, 로그인 사용자, 그룹, 역할, 그룹+역할, 절차적 키 범위를 저장한다. 일정과
프로젝트, 문제에 재사용한다.

## 문제 제작소

### `problems`

대회와 독립된 문제 원본이다. slug, 명세, 입출력 형식, 제약, 제한, checker,
scoring mode, authoring status, version을 가진다.

### `problem_revisions`

`(problem_id, version)`이 유일하다. 변경 전 공개·채점 설정을 JSON 스냅샷으로
보존한다.

### `problem_test_groups`, `problem_test_cases`

부분 점수와 그룹 의존성을 표현한다. 테스트 케이스의 입력과 기대 출력은 운영자
응답에서만 직렬화한다.

### `problem_solutions`

기준 풀이, 언어, 기대 복잡도, 작성자를 저장한다. 참가자에게 노출하지 않는다.

## 대회 런타임

### `competitions`

행사에 1:1로 연결된 런타임이다. 참가 제한, IOI/ICPC 규칙, 시작·종료, 동결 시각,
스코어보드 공개 여부를 저장한다.

### `competition_problems`

문제 원본을 행사에 연결하는 릴리스다. 같은 문제는 한 대회에 한 번만 연결되며,
라벨도 대회 안에서 유일하다. 점수·제목·공개 시각·마감 시각·워크플로 노드를
행사별로 설정한다.

### `participants`, `submissions`

참가자는 대회와 사용자를 연결한다. 제출은 릴리스, 언어, 소스/답안, verdict, 점수,
패널티, 실행 시간·메모리, 판정 상세를 저장한다.

### `scoreboards`

실시간 계산 결과를 JSON 스냅샷으로 보존한다. 평상시 조회는 제출로부터 즉시 계산한
투영을 사용하고, 공식 발표나 감사가 필요한 순간만 스냅샷을 만든다.

## 시간 이력

`schedule_history`, `project_history`는 변경 주체, 변경 종류, 이전/새 값을 저장한다.
이를 이용해 특정 시점의 상태를 복원한다.

## 주요 불변 조건

- 활동 의존 그래프에는 순환이 없어야 한다.
- 문제 slug는 전역 유일하다.
- 문제 버전 스냅샷은 버전당 하나다.
- 대회 안의 문제와 라벨은 각각 유일하다.
- 학생 제출은 해당 대회 참가자와 공개된 릴리스에만 연결된다.
- 공개 투영은 동결 이후 제출과 문제 제작 비밀을 포함하지 않는다.
