import api from "./client";

export interface PrintingOrder {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  company: string;
  description: string;
  paper: string | null;
  quantity: number | null;
  vendor: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PrintingOrderCreateData {
  employee_id?: number | null;
  date?: string | null;
  company: string;
  description: string;
  paper?: string | null;
  quantity?: number | null;
  vendor?: string | null;
  status?: string;
}

export interface PrintingOrderUpdateData {
  employee_id?: number | null;
  date?: string | null;
  company?: string;
  description?: string;
  paper?: string | null;
  quantity?: number | null;
  vendor?: string | null;
  status?: string;
}

export async function getPrintingOrders(): Promise<PrintingOrder[]> {
  const response = await api.get<PrintingOrder[]>("/printing");
  return response.data;
}

export async function createPrintingOrder(
  payload: PrintingOrderCreateData,
): Promise<PrintingOrder> {
  const response = await api.post<PrintingOrder>("/printing", payload);
  return response.data;
}

export async function updatePrintingOrder(
  orderId: number,
  payload: PrintingOrderUpdateData,
): Promise<PrintingOrder> {
  const response = await api.patch<PrintingOrder>(`/printing/${orderId}`, payload);
  return response.data;
}

export async function deletePrintingOrder(orderId: number): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/printing/${orderId}`);
  return response.data;
}
