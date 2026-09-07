import { useEffect, useState } from "react";

import {
  downloadMonthlyReportExcel,
  getMonthlyReport,
} from "../api/reports";
import { getClients } from "../api/clients";

import { getErrorMessage } from "../utils/errors";

import type { Client, MonthlyReport } from "../types";

export default function Reports() {
  const today = new Date();
  const reportYears = Array.from(
    { length: 101 },
    (_, index) => 2000 + index,
  );

  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [clientId, setClientId] = useState<string>("");
  const [clientTypeFilter, setClientTypeFilter] = useState<"all" | "GST" | "NON_GST">("all");

  const [clients, setClients] = useState<Client[]>([]);

  const [report, setReport] =
    useState<MonthlyReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadClients() {
      try {
        const data = await getClients();
        setClients(data);
      } catch {
        // Client filter is a nice-to-have; report still works without it.
      }
    }

    loadClients();
  }, []);

  async function loadReport() {
    setLoading(true);
    setError("");

    try {
      const data = await getMonthlyReport(
        month,
        year,
        clientId ? Number(clientId) : undefined,
        clientTypeFilter,
      );

      setReport(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load monthly report."));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, clientId, clientTypeFilter]);

  async function handleDownloadExcel() {
    setDownloading(true);
    setError("");

    try {
      const blob = await downloadMonthlyReportExcel(
        month,
        year,
        clientId ? Number(clientId) : undefined,
        clientTypeFilter,
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `monthly-report-${year}-${String(month).padStart(2, "0")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to download monthly report."));
    } finally {
      setDownloading(false);
    }
  }

  const completionRate =
    report && report.total_tasks > 0
      ? Math.round((report.completed_tasks / report.total_tasks) * 100)
      : 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DoozyBrands</p>
          <h2>Reports</h2>
          <p>
            View monthly task reports and completion status.
          </p>
        </div>
      </header>

      <section className="report-controls">
        <label>
          Month
          <select
            value={month}
            onChange={(event) =>
              setMonth(Number(event.target.value))
            }
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option
                key={index + 1}
                value={index + 1}
              >
                {new Date(
                  2000,
                  index,
                  1,
                ).toLocaleString("default", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        </label>

        <label>
          Year
          <select
            value={year}
            onChange={(event) =>
              setYear(Number(event.target.value))
            }
          >
            {reportYears.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          Client
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Client Type
          <select
            value={clientTypeFilter}
            onChange={(event) => setClientTypeFilter(event.target.value as "all" | "GST" | "NON_GST")}
          >
            <option value="all">All Clients</option>
            <option value="GST">GST</option>
            <option value="NON_GST">NON-GST</option>
          </select>
        </label>

        <button
          type="button"
          className="primary-button report-download-button"
          onClick={handleDownloadExcel}
          disabled={downloading}
        >
          {downloading ? "Preparing Excel..." : "Download Excel"}
        </button>
      </section>

      {error && (
        <div className="page-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-card">
          Loading report...
        </div>
      ) : report ? (
        <>
          <section className="stats-grid">
            <div className="stat-card">
              <span>Total Tasks</span>
              <strong>{report.total_tasks}</strong>
            </div>

            <div className="stat-card">
              <span>Completed</span>
              <strong>{report.completed_tasks}</strong>
            </div>

            <div className="stat-card">
              <span>Pending</span>
              <strong>{report.pending_tasks}</strong>
            </div>

            <div className="stat-card">
              <span>Completion Rate</span>
              <strong>{completionRate}%</strong>
            </div>
          </section>

          {report.total_tasks > 0 && (
            <section className="dashboard-section">
              <div className="section-heading">
                <h3>Completion Overview</h3>
              </div>

              <div className="report-bar-card">
                <div className="report-bar-track">
                  <div
                    className="report-bar-fill"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>

                <div className="report-bar-legend">
                  <span>
                    <span className="legend-dot legend-dot-completed" />
                    Completed ({report.completed_tasks})
                  </span>

                  <span>
                    <span className="legend-dot legend-dot-pending" />
                    Pending ({report.pending_tasks})
                  </span>
                </div>
              </div>
            </section>
          )}

          <section className="dashboard-section">
            <div className="section-heading">
              <h3>Monthly Tasks</h3>
            </div>

            {report.tasks.length === 0 ? (
              <div className="empty-card">
                No tasks found for this month.
              </div>
            ) : (
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Subject</th>
                      <th>Date</th>
                      <th>Priority</th>
                      <th>Revision</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.tasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.id}</td>
                        <td className="cell-truncate" title={task.subject}>
                          {task.subject}
                        </td>
                        <td>{task.date}</td>
                        <td>{task.priority}</td>
                        <td>{task.revision}</td>
                        <td>{task.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
