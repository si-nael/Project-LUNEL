# Project LUNEL

LUNEL은 웹 애플리케이션 자체가 아니라, 로컬에서 독립적으로 실행되는 대회 운영 엔진과 그 엔진을 조작하는 웹 콘솔의 조합입니다.

```text
LUNEL Web (control console)
    │  local HTTP API
    ▼
LUNEL Engine (authoritative local daemon)
    └─ SQLite state store
```

## LUNEL Engine

`engine/`은 기존 학교 일정 서버와 분리된 독립 프로세스입니다. 다음 상태를 직접 소유합니다.

- 재사용 가능한 문제 원본과 READY 상태
- 대회 런타임 및 명령 기반 상태 전이
- 참가자, 제출, 자동 정답 비교와 외부 채점 큐
- IOI/ICPC 스코어보드와 동결 시점
- 로컬 SQLite 데이터베이스

대회 상태는 `DRAFT → REGISTRATION → RUNNING → FROZEN/FINISHED` 순서로 엔진 명령을 통해서만 바뀝니다. CODE 문제는 임의 코드를 웹 서버에서 실행하지 않고 `QUEUED` 상태로 외부 샌드박스 또는 운영자 판정을 기다립니다.

## LUNEL Web

`frontend/`은 엔진의 제어 콘솔입니다. 비밀 엔진 토큰은 브라우저에 노출하지 않고 Next.js 서버 프록시가 `127.0.0.1:8100`의 엔진에 전달합니다.

화면은 세 개입니다.

- 엔진: 연결 상태와 런타임 현황
- 대회: 대회 생성, 개시, 참가자·제출·채점·스코어보드 관리
- 문제: 문제 원본 작성, 채점 방식과 READY 상태 관리

## 실행

엔진과 웹을 별도 터미널에서 실행:

```powershell
.\start-engine.ps1
.\start-web.ps1
```

둘을 함께 실행:

```powershell
.\start-lunel.ps1
```

- 웹 콘솔: `http://127.0.0.1:3000`
- 엔진 API: `http://127.0.0.1:8100`
- 엔진 문서: `http://127.0.0.1:8100/docs`
- 데이터: `engine/data/lunel-engine.db`

첫 실행에는 엔진용 `.venv`와 웹 의존성이 설치될 수 있습니다.

## 검증

```powershell
$env:PYTHONPATH="engine"
python -m pytest engine\tests -q

cd frontend
npm run build
```

엔진 테스트는 인증, 문제/대회 생성, 참가 등록, 제출·자동 채점, 동결 스코어보드, 외부 채점 큐 판정까지 검증합니다.
