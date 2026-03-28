"""Tests for importance calculation service."""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.importance import calculate_urgency_weight


class TestUrgencyWeight:
    def test_no_deadline(self):
        assert calculate_urgency_weight(None) == 0

    def test_past_deadline(self):
        past = datetime.now(timezone.utc) - timedelta(days=1)
        assert calculate_urgency_weight(past) == 0

    def test_very_close_deadline(self):
        # less than 1 day -> should be close to 20
        soon = datetime.now(timezone.utc) + timedelta(hours=2)
        weight = calculate_urgency_weight(soon)
        assert 18 <= weight <= 20

    def test_far_deadline(self):
        # 15 days out -> 20 - 30 = -10 -> clamped to 0
        far = datetime.now(timezone.utc) + timedelta(days=15)
        assert calculate_urgency_weight(far) == 0

    def test_medium_deadline(self):
        # 5 days -> 20 - 10 = 10
        med = datetime.now(timezone.utc) + timedelta(days=5)
        weight = calculate_urgency_weight(med)
        assert 9 <= weight <= 11  # allow small float rounding

    def test_exactly_10_days(self):
        # 10 days -> 20 - 20 = 0
        ten = datetime.now(timezone.utc) + timedelta(days=10)
        assert calculate_urgency_weight(ten) == 0

    def test_3_days(self):
        # 3 days -> 20 - 6 = 14
        three = datetime.now(timezone.utc) + timedelta(days=3)
        weight = calculate_urgency_weight(three)
        assert 13 <= weight <= 15
