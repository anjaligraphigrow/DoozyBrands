import api from "./client";
import type { LoginResponse, User } from "../types";

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone_number?: string;
  password: string;
}

export async function login(data: LoginData): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/login", data);

  localStorage.setItem("access_token", response.data.access_token);
  localStorage.setItem("user", JSON.stringify(response.data.user));

  return response.data;
}

export async function register(
  data: RegisterData,
): Promise<{ message: string; user: User }> {
  const response = await api.post("/register", data);
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await api.get<User>("/me");
  return response.data;
}

export interface ProfileUpdateData {
  name?: string;
  phone_number?: string;
  password?: string;
}

export async function updateProfile(
  data: ProfileUpdateData,
): Promise<User> {
  const response = await api.patch<User>("/me", data);
  return response.data;
}

export async function deleteAccount(): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>("/me");
  return response.data;
}

export function logout(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}