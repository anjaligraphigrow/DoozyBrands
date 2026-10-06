import hashlib
import io
import os
import uuid
import zipfile
import jwt
from xml.sax.saxutils import escape
from pathlib import Path
from sqlalchemy.orm import Session, aliased
from sqlalchemy import extract, text
from datetime import date

from websocket_manager import manager
from database import Base, SessionLocal, engine
from models import (
    Client,
    Document,
    File,
    FileShare,
    FileUpload,
    FileUploadRecipient,
    Message,
    Notification,
    PrintingOrder,
    Task,
    User,
)
from schemas import (
    ClientCreate,
    ClientResponse,
    ClientListItem,
    EmployeeListItem,
    FileChunkResponse,
    FileRecipient,
    FileResponse,
    FileUploadCompleteResponse,
    FileUploadStart,
    FileUploadStartResponse,
    AdminFileTransferResponse,
    AdminFileTransferHistoryResponse,
    MessageCreate,
    MessageDeleteRequest,
    MessageResponse,
    MonthlyReportResponse,
    NotificationResponse,
    PrintingOrderCreate,
    PrintingOrderResponse,
    PrintingOrderUpdate,
    TaskCreate,
    TaskListItem,
    TaskResponse,
    TaskUpdate,
    UserLogin,
    UserRegister,
    UserUpdate,
    UserContactResponse,
)
from security import (
    create_access_token,
    decode_access_token,
    get_current_user,
    get_db,
    hash_password,
    require_admin,
    require_employee,
    validate_password,
    verify_password,
)
from fastapi import (
    Depends,
    FastAPI,
    File as UploadFileDependency,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi import File as UploadFileField
from fastapi.responses import FileResponse as FastAPIFileResponse
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# Create database tables
Base.metadata.create_all(bind=engine)

with engine.begin() as connection:
    connection.execute(
        text(
            "ALTER TABLE file_upload_recipients "
            "DROP CONSTRAINT IF EXISTS file_upload_recipients_upload_id_key"
        )
    )
    recipient_index_definition = connection.execute(
        text(
            "SELECT indexdef FROM pg_indexes "
            "WHERE schemaname = current_schema() "
            "AND indexname = 'ix_file_upload_recipients_upload_id'"
        )
    ).scalar()
    if recipient_index_definition and "CREATE UNIQUE INDEX" in recipient_index_definition.upper():
        connection.execute(
            text("DROP INDEX ix_file_upload_recipients_upload_id")
        )
    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_file_upload_recipients_upload_id "
            "ON file_upload_recipients (upload_id)"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS file_id INTEGER"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) NOT NULL DEFAULT 'GST'"
        )
    )
    connection.execute(
        text(
            "UPDATE clients SET client_type = 'GST' WHERE client_type IS NULL"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_id VARCHAR(64)"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255)"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS folder_id VARCHAR(64)"
        )
    )
    connection.execute(
        text(
            "ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255)"
        )
    )


app = FastAPI(title="DoozyBrands")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:5173",
        "http://192.168.31.154:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE_DIR = Path("storage")
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MB

@app.get("/")
def home():
    return {
        "message": "DoozyBrands Backend is running"
    }


# The app reuses the session factory from security.py so that
# get_current_user and the update route operate on the same DB session.


@app.post("/register")
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
        # Check whether the email is already registered
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists.",
        )

    # Check whether the phone number is already registered
    if user_data.phone_number:
        existing_phone = (
            db.query(User)
            .filter(User.phone_number == user_data.phone_number)
            .first()
        )

        if existing_phone:
            raise HTTPException(
                status_code=400,
                detail="An account with this phone number already exists.",
            )

    # Validate password
    is_valid, error_message = validate_password(user_data.password)

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=error_message,
        )

    # Create the new employee
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        phone_number=user_data.phone_number,
        password_hash=hash_password(user_data.password),
        role="employee",
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Account created successfully.",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "phone_number": new_user.phone_number,
            "role": new_user.role,
        },
    }

@app.post("/login")
def login_user(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    # Find the user by email
    user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    # Don't reveal whether the email exists
    # or whether the password was wrong.
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    # Check whether the account is active
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is inactive.",
        )

    # Verify the password
    if not verify_password(
        user_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    # Create JWT token
    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    return {
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone_number": user.phone_number,
            "role": user.role,
        },
    }

@app.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone_number": current_user.phone_number,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }

@app.patch("/me")
def update_me(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Re-query the user in the same session that will commit the update.
    current_user = (
        db.query(User)
        .filter(User.id == current_user.id)
        .first()
    )

    if not current_user:
        raise HTTPException(
            status_code=404,
            detail="User account not found.",
        )

    # NAME
    if user_data.name is not None:
        name = user_data.name.strip()

        if not name:
            raise HTTPException(
                status_code=400,
                detail="Name cannot be empty.",
            )

        current_user.name = name

    # PHONE NUMBER
    if user_data.phone_number is not None:
        phone_number = user_data.phone_number.strip() or None

        if phone_number:
            existing_phone = (
                db.query(User)
                .filter(
                    User.phone_number == phone_number,
                    User.id != current_user.id,
                )
                .first()
            )

            if existing_phone:
                raise HTTPException(
                    status_code=400,
                    detail="That phone number is already in use.",
                )

        current_user.phone_number = phone_number

    # PASSWORD
    if user_data.password is not None:
        password = user_data.password.strip()

        is_valid, error_message = validate_password(password)

        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=error_message,
            )

        current_user.password_hash = hash_password(password)

    db.commit()
    db.refresh(current_user)

    # IMPORTANT:
    # Read the record again from the database
    updated_user = (
        db.query(User)
        .filter(User.id == current_user.id)
        .first()
    )

    if not updated_user:
        raise HTTPException(
            status_code=404,
            detail="User account not found.",
        )

    return {
        "id": updated_user.id,
        "name": updated_user.name,
        "email": updated_user.email,
        "phone_number": updated_user.phone_number,
        "role": updated_user.role,
        "is_active": updated_user.is_active,
    }

@app.delete("/me")
def delete_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    if current_user.role == "admin":
        admin_count = db.query(User).filter(
            User.role == "admin",
            User.is_active == True,
        ).count()

        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="The last active admin account cannot be deleted.",
            )

    owned_task_ids = [
        task_id
        for (task_id,) in db.query(Task.id).filter(
            (Task.employee_id == user_id) | (Task.created_by_user_id == user_id)
        ).all()
    ]

    document_query = db.query(Document).filter(
        (Document.uploaded_by_id == user_id)
        | (Document.task_id.in_(owned_task_ids) if owned_task_ids else False)
    )
    for document in document_query.all():
        document_path = Path(document.storage_path)
        if document_path.exists():
            document_path.unlink()
    document_query.delete(synchronize_session=False)

    db.query(Task).filter(
        Task.created_by_user_id == user_id,
        Task.employee_id != user_id,
    ).update({Task.created_by_user_id: None}, synchronize_session=False)
    if owned_task_ids:
        db.query(Task).filter(Task.id.in_(owned_task_ids)).delete(
            synchronize_session=False,
        )

    owned_files = db.query(File).filter(File.uploaded_by == user_id).all()
    for stored_file in owned_files:
        file_path = Path(stored_file.storage_path)
        if file_path.exists():
            file_path.unlink()
    owned_file_ids = [file.id for file in owned_files]
    if owned_file_ids:
        db.query(FileShare).filter(FileShare.file_id.in_(owned_file_ids)).delete(
            synchronize_session=False,
        )
        db.query(File).filter(File.id.in_(owned_file_ids)).delete(
            synchronize_session=False,
        )

    upload_ids = [
        upload_id
        for (upload_id,) in db.query(FileUpload.upload_id).filter(
            FileUpload.uploaded_by == user_id
        ).all()
    ]
    if upload_ids:
        for (storage_path,) in db.query(FileUpload.storage_path).filter(
            FileUpload.upload_id.in_(upload_ids)
        ).all():
            upload_path = Path(storage_path)
            if upload_path.exists():
                upload_path.unlink()
        db.query(FileUploadRecipient).filter(
            FileUploadRecipient.upload_id.in_(upload_ids)
        ).delete(synchronize_session=False)
        db.query(FileUpload).filter(
            FileUpload.upload_id.in_(upload_ids)
        ).delete(synchronize_session=False)

    db.query(FileShare).filter(
        (FileShare.recipient_id == user_id) | (FileShare.shared_by == user_id)
    ).delete(synchronize_session=False)
    db.query(PrintingOrder).filter(PrintingOrder.employee_id == user_id).delete(
        synchronize_session=False,
    )
    db.query(Message).filter(
        (Message.sender_id == user_id) | (Message.receiver_id == user_id)
    ).delete(synchronize_session=False)
    db.query(Notification).filter(
        (Notification.recipient_id == user_id) | (Notification.sender_id == user_id)
    ).delete(synchronize_session=False)
    db.delete(current_user)
    db.commit()

    return {"message": "Account and associated data deleted successfully."}

@app.get("/users", response_model=list[UserContactResponse])
def get_users_for_messaging(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(User)
        .filter(
            User.is_active == True,
            User.id != current_user.id,
        )
        .order_by(User.name.asc())
        .all()
    )

@app.post("/clients", response_model=ClientResponse)
def create_client(
    client_data: ClientCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_client = (
        db.query(Client)
        .filter(Client.name == client_data.name)
        .first()
    )

    if existing_client:
        raise HTTPException(
            status_code=400,
            detail="A client with this name already exists.",
        )

    client = Client(
        name=client_data.name,
        client_type=client_data.client_type,
        is_active=True,
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return client


@app.get("/clients", response_model=list[ClientResponse])
def get_clients(
    client_type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Client).filter(Client.is_active == True)

    if client_type in {"GST", "NON_GST"}:
        query = query.filter(Client.client_type == client_type)

    return query.order_by(Client.name).all()


@app.get("/clients/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    client = (
        db.query(Client)
        .filter(Client.id == client_id)
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    return client


@app.patch("/clients/{client_id}", response_model=ClientResponse)
def deactivate_client(
    client_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = (
        db.query(Client)
        .filter(Client.id == client_id)
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    client.is_active = False

    db.commit()
    db.refresh(client)

    return client

@app.delete("/clients/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = (
        db.query(Client)
        .filter(Client.id == client_id)
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    db.query(Task).filter(Task.client_id == client_id).delete(
        synchronize_session=False,
    )
    db.delete(client)
    db.commit()

    return {"message": "Client deleted successfully."}

@app.post("/tasks", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Determine assignment
    if current_user.role == "employee":
        if task_data.employee_id is None:
            employee_id = current_user.id
            assignment_source = "self"
        else:
            employee = (
                db.query(User)
                .filter(
                    User.id == task_data.employee_id,
                    User.is_active == True,
                )
                .first()
            )

            if not employee:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found or inactive.",
                )

            employee_id = employee.id
            assignment_source = "self"

    elif current_user.role == "admin":
        if task_data.employee_id is None:
            raise HTTPException(
                status_code=400,
                detail="Admin must specify an employee_id.",
            )

        employee = (
            db.query(User)
            .filter(
                User.id == task_data.employee_id,
                User.is_active == True,
            )
            .first()
        )

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found or inactive.",
            )

        employee_id = employee.id
        assignment_source = "manager"

    else:
        raise HTTPException(
            status_code=403,
            detail="Invalid user role.",
        )

    # Verify client
    if task_data.client_id is not None:
        client = (
            db.query(Client)
            .filter(
                Client.id == task_data.client_id,
                Client.is_active == True,
            )
            .first()
        )

        if not client:
            raise HTTPException(
                status_code=404,
                detail="Client not found or inactive.",
            )

    # Create task
    task = Task(
        employee_id=employee_id,
        client_id=task_data.client_id,
        date=task_data.date or date.today(),
        subject=task_data.subject,
        priority=task_data.priority,
        revision=task_data.revision,
        status=task_data.status,
        design=task_data.design,
        printing=task_data.printing,
        quantity=task_data.quantity,
        vendor=task_data.vendor,
        remark=task_data.remark,
        created_by_user_id=current_user.id,
        assignment_source=assignment_source,
    )

    db.add(task)
    db.flush()

    # Create notification only for manager assignments
    notification = None

    if assignment_source == "manager":
        notification = Notification(
            recipient_id=employee_id,
            sender_id=current_user.id,
            notification_type="task_assigned",
            title="New task assigned",
            message=f"You have been assigned a new task: {task.subject}",
            is_read=False,
        )

        db.add(notification)

    db.commit()
    db.refresh(task)

    # Send real-time notification after successful database commit
    if notification:
        db.refresh(notification)

        await manager.send_to_user(
            employee_id,
            {
                "type": "notification",
                "notification_id": notification.id,
                "notification_type": notification.notification_type,
                "title": notification.title,
                "message": notification.message,
            },
        )

    return task

@app.get("/tasks", response_model=list[TaskResponse])
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Task, User.name.label("employee_name"))
        .join(User, User.id == Task.employee_id)
    )

    results = (
        query
        .order_by(Task.date.desc(), Task.id.desc())
        .all()
    )

    return [
        TaskResponse(
            id=task.id,
            employee_id=task.employee_id,
            employee_name=employee_name,
            client_id=task.client_id,
            date=task.date,
            subject=task.subject,
            priority=task.priority,
            revision=task.revision,
            status=task.status,
            design=task.design,
            printing=task.printing,
            quantity=task.quantity,
            vendor=task.vendor,
            remark=task.remark,
            created_by_user_id=task.created_by_user_id,
            assignment_source=task.assignment_source,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
        for task, employee_name in results
    ]
@app.get("/tasks/today", response_model=list[TaskResponse])
def get_today_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.date == date.today())

    return query.order_by(Task.id.desc()).all()


@app.get("/tasks/pending", response_model=list[TaskResponse])
def get_pending_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.status != "Completed")

    return query.order_by(Task.date.desc(), Task.id.desc()).all()


@app.get("/tasks/completed", response_model=list[TaskResponse])
def get_completed_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.status == "Completed")

    return query.order_by(Task.date.desc(), Task.id.desc()).all()


@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task

@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return {"message": "Task deleted successfully."}

@app.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    if task_data.employee_id is not None:
        if (
            current_user.role != "admin"
            and task_data.employee_id != task.employee_id
        ):
            raise HTTPException(
                status_code=403,
                detail="Only admins can reassign tasks.",
            )

        employee = (
            db.query(User)
            .filter(
                User.id == task_data.employee_id,
                User.role == "employee",
                User.is_active == True,
            )
            .first()
        )

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found or inactive",
            )

    # Check client if one is supplied
    if task_data.client_id is not None:
        client = (
            db.query(Client)
            .filter(
                Client.id == task_data.client_id,
                Client.is_active == True,
            )
            .first()
        )

        if not client:
            raise HTTPException(
                status_code=404,
                detail="Client not found or inactive",
            )

    update_data = task_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task

@app.post("/tasks/{task_id}/complete", response_model=TaskResponse)
def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    # Admins and employees can complete tasks
    task.status = "Completed"

    db.commit()
    db.refresh(task)

    return task

@app.get(
    "/task-options",
    response_model=list[TaskListItem],
)
def get_task_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task)

    tasks = (
        query
        .order_by(Task.date.desc(), Task.id.desc())
        .all()
    )

    return [
        TaskListItem(
            id=task.id,
            name=task.subject,
        )
        for task in tasks
    ]

@app.get("/clients/{client_id}/tasks", response_model=list[TaskResponse])
def get_client_tasks(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found",
        )

    query = db.query(Task).filter(Task.client_id == client_id)

    return query.order_by(Task.date.desc(), Task.id.desc()).all()

@app.post("/printing", response_model=PrintingOrderResponse)
def create_printing_order(
    order_data: PrintingOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "employee":
        employee_id = current_user.id
    elif current_user.role == "admin":
        if order_data.employee_id is None:
            raise HTTPException(
                status_code=400,
                detail="Admin must specify an employee_id.",
            )

        employee_id = order_data.employee_id
    else:
        raise HTTPException(
            status_code=403,
            detail="Invalid user role.",
        )

    employee = (
        db.query(User)
        .filter(
            User.id == employee_id,
            User.is_active == True,
        )
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found or inactive.",
        )

    order = PrintingOrder(
        employee_id=employee_id,
        date=order_data.date or date.today(),
        company=order_data.company.strip(),
        description=order_data.description.strip(),
        paper=order_data.paper.strip() if order_data.paper else None,
        quantity=order_data.quantity,
        vendor=order_data.vendor.strip() if order_data.vendor else None,
        status=order_data.status or "Pending",
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return order


@app.get("/printing", response_model=list[PrintingOrderResponse])
def get_printing_orders(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PrintingOrder).join(User, User.id == PrintingOrder.employee_id)

    if employee_id is not None:
        query = query.filter(PrintingOrder.employee_id == employee_id)

    return (
        query.order_by(PrintingOrder.date.desc(), PrintingOrder.id.desc())
        .all()
    )


@app.get("/printing/{order_id}", response_model=PrintingOrderResponse)
def get_printing_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(PrintingOrder).filter(PrintingOrder.id == order_id).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Printing order not found.",
        )

    return order


@app.patch("/printing/{order_id}", response_model=PrintingOrderResponse)
def update_printing_order(
    order_id: int,
    order_data: PrintingOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(PrintingOrder).filter(PrintingOrder.id == order_id).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Printing order not found.",
        )

    if order_data.employee_id is not None:
        if current_user.role != "admin" and order_data.employee_id != order.employee_id:
            raise HTTPException(
                status_code=403,
                detail="Only admins can reassign printing orders.",
            )

        employee = (
            db.query(User)
            .filter(
                User.id == order_data.employee_id,
                User.is_active == True,
            )
            .first()
        )

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found or inactive.",
            )

    update_data = order_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field in {"company", "description", "paper", "vendor"} and value is not None:
            setattr(order, field, str(value).strip())
        else:
            setattr(order, field, value)

    db.commit()
    db.refresh(order)

    return order


@app.delete("/printing/{order_id}")
def delete_printing_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(PrintingOrder).filter(PrintingOrder.id == order_id).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Printing order not found.",
        )

    db.delete(order)
    db.commit()

    return {"message": "Printing order deleted successfully."}


@app.get(
    "/reports/monthly",
    response_model=MonthlyReportResponse,
)
def get_monthly_report(
    month: int,
    year: int,
    client_id: int | None = None,
    client_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=400,
            detail="Month must be between 1 and 12.",
        )

    if year < 2000 or year > 2100:
        raise HTTPException(
            status_code=400,
            detail="Invalid year.",
        )

    report_start = date(year, month, 1)
    report_end = (
        date(year + 1, 1, 1)
        if month == 12
        else date(year, month + 1, 1)
    )

    query = (
        db.query(Task, User.name.label("employee_name"))
        .join(User, User.id == Task.employee_id)
        .filter(
            Task.date >= report_start,
            Task.date < report_end,
        )
    )

    if client_id is not None:
        client = (
            db.query(Client)
            .filter(Client.id == client_id)
            .first()
        )

        if not client:
            raise HTTPException(
                status_code=404,
                detail="Client not found.",
            )

        query = query.filter(Task.client_id == client_id)

    if client_type in {"GST", "NON_GST"}:
        query = query.join(Client, Client.id == Task.client_id).filter(
            Client.client_type == client_type,
            Client.is_active == True,
        )

    task_rows = query.order_by(Task.date.asc(), Task.id.asc()).all()

    tasks = [
        TaskResponse(
            id=task.id,
            employee_id=task.employee_id,
            employee_name=employee_name,
            client_id=task.client_id,
            date=task.date,
            subject=task.subject,
            priority=task.priority,
            revision=task.revision,
            status=task.status,
            design=task.design,
            printing=task.printing,
            quantity=task.quantity,
            vendor=task.vendor,
            remark=task.remark,
            created_by_user_id=task.created_by_user_id,
            assignment_source=task.assignment_source,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
        for task, employee_name in task_rows
    ]

    completed = sum(
        1 for task in tasks
        if task.status.lower() == "completed"
    )

    pending = len(tasks) - completed

    return MonthlyReportResponse(
        month=month,
        year=year,
        client_id=client_id,
        total_tasks=len(tasks),
        completed_tasks=completed,
        pending_tasks=pending,
        tasks=tasks,
    )

@app.get("/reports/monthly/excel")
def download_monthly_report_excel(
    month: int,
    year: int,
    client_id: int | None = None,
    client_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = get_monthly_report(
        month=month,
        year=year,
        client_id=client_id,
        client_type=client_type,
        db=db,
        current_user=current_user,
    )

    employees = {
        employee.id: employee.name
        for employee in db.query(User).all()
    }
    clients = {
        client.id: client.name
        for client in db.query(Client).all()
    }

    rows = [
        [
            "ID",
            "Date",
            "Designer Name",
            "Client",
            "Description",
            "Design",
            "Printing",
            "Quantity",
            "Priority",
            "Status",
            "Vendor",
            "Remark",
        ]
    ]

    rows.extend(
        [
            task.id,
            task.date,
            employees.get(task.employee_id, f"#{task.employee_id}"),
            clients.get(task.client_id, "") if task.client_id else "",
            task.subject,
            task.design or "",
            task.printing or "",
            task.quantity if task.quantity is not None else "",
            task.priority,
            task.status,
            task.vendor or "",
            task.remark or "",
        ]
        for task in report.tasks
    )

    rows = [
        ["Monthly Report", f"{month:02d}/{year}"],
        ["Total Tasks", report.total_tasks],
        ["Completed", report.completed_tasks],
        ["Pending", report.pending_tasks],
        [],
        *rows,
    ]

    def worksheet_xml():
        xml_rows = []

        for row in rows:
            cells = []

            for value in row:
                if value == "":
                    cells.append("<c/>")
                elif isinstance(value, (int, float)):
                    cells.append(f'<c t="n"><v>{value}</v></c>')
                else:
                    cells.append(
                        f'<c t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'
                    )

            xml_rows.append(f"<row>{''.join(cells)}</row>")

        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f"<sheetData>{''.join(xml_rows)}</sheetData>"
            "</worksheet>"
        ).encode("utf-8")

    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Monthly Report" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    ).encode("utf-8")
    workbook_relationships = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    ).encode("utf-8")
    root_relationships = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    ).encode("utf-8")
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    ).encode("utf-8")

    output = io.BytesIO()

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", root_relationships)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_relationships)
        archive.writestr("xl/worksheets/sheet1.xml", worksheet_xml())

    filename = f"monthly-report-{year}-{month:02d}.xlsx"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )

@app.post("/messages", response_model=MessageResponse)
async def send_message(
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if message_data.receiver_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a message to yourself.",
        )

    receiver = (
        db.query(User)
        .filter(
            User.id == message_data.receiver_id,
            User.is_active == True,
        )
        .first()
    )

    if not receiver:
        raise HTTPException(
            status_code=404,
            detail="Recipient not found or inactive.",
        )

    if not message_data.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty.",
        )

    # Save message
    new_message = Message(
        sender_id=current_user.id,
        receiver_id=receiver.id,
        message=message_data.message.strip(),
        is_read=False,
    )

    db.add(new_message)
    db.flush()

    # Create notification for recipient
    notification = Notification(
        recipient_id=receiver.id,
        sender_id=current_user.id,
        notification_type="message",
        title=f"New message from {current_user.name}",
        message=message_data.message.strip(),
        is_read=False,
    )

    db.add(notification)
    db.commit()
    db.refresh(new_message)

    await manager.send_to_user(
        receiver.id,
        {
            "type": "notification",
            "notification_id": notification.id,
            "notification_type": notification.notification_type,
            "sender_id": notification.sender_id,
            "title": notification.title,
            "message": notification.message,
        },
    )

    return new_message

@app.post("/messages/{user_id}/call", response_model=NotificationResponse)
async def call_employee_to_cabin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    employee = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.role == "employee",
            User.is_active == True,
        )
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found or inactive.",
        )

    notification = Notification(
        recipient_id=employee.id,
        sender_id=current_user.id,
        notification_type="manager_call",
        title="Manager's Cabin Call",
        message="🔔 You have been called to Sir's Cabin",
        is_read=False,
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    await manager.send_to_user(
        employee.id,
        {
            "type": "notification",
            "notification_id": notification.id,
            "notification_type": notification.notification_type,
            "title": notification.title,
            "message": notification.message,
        },
    )

    return notification

@app.get("/messages/unread-count")
def get_unread_message_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Message)
        .filter(
            Message.receiver_id == current_user.id,
            Message.is_read == False,
        )
        .count()
    )

    return {"count": count}

@app.get("/messages/unread-count/{user_id}")
def get_unread_message_count_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Message)
        .filter(
            Message.sender_id == user_id,
            Message.receiver_id == current_user.id,
            Message.is_read == False,
        )
        .count()
    )

    return {"count": count}

@app.get(
    "/messages/{user_id}",
    response_model=list[MessageResponse],
)
def get_conversation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    other_user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not other_user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    messages = (
        db.query(Message)
        .filter(
            (
                (Message.sender_id == current_user.id)
                & (Message.receiver_id == user_id)
            )
            |
            (
                (Message.sender_id == user_id)
                & (Message.receiver_id == current_user.id)
            )
        )
        .order_by(Message.created_at.asc())
        .all()
    )

    return messages

@app.post("/messages/{user_id}/read")
def mark_messages_read(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = (
        db.query(Message)
        .filter(
            Message.sender_id == user_id,
            Message.receiver_id == current_user.id,
            Message.is_read == False,
        )
        .update(
            {"is_read": True},
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "Messages marked as read.",
        "updated_count": updated,
    }

@app.delete("/messages/{user_id}")
def delete_messages_for_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin" and user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only delete messages from your own conversations.",
        )

    deleted = (
        db.query(Message)
        .filter(
            (
                (Message.sender_id == current_user.id)
                & (Message.receiver_id == user_id)
            )
            |
            (
                (Message.sender_id == user_id)
                & (Message.receiver_id == current_user.id)
            )
        )
        .delete(synchronize_session=False)
    )

    db.commit()

    return {
        "message": "Messages deleted successfully.",
        "deleted_count": deleted,
    }

@app.delete("/messages")
def delete_selected_messages(
    payload: MessageDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.message_ids:
        return {"message": "No messages selected.", "deleted_count": 0}

    messages = (
        db.query(Message)
        .filter(Message.id.in_(payload.message_ids))
        .all()
    )

    if not messages:
        raise HTTPException(
            status_code=404,
            detail="Selected messages were not found.",
        )

    for message in messages:
        if (
            current_user.role != "admin"
            and message.sender_id != current_user.id
            and message.receiver_id != current_user.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete these messages.",
            )

    deleted = (
        db.query(Message)
        .filter(Message.id.in_(payload.message_ids))
        .delete(synchronize_session=False)
    )

    db.commit()

    return {
        "message": "Selected messages deleted successfully.",
        "deleted_count": deleted,
    }

@app.get(
    "/notifications",
    response_model=list[NotificationResponse],
)
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

@app.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    notification.is_read = True

    db.commit()

    return {
        "message": "Notification marked as read."
    }

@app.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    db.delete(notification)
    db.commit()

    return {"message": "Notification deleted successfully."}

@app.delete("/notifications")
def delete_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.notification_type != "message",
        )
        .delete(synchronize_session=False)
    )

    db.commit()

    return {
        "message": "All notifications cleared.",
        "deleted_count": deleted,
    }

@app.post("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.is_read == False,
        )
        .update(
            {"is_read": True},
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "message": "All notifications marked as read.",
        "updated_count": updated,
    }

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    db: Session = Depends(get_db),
):
    protocols = [
        protocol.strip()
        for protocol in websocket.headers.get("sec-websocket-protocol", "").split(",")
    ]
    token_protocol = next(
        (protocol for protocol in protocols if protocol.startswith("bearer.")),
        None,
    )

    try:
        if "office-system" not in protocols or token_protocol is None:
            raise ValueError("Missing authentication token.")

        payload = decode_access_token(token_protocol.removeprefix("bearer."))
        token_user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        await websocket.close(code=1008)
        return

    authenticated_user = db.query(User).filter(User.id == token_user_id).first()
    if (
        token_user_id != user_id
        or authenticated_user is None
        or not authenticated_user.is_active
    ):
        await websocket.close(code=1008)
        return

    await manager.connect(user_id, websocket, subprotocol="office-system")

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(user_id)

@app.post("/files/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required.",
        )

    file_id = uuid.uuid4().hex

    temp_filename = f"{file_id}.part"
    final_filename = f"{file_id}.file"

    temp_path = STORAGE_DIR / temp_filename
    final_path = STORAGE_DIR / final_filename

    sha256 = hashlib.sha256()
    total_size = 0

    try:
        with open(temp_path, "wb") as output:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_SIZE)

                if not chunk:
                    break

                output.write(chunk)
                sha256.update(chunk)
                total_size += len(chunk)

        checksum = sha256.hexdigest()

        os.replace(temp_path, final_path)

        stored_file = File(
            original_filename=file.filename,
            stored_filename=final_filename,
            storage_path=str(final_path),
            file_size=total_size,
            checksum=checksum,
            uploaded_by=current_user.id,
            is_complete=True,
        )

        db.add(stored_file)
        db.commit()
        db.refresh(stored_file)

        return stored_file

    except Exception:
        db.rollback()

        if temp_path.exists():
            temp_path.unlink()

        if final_path.exists():
            final_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="File upload failed.",
        )

    finally:
        await file.close()

@app.get(
    "/file-recipients",
    response_model=list[FileRecipient],
)
def get_file_recipients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(User)
        .filter(
            User.is_active == True,
            User.id != current_user.id,
        )
        .order_by(User.name.asc())
        .all()
    )

@app.post(
    "/files/upload/start",
    response_model=FileUploadStartResponse,
)
async def start_file_upload(
    upload_data: FileUploadStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate file size
    if upload_data.total_size <= 0:
        raise HTTPException(
            status_code=400,
            detail="File size must be greater than zero.",
        )

    recipient_ids = list(dict.fromkeys(
        upload_data.recipient_ids
        or ([upload_data.recipient_id] if upload_data.recipient_id else [])
    ))
    if not recipient_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one recipient.",
        )

    recipients = (
        db.query(User)
        .filter(
            User.id.in_(recipient_ids),
            User.is_active == True,
            User.id != current_user.id,
        )
        .all()
    )

    if len(recipients) != len(recipient_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more recipients were not found or are inactive.",
        )

    # Create upload session
    upload_id = uuid.uuid4().hex

    temp_path = STORAGE_DIR / f"{upload_id}.part"
    temp_path.touch()

    upload = FileUpload(
        upload_id=upload_id,
        original_filename=upload_data.filename,
        total_size=upload_data.total_size,
        folder_id=upload_data.folder_id,
        folder_name=upload_data.folder_name,
        uploaded_size=0,
        storage_path=str(temp_path),
        uploaded_by=current_user.id,
        is_complete=False,
    )

    db.add(upload)
    db.flush()

    # Save access information for each recipient.
    db.add_all(
        FileUploadRecipient(
            upload_id=upload.upload_id,
            recipient_id=recipient.id,
        )
        for recipient in recipients
    )

    db.commit()
    db.refresh(upload)

    return FileUploadStartResponse(
        upload_id=upload.upload_id,
        filename=upload.original_filename,
        total_size=upload.total_size,
        uploaded_size=upload.uploaded_size,
        is_complete=upload.is_complete,
    )

@app.patch(
    "/files/upload/{upload_id}/chunk",
    response_model=FileChunkResponse,
)
async def upload_file_chunk(
    upload_id: str,
    chunk: UploadFile = UploadFileField(...),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = (
        db.query(FileUpload)
        .filter(
            FileUpload.upload_id == upload_id,
            FileUpload.uploaded_by == current_user.id,
        )
        .first()
    )

    if not upload:
        raise HTTPException(
            status_code=404,
            detail="Upload session not found.",
        )

    if upload.is_complete:
        raise HTTPException(
            status_code=400,
            detail="Upload is already complete.",
        )

    if offset != upload.uploaded_size:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Invalid upload offset.",
                "expected_offset": upload.uploaded_size,
                "received_offset": offset,
            },
        )

    remaining = upload.total_size - upload.uploaded_size

    if remaining <= 0:
        raise HTTPException(
            status_code=400,
            detail="No more data is required.",
        )

    temp_path = Path(upload.storage_path)

    try:
        bytes_written = 0

        with open(temp_path, "ab") as output:
            while True:
                data = await chunk.read(UPLOAD_CHUNK_SIZE)

                if not data:
                    break

                if bytes_written + len(data) > remaining:
                    raise HTTPException(
                        status_code=400,
                        detail="Chunk exceeds declared file size.",
                    )

                output.write(data)
                bytes_written += len(data)

        upload.uploaded_size += bytes_written

        db.commit()
        db.refresh(upload)

        return FileChunkResponse(
            upload_id=upload.upload_id,
            uploaded_size=upload.uploaded_size,
            total_size=upload.total_size,
            is_complete=upload.uploaded_size == upload.total_size,
        )

    except HTTPException:
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Chunk upload failed: {str(exc)}",
        )

    finally:
        await chunk.close()

