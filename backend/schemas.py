from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Literal
from datetime import date as DateType, datetime

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    phone_number: str | None = None
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: str | None = None
    phone_number: str | None = None
    password: str | None = None

class UserContactResponse(BaseModel):
    id: int
    name: str
    role: str

    model_config = ConfigDict(from_attributes=True)
    
class ClientCreate(BaseModel):
    name: str
    client_type: Literal["GST", "NON_GST"]


class ClientResponse(BaseModel):
    id: int
    name: str
    client_type: str
    is_active: bool

    class Config:
        from_attributes = True

class PrintingOrderCreate(BaseModel):
    employee_id: int | None = None
    date: DateType | None = None
    company: str
    description: str
    paper: str | None = None
    quantity: int | None = None
    vendor: str | None = None
    status: str = "Pending"

class PrintingOrderUpdate(BaseModel):
    employee_id: int | None = None
    date: DateType | None = None
    company: str | None = None
    description: str | None = None
    paper: str | None = None
    quantity: int | None = None
    vendor: str | None = None
    status: str | None = None

class PrintingOrderResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    date: DateType
    company: str
    description: str
    paper: str | None
    quantity: int | None
    vendor: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TaskCreate(BaseModel):
    employee_id: int | None = None
    client_id: int | None = None
    date: DateType | None = None

    subject: str
    priority: Literal["High", "Medium", "Low"] = "Medium"
    revision: int = 0
    status: str = "Pending"

    design: str | None = None
    printing: str | None = None
    quantity: int | None = None
    vendor: str | None = None
    remark: str | None = None

    assignment_source: str = "self"

class TaskUpdate(BaseModel):
    employee_id: int | None = None
    client_id: int | None = None
    date: DateType | None = None

    subject: str | None = None
    priority: Literal["High", "Medium", "Low"] | None = None
    revision: int | None = None
    status: str | None = None

    design: str | None = None
    printing: str | None = None
    quantity: int | None = None
    vendor: str | None = None
    remark: str | None = None

class TaskResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    client_id: int | None

    date: DateType
    subject: str
    priority: str
    revision: int
    status: str

    design: str | None
    printing: str | None
    quantity: int | None
    vendor: str | None
    remark: str | None

    created_by_user_id: int | None
    assignment_source: str

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MonthlyReportResponse(BaseModel):
    month: int
    year: int
    client_id: int | None
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    tasks: list[TaskResponse]

class MessageCreate(BaseModel):
    receiver_id: int
    message: str


class MessageDeleteRequest(BaseModel):
    message_ids: list[int]


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    recipient_id: int
    sender_id: int | None

    notification_type: str
    title: str
    message: str | None

    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
class FileResponse(BaseModel):
    id: int
    original_filename: str
    stored_filename: str
    file_size: int
    checksum: str
    folder_id: str | None = None
    folder_name: str | None = None

    uploaded_by: int
    uploader_name: str

    recipient_id: int
    recipient_name: str
    recipient_role: str

    is_complete: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminFileTransferHistoryResponse(BaseModel):
    id: int
    original_filename: str
    file_size: int
    uploaded_by: int
    uploader_name: str
    recipient_id: int
    recipient_name: str
    recipient_role: str
    shared_by: int
    sharer_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminFileTransferResponse(BaseModel):
    id: int
    original_filename: str
    file_size: int
    checksum: str
    sender_id: int
    sender_name: str
    sender_role: str
    recipient_id: int
    recipient_name: str
    recipient_role: str
    is_complete: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminFileTransferHistoryResponse(BaseModel):
    files_sent_to_admin: list[AdminFileTransferResponse]
    employee_transfers: list[AdminFileTransferResponse]

class FileUploadStart(BaseModel):
    filename: str
    total_size: int
    recipient_id: int
    folder_id: str | None = None
    folder_name: str | None = None

class FileUploadStartResponse(BaseModel):
    upload_id: str
    filename: str
    total_size: int
    uploaded_size: int
    is_complete: bool

class FileChunkResponse(BaseModel):
    upload_id: str
    uploaded_size: int
    total_size: int
    is_complete: bool

class FileUploadCompleteResponse(BaseModel):
    upload_id: str
    filename: str
    file_size: int
    checksum: str
    is_complete: bool

class EmployeeListItem(BaseModel):
    id: int
    name: str

class ClientListItem(BaseModel):
    id: int
    name: str

class TaskListItem(BaseModel):
    id: int
    name: str

class FileRecipient(BaseModel):
    id: int
    name: str
    role: str

    model_config = ConfigDict(from_attributes=True)