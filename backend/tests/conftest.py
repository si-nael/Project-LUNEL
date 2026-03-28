"""
Shared fixtures for Lunel backend tests.
Uses SQLite in-memory for fast unit tests without PostgreSQL.
"""
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.enums import UserRole, GroupType, MembershipRole
from app.models.user import User
from app.models.group import Group, GroupMembership
from app.auth.security import hash_password, create_access_token


# Use aiosqlite for in-memory testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash=hash_password("testpassword123"),
        name="Test User",
        role=UserRole.STUDENT,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        password_hash=hash_password("adminpassword123"),
        name="Admin User",
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def teacher_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="teacher@example.com",
        password_hash=hash_password("teacherpass123"),
        name="Teacher User",
        role=UserRole.TEACHER,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_group(db_session: AsyncSession, test_user: User) -> Group:
    group = Group(
        id=uuid.uuid4(),
        name="Test Group",
        type=GroupType.CLUB,
        owner_user_id=test_user.id,
    )
    db_session.add(group)
    await db_session.flush()

    membership = GroupMembership(
        id=uuid.uuid4(),
        user_id=test_user.id,
        group_id=group.id,
        membership_role=MembershipRole.OWNER,
    )
    db_session.add(membership)
    await db_session.flush()
    await db_session.refresh(group)
    return group


def auth_header(user: User) -> dict:
    token = create_access_token(user.id, user.role.value)
    return {"Authorization": f"Bearer {token}"}
