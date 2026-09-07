from database import SessionLocal
from models import User
from security import hash_password
from datetime import datetime

users = [
    {
        "name": "Office Admin",
        "email": "admin@officesystem.local",
        "password": "Admin@123",
        "role": "admin",
    },
    {
        "name": "Employee 1",
        "email": "employee1@officesystem.local",
        "password": "Employee@123",
        "role": "employee",
    },
    {
        "name": "Employee 2",
        "email": "employee2@officesystem.local",
        "password": "Employee@123",
        "role": "employee",
    },
    {
        "name": "Employee 3",
        "email": "employee3@officesystem.local",
        "password": "Employee@123",
        "role": "employee",
    },
    {
        "name": "Employee 4",
        "email": "employee4@officesystem.local",
        "password": "Employee@123",
        "role": "employee",
    },
]

db = SessionLocal()

try:
    for data in users:
        existing = (
            db.query(User)
            .filter(User.email == data["email"])
            .first()
        )

        if existing:
            print(f"Already exists: {data['email']}")
            continue

        user = User(
            name=data["name"],
            email=data["email"],
            password_hash=hash_password(data["password"]),
            role=data["role"],
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(user)

    db.commit()

    print("\nTest accounts created successfully.\n")

    for data in users:
        print(
            f"{data['role'].upper():8} | "
            f"{data['email']} | "
            f"{data['password']}"
        )

finally:
    db.close()