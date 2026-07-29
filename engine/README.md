# LUNEL Engine

LUNEL Engine은 로컬에서 독립 실행되는 대회 상태 기계입니다. 웹은 이 엔진의 클라이언트이며 엔진 상태를 직접 복제하거나 소유하지 않습니다.

```powershell
.\start-engine.ps1
```

기본 주소는 `http://127.0.0.1:8100`, 기본 데이터베이스는 `engine/data/lunel-engine.db`입니다. 모든 운영 API는 `X-Lunel-Token` 헤더를 요구합니다.

주요 API:

- `GET /health`
- `GET/POST/PATCH /v1/problems`
- `GET/POST /v1/runtimes`
- `POST /v1/runtimes/{id}/commands`
- `GET/POST /v1/runtimes/{id}/participants`
- `GET/POST/PATCH /v1/runtimes/{id}/submissions`
- `GET /v1/runtimes/{id}/scoreboard`
