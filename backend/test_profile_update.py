import uuid

from fastapi.testclient import TestClient

from database import SessionLocal
from main import app
from models import User
from security import hash_password


def test_profile_update_persists_to_database():
    email = f"profile_update_{uuid.uuid4().hex[:8]}@example.com"
    original_phone = f"{uuid.uuid4().int % 9000000000 + 1000000000}"
    updated_phone = f"{uuid.uuid4().int % 9000000000 + 1000000000}"
    password = "Password123"

    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            db.delete(existing)
            db.commit()

        user = User(
            name="Initial Name",
            email=email,
            phone_number=original_phone,
            password_hash=hash_password(password),
            role="employee",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    try:
        client = TestClient(app)
        login = client.post("/login", json={"email": email, "password": password})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]

        response = client.patch(
            "/me",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Updated Name",
                "phone_number": updated_phone,
                "password": "NewPass123",
            },
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["name"] == "Updated Name"
        assert payload["phone_number"] == updated_phone

        with SessionLocal() as db:
            saved = db.query(User).filter(User.email == email).first()
            assert saved is not None
            assert saved.name == "Updated Name"
            assert saved.phone_number == updated_phone

        print("profile update verification passed")
    finally:
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.delete(user)
                db.commit()
