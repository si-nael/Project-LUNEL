from datetime import datetime, timezone


def as_utc(value: datetime | None) -> datetime | None:
    """Normalize PostgreSQL/SQLite datetimes to aware UTC values."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
