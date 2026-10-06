import uuid

from fastapi.testclient import TestClient

from database import SessionLocal
from main import app
from models import PrintingOrder, User
from security import hash_password


def test_printing_order_can_be_created_and_read_by_employee():
    email = f"printing_{uuid.uuid4().hex[:8]}@example.com"
    password = "Password123"

    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            db.delete(existing)
            db.commit()

        user = User(
            name="Printing User",
            email=email,
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

        response = client.post(
            "/printing",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "date": "2026-09-02",
                "company": "Print House Ltd",
                "description": "Business cards",
                "paper": "Glossy 300gsm",
                "quantity": 250,
                "vendor": "Mohan Print",
                "status": "Pending",
            },
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["company"] == "Print House Ltd"
        assert payload["description"] == "Business cards"
        assert payload["employee_id"] > 0

        list_response = client.get(
            "/printing",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert list_response.status_code == 200, list_response.text
        items = list_response.json()
        assert any(item["company"] == "Print House Ltd" for item in items)

        print("printing order verification passed")
    finally:
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.query(PrintingOrder).filter(
                    PrintingOrder.employee_id == user.id
                ).delete(synchronize_session=False)
                db.delete(user)
                db.commit()
