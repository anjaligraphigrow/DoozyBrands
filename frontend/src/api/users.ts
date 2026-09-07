import api from "./client";
import type { Employee } from "../types";

export async function getUsers(): Promise<Employee[]> {
  const response = await api.get<Employee[]>("/users");
  return response.data;
}

export async function getEmployees(): Promise<Employee[]> {
  const response = await api.get<Employee[]>("/employees");
  return response.data;
}