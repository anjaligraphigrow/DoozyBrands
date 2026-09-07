import api from "./client";
import type { Client, Task } from "../types";

export interface ClientCreateData {
  name: string;
  client_type: "GST" | "NON_GST";
}

export async function getClients(
  clientType?: "GST" | "NON_GST" | "all",
): Promise<Client[]> {
  const response = await api.get<Client[]>("/clients", {
    params: {
      ...(clientType && clientType !== "all" ? { client_type: clientType } : {}),
    },
  });

  return response.data;
}

export async function createClient(
  clientData: ClientCreateData,
): Promise<Client> {
  const response = await api.post<Client>(
    "/clients",
    clientData,
  );

  return response.data;
}

export async function getClient(
  clientId: number,
): Promise<Client> {
  const response = await api.get<Client>(
    `/clients/${clientId}`,
  );

  return response.data;
}

export async function getClientTasks(
  clientId: number,
): Promise<Task[]> {
  const response = await api.get<Task[]>(
    `/clients/${clientId}/tasks`,
  );

  return response.data;
}

export async function deleteClient(
  clientId: number,
): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/clients/${clientId}`);
  return response.data;
}