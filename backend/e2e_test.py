"""
E2E Integration Test - Backend API against real PostgreSQL
Tests the full flow: register → login → create group → create schedule → rate → verify
"""
import asyncio
import uuid
import httpx

BASE = "http://localhost:8000/api/v1"


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=10) as c:
        run_id = uuid.uuid4().hex[:8]
        user_email = f"test_{run_id}@lunel.dev"
        rater_email = f"rater_{run_id}@lunel.dev"

        print("=" * 60)
        print("LUNEL E2E INTEGRATION TEST")
        print("=" * 60)

        # 1. Health check (root level, not under /api/v1)
        r = await c.get("http://localhost:8000/health")
        assert r.status_code == 200, f"Health check failed: {r.text}"
        print("[PASS] 1. Health check")

        # 2. Register user
        r = await c.post("/auth/register", json={
            "email": user_email,
            "password": "Test1234!",
            "name": "테스트유저",
            "role": "STUDENT",
        })
        assert r.status_code == 201, f"Register failed: {r.text}"
        user = r.json()
        assert user["email"] == user_email
        print(f"[PASS] 2. Register user: {user['name']} ({user['id'][:8]}...)")

        # 3. Login
        r = await c.post("/auth/login", json={
            "email": user_email,
            "password": "Test1234!",
        })
        assert r.status_code == 200, f"Login failed: {r.text}"
        tokens = r.json()
        assert "access_token" in tokens
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]
        headers = {"Authorization": f"Bearer {access}"}
        print("[PASS] 3. Login + JWT tokens received")

        # 4. Get current user
        r = await c.get("/users/me", headers=headers)
        assert r.status_code == 200, f"Get me failed: {r.text}"
        me = r.json()
        assert me["email"] == user_email
        user_id = me["id"]
        print(f"[PASS] 4. Get /users/me: {me['name']}")

        # 5. Refresh token
        r = await c.post("/auth/refresh", json={"refresh_token": refresh})
        assert r.status_code == 200, f"Refresh failed: {r.text}"
        new_tokens = r.json()
        access = new_tokens["access_token"]
        headers = {"Authorization": f"Bearer {access}"}
        print("[PASS] 5. Token refresh")

        # 6. Create group
        r = await c.post("/groups", headers=headers, json={
            "name": "테스트 프로젝트팀",
            "type": "PROJECT_TEAM",
        })
        assert r.status_code == 201, f"Create group failed: {r.text}"
        group = r.json()
        group_id = group["id"]
        print(f"[PASS] 6. Create group: {group['name']} ({group_id[:8]}...)")

        # 7. List groups
        r = await c.get("/groups", headers=headers)
        assert r.status_code == 200
        groups = r.json()
        assert len(groups) >= 1
        print(f"[PASS] 7. List groups: {len(groups)} found")

        # 8. Create schedule
        r = await c.post("/schedules", headers=headers, json={
            "title": "E2E 테스트 일정",
            "type": "PROJECT",
            "subtype": "TEAM_PROJECT",
            "start_at": "2026-04-01T09:00:00+09:00",
            "end_at": "2026-04-15T18:00:00+09:00",
            "base_importance": 70,
        })
        assert r.status_code == 201, f"Create schedule failed: {r.text}"
        schedule = r.json()
        schedule_id = schedule["id"]
        print(f"[PASS] 8. Create schedule: {schedule['title']} (importance={schedule['importance_score']})")

        # 9. List schedules
        r = await c.get("/schedules", headers=headers)
        assert r.status_code == 200
        schedules = r.json()
        assert len(schedules) >= 1
        print(f"[PASS] 9. List schedules: {len(schedules)} found")

        # 10. Get schedule detail
        r = await c.get(f"/schedules/{schedule_id}", headers=headers)
        assert r.status_code == 200
        detail = r.json()
        assert detail["title"] == "E2E 테스트 일정"
        print(f"[PASS] 10. Get schedule detail: {detail['title']}")

        # 11. Register another user for rating
        r = await c.post("/auth/register", json={
            "email": rater_email,
            "password": "Rate1234!",
            "name": "평가자",
            "role": "TEACHER",
        })
        assert r.status_code == 201
        r = await c.post("/auth/login", json={
            "email": rater_email,
            "password": "Rate1234!",
        })
        rater_tokens = r.json()
        rater_headers = {"Authorization": f"Bearer {rater_tokens['access_token']}"}
        print("[PASS] 11. Register + login second user (rater)")

        # 12. Rate schedule
        r = await c.post(f"/schedules/{schedule_id}/ratings", headers=rater_headers, json={
            "score": 4,
            "usefulness_score": 5,
            "importance_feedback": 3,
            "comment": "E2E 테스트 평가입니다",
        })
        assert r.status_code == 201, f"Create rating failed: {r.text}"
        rating = r.json()
        print(f"[PASS] 12. Create rating: score={rating['score']}")

        # 13. Get rating summary
        r = await c.get(f"/schedules/{schedule_id}/ratings-summary", headers=headers)
        assert r.status_code == 200, f"Rating summary failed: {r.text}"
        summary = r.json()
        assert summary["total_ratings"] == 1
        assert summary["avg_score"] == 4.0
        print(f"[PASS] 13. Rating summary: avg={summary['avg_score']}, count={summary['total_ratings']}")

        # 14. Create project
        r = await c.post("/projects", headers=headers, json={
            "title": "E2E 테스트 프로젝트",
            "description": "통합 테스트용 프로젝트",
            "owner_group_id": group_id,
        })
        assert r.status_code == 201, f"Create project failed: {r.text}"
        project = r.json()
        print(f"[PASS] 14. Create project: {project['title']}")

        # 15. List projects
        r = await c.get("/projects", headers=headers)
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 1
        print(f"[PASS] 15. List projects: {len(projects)} found")

        # 16. Create visibility policy
        r = await c.post("/visibility-policies", headers=headers, json={
            "scope_type": "GROUP_ONLY",
            "allow_group_ids": [group_id],
        })
        assert r.status_code == 201, f"Create visibility policy failed: {r.text}"
        policy = r.json()
        print(f"[PASS] 16. Create visibility policy: {policy['scope_type']}")

        print()
        print("=" * 60)
        print("ALL 16 E2E TESTS PASSED!")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
