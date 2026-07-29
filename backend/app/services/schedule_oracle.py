"""Read-model oracle for schedule conflicts and non-destructive proposals.

The oracle does not silently rewrite anyone's calendar. It projects the
authoritative schedule state, explains every conflict, and returns a proposal
that an operator may accept through the regular schedule API.
"""

from datetime import datetime, timedelta, timezone
from heapq import heappop, heappush

from app.models.schedule import Schedule
from app.timeutils import as_utc


def _end(schedule: Schedule) -> datetime:
    start = as_utc(schedule.start_at)
    return as_utc(schedule.end_at) or (start + timedelta(minutes=30))


def _priority_explanation(schedule: Schedule) -> dict:
    return {
        "total": schedule.importance_score,
        "base": schedule.base_importance,
        "authority": schedule.authority_weight,
        "urgency": schedule.urgency_weight,
        "feedback": schedule.feedback_weight,
        "dependency": schedule.dependency_weight,
    }


def _severity(left: Schedule, right: Schedule) -> str:
    same_location = bool(left.location and left.location == right.location)
    official_pair = left.authority_weight >= 10 and right.authority_weight >= 10
    if same_location or official_pair:
        return "HARD"
    if abs(left.importance_score - right.importance_score) <= 10:
        return "HIGH"
    return "MEDIUM"


def build_schedule_oracle(
    schedules: list[Schedule],
    *,
    window_start: datetime,
    window_end: datetime,
) -> dict:
    ordered = sorted(
        schedules,
        key=lambda item: (
            as_utc(item.start_at),
            -item.importance_score,
            str(item.id),
        ),
    )
    active: list[tuple[datetime, str, Schedule]] = []
    conflicts: list[dict] = []
    proposals: list[dict] = []

    for current in ordered:
        current_start = as_utc(current.start_at)
        while active and active[0][0] <= current_start:
            heappop(active)

        for other_end, _, other in active:
            overlap_start = max(as_utc(other.start_at), current_start)
            overlap_end = min(other_end, _end(current))
            if overlap_start >= overlap_end:
                continue

            preferred, movable = (
                (other, current)
                if other.importance_score >= current.importance_score
                else (current, other)
            )
            movable_start = as_utc(movable.start_at)
            duration = _end(movable) - movable_start
            proposed_start = _end(preferred)
            proposed_end = proposed_start + duration
            conflict_id = f"{other.id}:{current.id}"

            conflicts.append(
                {
                    "id": conflict_id,
                    "severity": _severity(other, current),
                    "overlap_minutes": int(
                        (overlap_end - overlap_start).total_seconds() // 60
                    ),
                    "schedule_ids": [str(other.id), str(current.id)],
                    "reason": (
                        "동일 장소 또는 공식 일정 충돌"
                        if _severity(other, current) == "HARD"
                        else "동일 시간대에 참여 가능한 일정이 겹침"
                    ),
                    "priority": {
                        str(other.id): _priority_explanation(other),
                        str(current.id): _priority_explanation(current),
                    },
                }
            )
            proposals.append(
                {
                    "conflict_id": conflict_id,
                    "action": "MOVE",
                    "schedule_id": str(movable.id),
                    "proposed_start_at": proposed_start.isoformat(),
                    "proposed_end_at": proposed_end.isoformat(),
                    "keeps_schedule_id": str(preferred.id),
                    "explanation": (
                        f"중요도 {preferred.importance_score}인 "
                        f"'{preferred.title}'을 유지하고 중요도 "
                        f"{movable.importance_score}인 '{movable.title}'을 뒤로 이동"
                    ),
                    "requires_approval": True,
                }
            )

        heappush(active, (_end(current), str(current.id), current))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window": {
            "start_at": as_utc(window_start).isoformat(),
            "end_at": as_utc(window_end).isoformat(),
        },
        "summary": {
            "schedule_count": len(ordered),
            "conflict_count": len(conflicts),
            "hard_conflict_count": sum(
                conflict["severity"] == "HARD" for conflict in conflicts
            ),
            "proposal_count": len(proposals),
        },
        "schedules": [
            {
                "id": str(schedule.id),
                "title": schedule.title,
                "start_at": as_utc(schedule.start_at).isoformat(),
                "end_at": _end(schedule).isoformat(),
                "type": schedule.type.value,
                "subtype": schedule.subtype.value,
                "status": schedule.status.value,
                "location": schedule.location,
                "priority": _priority_explanation(schedule),
            }
            for schedule in ordered
        ],
        "conflicts": conflicts,
        "proposals": proposals,
    }
