from collections import defaultdict
from datetime import datetime, timezone


TRANSITIONS = {
    "DRAFT": {
        "OPEN_REGISTRATION": "REGISTRATION",
        "CANCEL": "CANCELLED",
    },
    "REGISTRATION": {
        "START": "RUNNING",
        "CANCEL": "CANCELLED",
        "RESET": "DRAFT",
    },
    "RUNNING": {
        "FREEZE": "FROZEN",
        "FINISH": "FINISHED",
        "CANCEL": "CANCELLED",
    },
    "FROZEN": {
        "UNFREEZE": "RUNNING",
        "FINISH": "FINISHED",
        "CANCEL": "CANCELLED",
    },
    "FINISHED": {"RESET": "DRAFT"},
    "CANCELLED": {"RESET": "DRAFT"},
}


def transition_state(current: str, command: str) -> str:
    target = TRANSITIONS.get(current, {}).get(command)
    if target is None:
        raise ValueError(f"Command {command} is not valid while runtime is {current}.")
    return target


def compare_answer(actual: str, expected: str, checker: str) -> tuple[bool, str]:
    if checker == "EXACT":
        accepted = actual.replace("\r\n", "\n").rstrip("\n") == expected.replace(
            "\r\n", "\n"
        ).rstrip("\n")
        return accepted, "exact match" if accepted else "output differs"
    if checker == "TOKENS":
        accepted = actual.split() == expected.split()
        return accepted, "token match" if accepted else "tokens differ"
    if checker == "FLOAT":
        try:
            actual_values = [float(value) for value in actual.split()]
            expected_values = [float(value) for value in expected.split()]
        except ValueError:
            return False, "non-numeric token"
        accepted = len(actual_values) == len(expected_values) and all(
            abs(left - right) <= 1e-6 * max(1.0, abs(right))
            for left, right in zip(actual_values, expected_values)
        )
        return accepted, "within tolerance" if accepted else "outside tolerance"
    return False, "unknown checker"


def build_scoreboard(
    runtime: dict,
    problems: list[dict],
    participants: list[dict],
    submissions: list[dict],
    *,
    include_frozen: bool,
) -> dict:
    freeze_at = runtime.get("freeze_at")
    visible: list[dict] = []
    hidden_counts: dict[str, int] = defaultdict(int)
    for submission in submissions:
        if (
            freeze_at
            and not include_frozen
            and submission["submitted_at"] > freeze_at
        ):
            hidden_counts[submission["participant_id"]] += 1
        else:
            visible.append(submission)

    by_participant_problem: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for submission in visible:
        by_participant_problem[
            (submission["participant_id"], submission["runtime_problem_id"])
        ].append(submission)

    rows: list[dict] = []
    mode = runtime["mode"]
    started_at = runtime.get("started_at") or runtime["created_at"]
    started = datetime.fromisoformat(started_at)
    for participant in participants:
        total_score = 0.0
        solved = 0
        total_penalty = 0
        per_problem: dict[str, dict] = {}
        last_improvement: str | None = None

        for problem in problems:
            attempts = by_participant_problem.get(
                (participant["id"], problem["id"]), []
            )
            accepted_index = next(
                (
                    index
                    for index, submission in enumerate(attempts)
                    if submission["verdict"] == "ACCEPTED"
                ),
                None,
            )
            if mode == "ICPC":
                if accepted_index is not None:
                    accepted = attempts[accepted_index]
                    submitted = datetime.fromisoformat(accepted["submitted_at"])
                    elapsed = max(0, int((submitted - started).total_seconds() // 60))
                    wrong = sum(
                        attempt["verdict"]
                        not in ("QUEUED", "RUNNING", "COMPILE_ERROR")
                        for attempt in attempts[:accepted_index]
                    )
                    penalty = elapsed + wrong * runtime["wrong_penalty_minutes"]
                    solved += 1
                    total_penalty += penalty
                    candidates = [
                        value
                        for value in (last_improvement, accepted["submitted_at"])
                        if value
                    ]
                    last_improvement = max(candidates)
                    per_problem[problem["label"]] = {
                        "solved": True,
                        "attempts": accepted_index + 1,
                        "penalty": penalty,
                    }
                else:
                    per_problem[problem["label"]] = {
                        "solved": False,
                        "attempts": len(attempts),
                        "penalty": 0,
                    }
            else:
                best = max(attempts, key=lambda item: item["score"], default=None)
                score = float(best["score"]) if best else 0.0
                total_score += score
                if score >= float(problem["points"]):
                    solved += 1
                if best and score > 0:
                    candidates = [
                        value
                        for value in (last_improvement, best["submitted_at"])
                        if value
                    ]
                    last_improvement = max(candidates)
                per_problem[problem["label"]] = {
                    "solved": score >= float(problem["points"]),
                    "attempts": len(attempts),
                    "score": score,
                    "max_score": float(problem["points"]),
                    "verdict": best["verdict"] if best else None,
                }

        rows.append(
            {
                "participant_id": participant["id"],
                "name": participant["name"],
                "score": solved if mode == "ICPC" else total_score,
                "solved": solved,
                "penalty": total_penalty,
                "last_improvement_at": last_improvement,
                "problems": per_problem,
                "frozen_submissions": hidden_counts[participant["id"]],
            }
        )

    if mode == "ICPC":
        rows.sort(key=lambda row: (-row["solved"], row["penalty"], row["name"]))
    else:
        rows.sort(
            key=lambda row: (
                -row["score"],
                row["last_improvement_at"] or "9999",
                row["name"],
            )
        )
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank

    return {
        "runtime_id": runtime["id"],
        "title": runtime["title"],
        "mode": mode,
        "state": runtime["state"],
        "frozen": bool(freeze_at and not include_frozen),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "problems": [
            {
                "id": problem["id"],
                "label": problem["label"],
                "title": problem["title"],
                "points": problem["points"],
            }
            for problem in problems
        ],
        "rankings": rows,
    }
