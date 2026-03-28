"""Tests for auth security utilities (hashing, JWT)."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.enums import UserRole


class TestPasswordHashing:
    def test_hash_and_verify(self):
        raw = "mysecretpassword"
        hashed = hash_password(raw)
        assert hashed != raw
        assert verify_password(raw, hashed) is True

    def test_wrong_password(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_hash_is_unique(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt uses random salt


class TestJWT:
    def test_access_token_roundtrip(self):
        uid = uuid4()
        token = create_access_token(uid, UserRole.STUDENT.value)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == str(uid)
        assert payload["role"] == "STUDENT"
        assert payload["type"] == "access"

    def test_refresh_token_roundtrip(self):
        uid = uuid4()
        token = create_refresh_token(uid)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == str(uid)
        assert payload["type"] == "refresh"

    def test_invalid_token_returns_none(self):
        assert decode_token("invalid.token.here") is None

    def test_access_and_refresh_are_different(self):
        uid = uuid4()
        access = create_access_token(uid, "STUDENT")
        refresh = create_refresh_token(uid)
        assert access != refresh
