from database import SessionLocal
from models import User
from security import hash_password, validate_password


db = SessionLocal()

try:
    name = input("Admin name: ").strip()
    email = input("Admin email: ").strip()
    phone = input("Admin phone number (optional): ").strip() or None
    password = input("Admin password: ")

    is_valid, error_message = validate_password(password)

    if not is_valid:
        print(f"Error: {error_message}")
        raise SystemExit(1)

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        print("An account with this email already exists.")
        raise SystemExit(1)

    if phone:
        existing_phone = (
            db.query(User)
            .filter(User.phone_number == phone)
            .first()
        )

        if existing_phone:
            print("An account with this phone number already exists.")
            raise SystemExit(1)

    admin = User(
        name=name,
        email=email,
        phone_number=phone,
        password_hash=hash_password(password),
        role="admin",
        is_active=True,
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    print()
    print("Admin account created successfully.")
    print(f"ID: {admin.id}")
    print(f"Name: {admin.name}")
    print(f"Email: {admin.email}")
    print(f"Role: {admin.role}")

finally:
    db.close()