@app.post(
    "/files/upload/{upload_id}/complete",
    response_model=FileUploadCompleteResponse,
)
async def complete_file_upload(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = (
        db.query(FileUpload)
        .filter(
            FileUpload.upload_id == upload_id,
            FileUpload.uploaded_by == current_user.id,
        )
        .first()
    )

    if not upload:
        raise HTTPException(
            status_code=404,
            detail="Upload session not found.",
        )

    if upload.is_complete:
        raise HTTPException(
            status_code=400,
            detail="Upload is already complete.",
        )

    if upload.uploaded_size != upload.total_size:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Upload is incomplete.",
                "uploaded_size": upload.uploaded_size,
                "total_size": upload.total_size,
            },
        )

    temp_path = Path(upload.storage_path)

    if not temp_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Uploaded file data not found.",
        )

    # Verify actual file size
    actual_size = temp_path.stat().st_size

    if actual_size != upload.total_size:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file size does not match expected size.",
        )

    # Calculate final checksum
    sha256 = hashlib.sha256()

    with open(temp_path, "rb") as source:
        while True:
            chunk = source.read(UPLOAD_CHUNK_SIZE)

            if not chunk:
                break

            sha256.update(chunk)

    checksum = sha256.hexdigest()

    # Move from temporary file to permanent file
    final_filename = f"{upload.upload_id}.file"
    final_path = STORAGE_DIR / final_filename

    os.replace(temp_path, final_path)

    # Create permanent file record
    stored_file = File(
        original_filename=upload.original_filename,
        stored_filename=final_filename,
        storage_path=str(final_path),
        file_size=actual_size,
        checksum=checksum,
        folder_id=upload.folder_id,
        folder_name=upload.folder_name,
        uploaded_by=current_user.id,
        is_complete=True,
    )
    upload_recipients = (
        db.query(FileUploadRecipient)
        .filter(
            FileUploadRecipient.upload_id == upload.upload_id
        )
        .all()
    )

    if not upload_recipients:
        raise HTTPException(
            status_code=400,
            detail="File recipient information is missing.",
        )
    db.add(stored_file)
    db.flush()

    notifications = []
    for upload_recipient in upload_recipients:
        db.add(
            FileShare(
                file_id=stored_file.id,
                recipient_id=upload_recipient.recipient_id,
                shared_by=current_user.id,
            )
        )
        notifications.append(
            Notification(
                recipient_id=upload_recipient.recipient_id,
                sender_id=current_user.id,
                notification_type="file_received",
                title="New file received",
                message=(
                    f"{current_user.name} sent you a new file: "
                    f"{stored_file.original_filename}"
                ),
                file_id=stored_file.id,
                is_read=False,
            )
        )

    db.add_all(notifications)
    db.query(FileUploadRecipient).filter(
        FileUploadRecipient.upload_id == upload.upload_id
    ).delete(synchronize_session=False)
    upload.is_complete = True

    db.commit()
    db.refresh(stored_file)

    for notification in notifications:
        await manager.send_to_user(
            notification.recipient_id,
            {
                "type": "notification",
                "notification_id": notification.id,
                "notification_type": notification.notification_type,
                "title": notification.title,
                "message": notification.message,
                "file_id": notification.file_id,
            },
        )

    return FileUploadCompleteResponse(
        upload_id=upload.upload_id,
        filename=stored_file.original_filename,
        file_size=stored_file.file_size,
        checksum=stored_file.checksum,
        is_complete=True,
    )

@app.get("/files", response_model=list[FileResponse])
def get_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uploader = aliased(User)
    recipient = aliased(User)

    rows = (
        db.query(
            File,
            uploader.name.label("uploader_name"),
            FileShare.recipient_id.label("recipient_id"),
            recipient.name.label("recipient_name"),
            recipient.role.label("recipient_role"),
        )
        .join(
            uploader,
            uploader.id == File.uploaded_by,
        )
        .join(
            FileShare,
            FileShare.file_id == File.id,
        )
        .join(
            recipient,
            recipient.id == FileShare.recipient_id,
        )
        .filter(
            File.is_complete == True,
            (
                (File.uploaded_by == current_user.id)
                |
                (FileShare.recipient_id == current_user.id)
            ),
        )
        .order_by(
            File.created_at.desc(),
            File.id.desc(),
        )
        .all()
    )

    return [
        FileResponse(
            id=file.id,
            original_filename=file.original_filename,
            stored_filename=file.stored_filename,
            file_size=file.file_size,
            checksum=file.checksum,
            folder_id=file.folder_id,
            folder_name=file.folder_name,
            uploaded_by=file.uploaded_by,
            uploader_name=uploader_name,
            recipient_id=recipient_id,
            recipient_name=recipient_name,
            recipient_role=recipient_role,
            is_complete=file.is_complete,
            created_at=file.created_at,
        )
        for (
            file,
            uploader_name,
            recipient_id,
            recipient_name,
            recipient_role,
        ) in rows
    ]

@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stored_file = (
        db.query(File)
        .filter(
            File.id == file_id,
            File.is_complete == True,
        )
        .first()
    )

    if not stored_file:
        raise HTTPException(
            status_code=404,
            detail="File not found.",
        )

    db.query(FileShare).filter(FileShare.file_id == file_id).delete(
        synchronize_session=False,
    )

    file_path = Path(stored_file.storage_path)
    if file_path.exists():
        file_path.unlink()

    db.delete(stored_file)
    db.commit()

    return {"message": "File deleted successfully."}

@app.get(
    "/files/admin/history",
    response_model=AdminFileTransferHistoryResponse,
)
def get_admin_file_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    rows = (
        db.query(
            File,
            User,
            FileShare,
        )
        .join(
            User,
            User.id == File.uploaded_by,
        )
        .join(
            FileShare,
            FileShare.file_id == File.id,
        )
        .filter(File.is_complete == True)
        .order_by(File.created_at.desc())
        .all()
    )

    files_sent_to_admin = []
    employee_transfers = []

    for file, sender, share in rows:
        recipient = (
            db.query(User)
            .filter(User.id == share.recipient_id)
            .first()
        )

        if not recipient:
            continue

        item = AdminFileTransferResponse(
            id=file.id,
            original_filename=file.original_filename,
            file_size=file.file_size,
            checksum=file.checksum,
            sender_id=sender.id,
            sender_name=sender.name,
            sender_role=sender.role,
            recipient_id=recipient.id,
            recipient_name=recipient.name,
            recipient_role=recipient.role,
            is_complete=file.is_complete,
            created_at=file.created_at,
        )

        if recipient.role == "admin":
            files_sent_to_admin.append(item)

        elif (
            sender.role == "employee"
            and recipient.role == "employee"
        ):
            employee_transfers.append(item)

    return AdminFileTransferHistoryResponse(
        files_sent_to_admin=files_sent_to_admin,
        employee_transfers=employee_transfers,
    )

