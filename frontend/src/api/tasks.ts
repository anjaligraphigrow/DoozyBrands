import api from "./client";
import type { Task } from "../types";

export interface TaskCreateData {
  employee_id?: number | null;
  client_id?: number | null;
  date?: string | null;
  subject: string;
  priority?: string;
  revision?: number;
  status?: string;
  design?: string | null;
  printing?: string | null;
  quantity?: number | null;
  vendor?: string | null;
  remark?: string | null;
  assignment_source?: string;
}

export interface TaskUpdateData {
  employee_id?: number;
  client_id?: number | null;
  date?: string | null;
  subject?: string;
  priority?: string;
  revision?: number;
  status?: string;
  design?: string | null;
  printing?: string | null;
  quantity?: number | null;
  vendor?: string | null;
  remark?: string | null;
}

export interface TaskOption {
  id: number;
  name: string;
}

export async function getTasks(): Promise<Task[]> {
  const response = await api.get<Task[]>("/tasks");
  return response.data;
}

export async function getTodayTasks(): Promise<Task[]> {
  const response = await api.get<Task[]>("/tasks/today");
  return response.data;
}

export async function getPendingTasks(): Promise<Task[]> {
  const response = await api.get<Task[]>("/tasks/pending");
  return response.data;
}

export async function getCompletedTasks(): Promise<Task[]> {
  const response = await api.get<Task[]>("/tasks/completed");
  return response.data;
}

export async function getTask(taskId: number): Promise<Task> {
  const response = await api.get<Task>(`/tasks/${taskId}`);
  return response.data;
}

export async function createTask(
  taskData: TaskCreateData
): Promise<Task> {
  const response = await api.post<Task>("/tasks", taskData);
  return response.data;
}

export async function updateTask(
  taskId: number,
  taskData: TaskUpdateData
): Promise<Task> {
  const response = await api.patch<Task>(
    `/tasks/${taskId}`,
    taskData
  );

  return response.data;
}

export async function completeTask(
  taskId: number
): Promise<Task> {
  const response = await api.post<Task>(
    `/tasks/${taskId}/complete`
  );

  return response.data;
}

export async function deleteTask(
  taskId: number,
): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/tasks/${taskId}`);
  return response.data;
}

export async function getTaskOptions(): Promise<TaskOption[]> {
  const response = await api.get<TaskOption[]>("/task-options");
  return response.data;
}

export async function getClientTasks(
  clientId: number
): Promise<Task[]> {
  const response = await api.get<Task[]>(
    `/clients/${clientId}/tasks`
  );

  return response.data;
}

export async function getMonthlyReport(
  month: number,
  year: number,
  clientId?: number
) {
  const response = await api.get("/reports/monthly", {
    params: {
      month,
      year,
      client_id: clientId,
    },
  });

  return response.data;
}