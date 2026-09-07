import api from "./client";
import type { Notification } from "../types";

export async function getNotifications(): Promise<Notification[]> {
  const response = await api.get<Notification[]>(
    "/notifications"
  );

  return response.data;
}

export async function markNotificationRead(
  notificationId: number
) {
  const response = await api.post(
    `/notifications/${notificationId}/read`
  );

  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await api.post(
    "/notifications/read-all"
  );

  return response.data;
}

export async function deleteNotification(
  notificationId: number,
): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(
    `/notifications/${notificationId}`,
  );

  return response.data;
}