@app.get("/files/{file_id}/download")
async def download_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stored_file = (
        db.query(File)
        .filter(
            File.id == file_id,
            File.is_complete == True,
        )
        .first()
    )

    if not stored_file:
        raise HTTPException(
            status_code=404,
            detail="File not found.",
        )

    has_access = (
        stored_file.uploaded_by == current_user.id
        or
        db.query(FileShare)
        .filter(
            FileShare.file_id == stored_file.id,
            FileShare.recipient_id == current_user.id,
        )
        .first()
        is not None
    )

    if not has_access:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to download this file.",
        )

    file_path = Path(stored_file.storage_path)

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Stored file data not found.",
        )

    actual_size = file_path.stat().st_size

    if actual_size != stored_file.file_size:
        raise HTTPException(
            status_code=500,
            detail="Stored file size does not match database record.",
        )

    # Verify file integrity before serving it.
    sha256 = hashlib.sha256()

    with open(file_path, "rb") as source:
        while True:
            chunk = source.read(UPLOAD_CHUNK_SIZE)

            if not chunk:
                break

            sha256.update(chunk)

    actual_checksum = sha256.hexdigest()

    if actual_checksum != stored_file.checksum:
        raise HTTPException(
            status_code=500,
            detail="File integrity verification failed.",
        )

    file_size = actual_size

    range_header = request.headers.get("range")

    # Normal full-file download
    if not range_header:
        def full_file_iterator():
            with open(file_path, "rb") as source:
                while True:
                    data = source.read(UPLOAD_CHUNK_SIZE)

                    if not data:
                        break

                    yield data

        return StreamingResponse(
            full_file_iterator(),
            status_code=200,
            media_type="application/octet-stream",
            headers={
                "Content-Length": str(file_size),
                "Content-Disposition": (
                    f'attachment; filename="{stored_file.original_filename}"'
                ),
                "Accept-Ranges": "bytes",
            },
        )

    # Only support a single byte range.
    if not range_header.startswith("bytes="):
        raise HTTPException(
            status_code=416,
            detail="Invalid Range header.",
        )

    range_value = range_header.replace("bytes=", "", 1).strip()

    if "," in range_value:
        raise HTTPException(
            status_code=416,
            detail="Multiple byte ranges are not supported.",
        )

    try:
        start_str, end_str = range_value.split("-", 1)

        if start_str == "":
            # Suffix range: bytes=-500
            suffix_length = int(end_str)

            if suffix_length <= 0:
                raise ValueError

            if suffix_length > file_size:
                suffix_length = file_size

            start = file_size - suffix_length
            end = file_size - 1

        else:
            start = int(start_str)

            if start < 0 or start >= file_size:
                raise ValueError

            if end_str == "":
                end = file_size - 1
            else:
                end = int(end_str)

                if end < start:
                    raise ValueError

                if end >= file_size:
                    end = file_size - 1

    except (ValueError, TypeError):
        return StreamingResponse(
            iter(()),
            status_code=416,
            headers={
                "Content-Range": f"bytes */{file_size}",
            },
        )

    content_length = end - start + 1

    def range_file_iterator():
        with open(file_path, "rb") as source:
            source.seek(start)

            remaining = content_length

            while remaining > 0:
                read_size = min(UPLOAD_CHUNK_SIZE, remaining)
                data = source.read(read_size)

                if not data:
                    break

                yield data
                remaining -= len(data)

    return StreamingResponse(
        range_file_iterator(),
        status_code=206,
        media_type="application/octet-stream",
        headers={
            "Content-Length": str(content_length),
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Disposition": (
                f'attachment; filename="{stored_file.original_filename}"'
            ),
        },
    )

@app.get("/files/folders/{folder_id}/download")
async def download_folder(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder_files = (
        db.query(File)
        .outerjoin(FileShare, FileShare.file_id == File.id)
        .filter(
            File.folder_id == folder_id,
            File.is_complete == True,
            (
                (File.uploaded_by == current_user.id)
                | (FileShare.recipient_id == current_user.id)
            ),
        )
        .all()
    )

    if not folder_files:
        raise HTTPException(
            status_code=404,
            detail="Folder not found or you do not have permission to download it.",
        )

    folder_name = folder_files[0].folder_name or "folder"
    archive = io.BytesIO()

    try:
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for stored_file in folder_files:
                file_path = Path(stored_file.storage_path)

                if not file_path.exists():
                    raise HTTPException(
                        status_code=404,
                        detail="Stored file data not found.",
                    )

                archive_name = stored_file.original_filename.replace("\\", "/")
                archive_name = archive_name.lstrip("/")

                if archive_name.startswith(f"{folder_name.rstrip('/')}/"):
                    archive_name = archive_name[len(folder_name.rstrip("/")) + 1:]

                if ".." in Path(archive_name).parts:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid folder file path.",
                    )

                zip_file.write(file_path, archive_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Folder download failed: {exc}",
        )

    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{folder_name}.zip"',
        },
    )

@app.get(
    "/employees",
    response_model=list[EmployeeListItem],
)
def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employees = (
        db.query(User)
        .filter(
            User.role == "employee",
            User.is_active == True,
        )
        .order_by(User.name.asc())
        .all()
    )

    return employees