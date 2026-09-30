import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from database import SessionLocal
from main import STORAGE_DIR, app
from models import File, FileShare, FileUpload, Notification, User
from security import hash_password


def test_file_upload_is_shared_with_multiple_recipients():
    suffix = uuid.uuid4().hex[:10]
    password = "Password123"
    sender = User(
        name="Transfer Sender",
        email=f"transfer_sender_{suffix}@example.com",
        password_hash=hash_password(password),
        role="employee",
        is_active=True,
    )
    recipients = [
        User(
            name=f"Transfer Recipient {index}",
            email=f"transfer_recipient_{index}_{suffix}@example.com",
            password_hash=hash_password(password),
            role="employee",
            is_active=True,
        )
        for index in (1, 2)
    ]

    with SessionLocal() as db:
        db.add_all([sender, *recipients])
        db.commit()
        db.refresh(sender)
        for recipient in recipients:
            db.refresh(recipient)

    client = TestClient(app)
    upload_id = None
    stored_file_id = None

    try:
        login = client.post(
            "/login",
            json={"email": sender.email, "password": password},
        )
        assert login.status_code == 200, login.text
        sender_headers = {
            "Authorization": f"Bearer {login.json()['access_token']}"
        }

        start = client.post(
            "/files/upload/start",
            headers=sender_headers,
            json={
                "filename": "shared.txt",
                "total_size": 14,
                "recipient_ids": [recipient.id for recipient in recipients],
            },
        )
        assert start.status_code == 200, start.text
        upload_id = start.json()["upload_id"]

        chunk = client.patch(
            f"/files/upload/{upload_id}/chunk",
            headers=sender_headers,
            params={"offset": 0},
            files={"chunk": ("chunk", b"shared content")},
        )
        assert chunk.status_code == 200, chunk.text

        complete = client.post(
            f"/files/upload/{upload_id}/complete",
            headers=sender_headers,
        )
        assert complete.status_code == 200, complete.text

        with SessionLocal() as db:
            stored_file = (
                db.query(File)
                .filter(File.stored_filename == f"{upload_id}.file")
                .first()
            )
            assert stored_file is not None
            stored_file_id = stored_file.id
            shared_recipient_ids = {
                recipient_id
                for (recipient_id,) in db.query(FileShare.recipient_id)
                .filter(FileShare.file_id == stored_file.id)
                .all()
            }
            notified_recipient_ids = {
                recipient_id
                for (recipient_id,) in db.query(Notification.recipient_id)
                .filter(
                    Notification.file_id == stored_file.id,
                    Notification.notification_type == "file_received",
                )
                .all()
            }

        expected_recipient_ids = {recipient.id for recipient in recipients}
        assert shared_recipient_ids == expected_recipient_ids
        assert notified_recipient_ids == expected_recipient_ids

    finally:
        with SessionLocal() as db:
            if stored_file_id is not None:
                stored_file = db.query(File).filter(File.id == stored_file_id).first()
                if stored_file:
                    Path(stored_file.storage_path).unlink(missing_ok=True)
                    db.query(Notification).filter(
                        Notification.file_id == stored_file_id
                    ).delete(synchronize_session=False)
                    db.query(FileShare).filter(
                        FileShare.file_id == stored_file_id
                    ).delete(synchronize_session=False)
                    db.delete(stored_file)
                    db.flush()

            if upload_id:
                db.query(FileUpload).filter(
                    FileUpload.upload_id == upload_id
                ).delete(synchronize_session=False)
                (STORAGE_DIR / f"{upload_id}.part").unlink(missing_ok=True)

            user_ids = [sender.id, *(recipient.id for recipient in recipients)]
            db.query(Notification).filter(
                Notification.sender_id.in_(user_ids)
                | Notification.recipient_id.in_(user_ids)
            ).delete(synchronize_session=False)
            db.query(FileShare).filter(
                FileShare.shared_by.in_(user_ids)
                | FileShare.recipient_id.in_(user_ids)
            ).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(user_ids)).delete(
                synchronize_session=False
            )
            db.commit()