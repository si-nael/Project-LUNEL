from pathlib import Path

from fastapi.testclient import TestClient

from lunel_engine.app import create_app


TOKEN = "test-token"
HEADERS = {"X-Lunel-Token": TOKEN}


def make_client(tmp_path: Path) -> TestClient:
    app = create_app(database_path=str(tmp_path / "engine.db"), token=TOKEN)
    return TestClient(app)


def create_problem(
    client: TestClient,
    *,
    slug: str = "sum",
    title: str = "Sum",
    kind: str = "ANSWER",
    answer: str | None = "42",
) -> dict:
    response = client.post(
        "/v1/problems",
        headers=HEADERS,
        json={
            "slug": slug,
            "title": title,
            "statement": "Return the answer.",
            "kind": kind,
            "checker": "TOKENS",
            "default_points": 100,
            "expected_answer": answer,
            "status": "READY",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_runtime(client: TestClient, problem: dict, *, mode: str = "IOI") -> dict:
    response = client.post(
        "/v1/runtimes",
        headers=HEADERS,
        json={
            "title": "Spring Invitational",
            "mode": mode,
            "problems": [
                {"problem_id": problem["id"], "label": "A", "points": 100}
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def command(client: TestClient, runtime_id: str, value: str) -> dict:
    response = client.post(
        f"/v1/runtimes/{runtime_id}/commands",
        headers=HEADERS,
        json={"command": value},
    )
    assert response.status_code == 200, response.text
    return response.json()


def register(client: TestClient, runtime_id: str, name: str) -> dict:
    response = client.post(
        f"/v1/runtimes/{runtime_id}/participants",
        headers=HEADERS,
        json={"name": name},
    )
    assert response.status_code == 201, response.text
    return response.json()


def submit(
    client: TestClient,
    runtime: dict,
    participant: dict,
    *,
    answer: str | None = None,
    source_code: str | None = None,
) -> dict:
    response = client.post(
        f"/v1/runtimes/{runtime['id']}/submissions",
        headers=HEADERS,
        json={
            "participant_id": participant["id"],
            "runtime_problem_id": runtime["problems"][0]["id"],
            "answer": answer,
            "source_code": source_code,
            "language": "python" if source_code else None,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_engine_requires_token_and_exposes_health(tmp_path: Path):
    client = make_client(tmp_path)
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/v1/problems").status_code == 401
    assert client.get("/v1/problems", headers=HEADERS).json() == []


def test_complete_runtime_and_frozen_scoreboard(tmp_path: Path):
    client = make_client(tmp_path)
    problem = create_problem(client)
    runtime = create_runtime(client, problem)

    command(client, runtime["id"], "OPEN_REGISTRATION")
    first = register(client, runtime["id"], "Ada")
    second = register(client, runtime["id"], "Grace")
    runtime = command(client, runtime["id"], "START")

    assert submit(client, runtime, first, answer="41")["verdict"] == "WRONG_ANSWER"
    assert submit(client, runtime, first, answer="42")["verdict"] == "ACCEPTED"
    assert submit(client, runtime, second, answer="42")["verdict"] == "ACCEPTED"

    public = client.get(
        f"/v1/runtimes/{runtime['id']}/scoreboard", headers=HEADERS
    ).json()
    assert [row["name"] for row in public["rankings"]] == ["Ada", "Grace"]
    assert public["rankings"][0]["score"] == 100

    runtime = command(client, runtime["id"], "FREEZE")
    submit(client, runtime, second, answer="42")
    frozen_public = client.get(
        f"/v1/runtimes/{runtime['id']}/scoreboard", headers=HEADERS
    ).json()
    operator = client.get(
        f"/v1/runtimes/{runtime['id']}/scoreboard?include_frozen=true",
        headers=HEADERS,
    ).json()
    assert frozen_public["frozen"] is True
    assert frozen_public["rankings"][1]["frozen_submissions"] == 1
    assert operator["rankings"][1]["problems"]["A"]["attempts"] == 2


def test_external_judge_queue_can_be_resolved(tmp_path: Path):
    client = make_client(tmp_path)
    problem = create_problem(
        client,
        slug="code-run",
        title="Code run",
        kind="CODE",
        answer=None,
    )
    runtime = create_runtime(client, problem, mode="ICPC")
    command(client, runtime["id"], "OPEN_REGISTRATION")
    participant = register(client, runtime["id"], "Linus")
    runtime = command(client, runtime["id"], "START")

    queued = submit(client, runtime, participant, source_code="print(42)")
    assert queued["verdict"] == "QUEUED"

    response = client.patch(
        f"/v1/runtimes/{runtime['id']}/submissions/{queued['id']}",
        headers=HEADERS,
        json={"verdict": "ACCEPTED", "score": 100, "penalty": 0},
    )
    assert response.status_code == 200, response.text
    scoreboard = client.get(
        f"/v1/runtimes/{runtime['id']}/scoreboard", headers=HEADERS
    ).json()
    assert scoreboard["rankings"][0]["solved"] == 1
