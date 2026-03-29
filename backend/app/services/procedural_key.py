"""Procedural key & challenge service.

Challenge-response authentication engine.
Generates dynamic challenges tied to VisibilityPolicy PROCEDURAL_KEY scope.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Challenge
from app.models.enums import ChallengeStatus
from app.models.visibility import VisibilityPolicy


def _hash_answer(answer: str) -> str:
    return hashlib.sha256(answer.strip().lower().encode()).hexdigest()


def _generate_math_challenge() -> tuple[dict, str]:
    """Generate a simple math challenge."""
    import random
    a = random.randint(10, 99)
    b = random.randint(10, 99)
    op = random.choice(["+", "-", "*"])
    if op == "+":
        answer = a + b
    elif op == "-":
        answer = a - b
    else:
        answer = a * b
    return {"question": f"{a} {op} {b} = ?", "type": "math"}, str(answer)


def _generate_text_challenge(rule_json: dict | None) -> tuple[dict, str]:
    """Generate a text-based challenge from rule_expression_json."""
    if rule_json and "question" in rule_json and "answer" in rule_json:
        return (
            {"question": rule_json["question"], "type": "text"},
            rule_json["answer"],
        )
    # Fallback passphrase challenge
    passphrase = secrets.token_urlsafe(8)
    return (
        {"question": f"다음 코드를 입력하세요: {passphrase}", "type": "passphrase"},
        passphrase,
    )


async def create_challenge(
    db: AsyncSession,
    policy_id: UUID,
    user_id: UUID,
    challenge_type: str = "auto",
    max_attempts: int = 3,
    ttl_minutes: int = 30,
) -> Challenge:
    """Generate and persist a new challenge for a user to gain access."""
    policy = await db.get(VisibilityPolicy, policy_id)

    if challenge_type == "math" or (
        challenge_type == "auto" and not (policy and policy.rule_expression_json)
    ):
        data, answer = _generate_math_challenge()
    else:
        data, answer = _generate_text_challenge(
            policy.rule_expression_json if policy else None
        )

    challenge = Challenge(
        visibility_policy_id=policy_id,
        user_id=user_id,
        challenge_type=data["type"],
        challenge_data=data,
        expected_answer_hash=_hash_answer(answer),
        max_attempts=max_attempts,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
    )
    db.add(challenge)
    await db.flush()
    await db.refresh(challenge)
    return challenge


async def verify_challenge(
    db: AsyncSession, challenge_id: UUID, answer: str
) -> tuple[bool, str]:
    """Verify a challenge response. Returns (success, message)."""
    challenge = await db.get(Challenge, challenge_id)
    if challenge is None:
        return False, "챌린지를 찾을 수 없습니다."

    if challenge.status != ChallengeStatus.PENDING:
        return False, f"챌린지 상태: {challenge.status.value}"

    if challenge.expires_at:
        expires = challenge.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            challenge.status = ChallengeStatus.EXPIRED
            await db.flush()
            return False, "챌린지가 만료되었습니다."

    challenge.attempts += 1

    if _hash_answer(answer) == challenge.expected_answer_hash:
        challenge.status = ChallengeStatus.VERIFIED
        await db.flush()
        return True, "인증 성공"

    if challenge.attempts >= challenge.max_attempts:
        challenge.status = ChallengeStatus.FAILED
        await db.flush()
        return False, "최대 시도 횟수를 초과했습니다."

    await db.flush()
    remaining = challenge.max_attempts - challenge.attempts
    return False, f"오답입니다. 남은 시도: {remaining}회"


async def has_verified_challenge(
    db: AsyncSession, policy_id: UUID, user_id: UUID
) -> bool:
    """Check if a user has a verified challenge for the given policy."""
    result = await db.execute(
        select(Challenge).where(
            Challenge.visibility_policy_id == policy_id,
            Challenge.user_id == user_id,
            Challenge.status == ChallengeStatus.VERIFIED,
        )
    )
    return result.scalar_one_or_none() is not None
