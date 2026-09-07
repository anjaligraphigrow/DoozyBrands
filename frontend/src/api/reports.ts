import api from "./client";
import type { MonthlyReport } from "../types";

export async function getMonthlyReport(
  month: number,
  year: number,
  clientId?: number,
  clientType?: "GST" | "NON_GST" | "all",
): Promise<MonthlyReport> {
  const response = await api.get<MonthlyReport>(
    "/reports/monthly",
    {
      params: {
        month,
        year,
        ...(clientId ? { client_id: clientId } : {}),
        ...(clientType && clientType !== "all"
          ? { client_type: clientType }
          : {}),
      },
    },
  );

  return response.data;
}

export async function downloadMonthlyReportExcel(
  month: number,
  year: number,
  clientId?: number,
  clientType?: "GST" | "NON_GST" | "all",
): Promise<Blob> {
  const response = await api.get<Blob>("/reports/monthly/excel", {
    params: {
      month,
      year,
      ...(clientId ? { client_id: clientId } : {}),
      ...(clientType && clientType !== "all"
        ? { client_type: clientType }
        : {}),
    },
    responseType: "blob",
  });

  return response.data;
}