from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    BigInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(30),
        unique=True,
        nullable=True,
        index=True,
    )

    # Securely hashed password.
    # We will NEVER store the actual password.
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # Google account identifier.
    # This will be used when we add Google Sign-In.
    google_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="employee",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        unique=True,
    )

    client_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="GST",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )


class PrintingOrder(Base):
    __tablename__ = "printing_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    employee: Mapped["User"] = relationship(
        "User",
        foreign_keys=[employee_id],
    )

    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
        index=True,
    )

    company: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    paper: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    quantity: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    vendor: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Pending",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    @property
    def employee_name(self) -> str:
        return self.employee.name if self.employee else "Unknown"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Employee responsible for the task
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Employee relationship
    employee: Mapped["User"] = relationship(
        "User",
        foreign_keys=[employee_id],
    )

    # Client associated with the task
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id"),
        nullable=True,
        index=True,
    )

    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
        index=True,
    )

    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="Medium",
    )

    revision: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Pending",
    )

    # Existing Excel workflow fields
    design: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    printing: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    quantity: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    vendor: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    remark: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Who created/assigned the task
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    assignment_source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="self",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    @property
    def employee_name(self) -> str:
        return self.employee.name if self.employee else "Unknown"

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    receiver_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True,
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    sender_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    notification_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True,
    )


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    original_filename: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    storage_path: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
    )

    mime_type: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    uploaded_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id"),
        nullable=True,
        index=True,
    )

    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

class File(Base):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    stored_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
    )

    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    folder_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    folder_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    uploaded_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    is_complete: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

class FileUpload(Base):
    __tablename__ = "file_uploads"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    upload_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    total_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    folder_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    folder_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    uploaded_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    uploaded_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    is_complete: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

class FileShare(Base):
    __tablename__ = "file_shares"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id"),
        nullable=False,
        index=True,
    )

    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    shared_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

class FileUploadRecipient(Base):
    __tablename__ = "file_upload_recipients"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    upload_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )