export interface User {
  id: number;
  name: string;
  email: string;
  phone_number?: string | null;
  role: "admin" | "employee" | "manager";
  is_active?: boolean;
}

export interface Client {
  id: number;
  name: string;
  client_type: "GST" | "NON_GST";
  is_active?: boolean;
}

export interface Employee {
  id: number;
  name: string;
  role: "admin" | "employee";
}

export interface Task {
  id: number;
  employee_id: number;
  client_id: number | null;

  date: string;
  subject: string;
  priority: string;
  revision: number;
  status: string;

  design: string | null;
  printing: string | null;
  quantity: number | null;
  vendor: string | null;
  remark: string | null;

  created_by_user_id: number | null;
  assignment_source: string;

  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: number;
  recipient_id: number;
  sender_id: number | null;
  notification_type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface FileItem {
  id: number;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  checksum: string;
  uploaded_by: number;
  uploader_name: string;
  recipient_id: number;
  recipient_name: string;
  recipient_role: string;
  is_complete: boolean;
  created_at: string;
}

export interface MonthlyReport {
  month: number;
  year: number;
  client_id: number | null;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  tasks: Task[];
}

export interface LoginResponse {
  message: string;
  access_token: string;
  token_type: string;
  user: User;
}