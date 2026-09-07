import api from "./client";
import type { Message } from "../types";

export async function sendMessage(
  receiverId: number,
  message: string,
): Promise<Message> {
  const response = await api.post<Message>("/messages", {
    receiver_id: receiverId,
    message,
  });

  return response.data;
}

export async function getConversation(
  userId: number,
): Promise<Message[]> {
  const response = await api.get<Message[]>(
    `/messages/${userId}`,
  );

  return response.data;
}

export async function markMessagesRead(
  userId: number,
): Promise<void> {
  await api.post(`/messages/${userId}/read`);
}

export async function getUnreadMessageCount(): Promise<number> {
  const response = await api.get<{ count: number }>(
    "/messages/unread-count",
  );

  return response.data.count;
}

export async function getUnreadMessageCountForUser(
  userId: number,
): Promise<number> {
  const response = await api.get<{ count: number }>(
    `/messages/unread-count/${userId}`,
  );

  return response.data.count;
}

export async function deleteMessagesForUser(
  userId: number,
): Promise<{ message: string; deleted_count: number }> {
  const response = await api.delete<{ message: string; deleted_count: number }>(
    `/messages/${userId}`,
  );

  return response.data;
}

export async function deleteSelectedMessages(
  messageIds: number[],
): Promise<{ message: string; deleted_count: number }> {
  const response = await api.delete<{ message: string; deleted_count: number }>(
    "/messages",
    {
      data: {
        message_ids: messageIds,
      },
    },
  );

  return response.data;
}

export async function callEmployeeToCabin(
  userId: number,
) {
  const response = await api.post(
    `/messages/${userId}/call`,
  );

  return response.data;
}