import { useEffect, useMemo, useState, type FormEvent } from "react";

import TrashIcon from "../components/TrashIcon";
import { getEmployees } from "../api/users";
import {
  createPrintingOrder,
  deletePrintingOrder,
  getPrintingOrders,
  updatePrintingOrder,
  type PrintingOrder,
} from "../api/printing";
import { getErrorMessage } from "../utils/errors";
import { useAuth } from "../context/AuthContext";

const monthNames = [
  "JAN",
  "FEB",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUG",
  "SEPT",
  "OCT",
  "NOV",
  "DEC",
];

export default function Printing() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<PrintingOrder[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [activeFilter, setActiveFilter] = useState<"all" | "today" | "pending" | "completed">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PrintingOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadOrders() {
    setIsLoading(true);
    setError("");

    try {
      const data = await getPrintingOrders();
      setOrders(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load printing orders."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await getEmployees();
        setEmployees(data);
      } catch {
        setError("Unable to load employees for the printing filter.");
      }
    }

    loadEmployees();
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (selectedEmployee !== "all" && order.employee_id !== Number(selectedEmployee)) {
        return false;
      }

      if (activeFilter === "today") {
        const today = new Date();
        const orderDate = new Date(`${order.date}T00:00:00`);
        const sameDay =
          orderDate.getFullYear() === today.getFullYear() &&
          orderDate.getMonth() === today.getMonth() &&
          orderDate.getDate() === today.getDate();

        if (!sameDay) {
          return false;
        }
      }

      if (activeFilter === "pending" && order.status !== "Pending") {
        return false;
      }

      if (activeFilter === "completed" && order.status !== "Completed") {
        return false;
      }

      if (query) {
        const haystack = [
          order.company,
          order.description,
          order.paper,
          order.vendor,
          order.employee_name,
          order.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      const orderDate = new Date(`${order.date}T00:00:00`);
      return (
        !Number.isNaN(orderDate.getTime()) &&
        orderDate.getMonth() === selectedMonth &&
        orderDate.getFullYear() === selectedYear
      );
    });
  }, [orders, search, selectedEmployee, selectedMonth, selectedYear, activeFilter]);

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort(
        (a, b) => new Date(`${a.date}T00:00:00`).getTime() - new Date(`${b.date}T00:00:00`).getTime(),
      ),
    [filteredOrders],
  );

  async function handleDelete(orderId: number) {
    if (!window.confirm("Delete this printing order?")) {
      return;
    }

    try {
      await deletePrintingOrder(orderId);
      await loadOrders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete printing order."));
    }
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      employee_id: Number(formData.get("employee_id") || 0) || null,
      date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
      company: String(formData.get("company") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      paper: String(formData.get("paper") || "").trim() || null,
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
      vendor: String(formData.get("vendor") || "").trim() || null,
      status: String(formData.get("status") || "Pending"),
    };

    if (!payload.company || !payload.description) {
      setError("Company and description are required.");
      return;
    }

    if (!payload.employee_id) {
      setError("Please select an employee.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (editingOrder) {
        await updatePrintingOrder(editingOrder.id, payload);
      } else {
        await createPrintingOrder(payload);
      }

      setShowCreateModal(false);
      setEditingOrder(null);
      form.reset();
      await loadOrders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to save printing order."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tasks-page">
      <div className="page-heading tasks-heading">
        <div>
          <h1>Printing</h1>
          <p>Track printing work and vendor orders across the month.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setEditingOrder(null);
            setShowCreateModal(true);
          }}
        >
          + Create Printing Order
        </button>
      </div>

      <div className="task-filters">
        {(["all", "today", "pending", "completed"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            className={activeFilter === filter ? "task-filter active" : "task-filter"}
            onClick={() => setActiveFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by company, description, vendor or employee..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={selectedEmployee}
          onChange={(event) => setSelectedEmployee(event.target.value)}
        >
          <option value="all">All Employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="page-error">{error}</div>}

      <div className="tasks-card">
        {isLoading ? (
          <div className="page-loading">Loading printing orders...</div>
        ) : sortedOrders.length === 0 ? (
          <div className="empty-state">
            <h3>No printing orders found</h3>
            <p>
              {orders.length === 0
                ? "No printing orders have been created yet."
                : `No records match your filters in ${monthNames[selectedMonth]} ${selectedYear}.`}
            </p>
          </div>
        ) : (
          <div className="task-table-wrapper">
            <table className="task-table">
              <thead>
                <tr>
                  <th>Sr. No</th>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Company</th>
                  <th>Description</th>
                  <th>Paper</th>
                  <th>Quantity</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {sortedOrders.map((order, index) => (
                  <tr key={order.id}>
                    <td>{index + 1}</td>
                    <td>{order.date}</td>
                    <td>{order.employee_name}</td>
                    <td>{order.company}</td>
                    <td>{order.description}</td>
                    <td>{order.paper || "—"}</td>
                    <td>{order.quantity ?? "—"}</td>
                    <td>{order.vendor || "—"}</td>
                    <td>
                      <span className={`status-badge status-${order.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="action-cell">
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditingOrder(order);
                            setShowCreateModal(true);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          style={{ minWidth: 42, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          onClick={() => handleDelete(order.id)}
                          aria-label="Delete printing order"
                          title="Delete printing order"
                        >
                          <TrashIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="task-month-bar" aria-label="Printing order months">
        <select
          className="task-year-select"
          value={selectedYear}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
          aria-label="Printing order year"
        >
          {Array.from({ length: 101 }, (_, index) => 2000 + index).map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {monthNames.map((month, index) => (
          <button
            key={month}
            type="button"
            className={selectedMonth === index ? "task-month-button active" : "task-month-button"}
            onClick={() => setSelectedMonth(index)}
          >
            {month}
          </button>
        ))}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setEditingOrder(null); }}>
          <div className="modal-card printing-order-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingOrder ? `Edit Printing Order #${editingOrder.id}` : "Create Printing Order"}</h3>
              <button type="button" className="secondary-button" onClick={() => { setShowCreateModal(false); setEditingOrder(null); }}>
                Close
              </button>
            </div>

            <form className="form-grid" onSubmit={handleFormSubmit}>
              <div className="form-grid-row">
                <label className="form-field">
                  <span>Employee *</span>
                  <select name="employee_id" defaultValue={editingOrder?.employee_id ?? user?.id ?? ""}>
                    <option value="">Select employee…</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    defaultValue={editingOrder?.date ?? new Date().toISOString().slice(0, 10)}
                  />
                </label>
              </div>

              <label className="form-field form-field-wide">
                <span>Company *</span>
                <input
                  type="text"
                  name="company"
                  defaultValue={editingOrder?.company ?? ""}
                  placeholder="Company name"
                  maxLength={150}
                />
              </label>

              <label className="form-field form-field-wide">
                <span>Description *</span>
                <input
                  type="text"
                  name="description"
                  defaultValue={editingOrder?.description ?? ""}
                  placeholder="Order description"
                  maxLength={255}
                />
              </label>

              <div className="form-grid-row">
                <label className="form-field">
                  <span>Paper</span>
                  <input
                    type="text"
                    name="paper"
                    defaultValue={editingOrder?.paper ?? ""}
                    placeholder="Paper type"
                  />
                </label>

                <label className="form-field">
                  <span>Quantity</span>
                  <input
                    type="number"
                    min={0}
                    name="quantity"
                    defaultValue={editingOrder?.quantity ?? ""}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <div className="form-grid-row">
                <label className="form-field">
                  <span>Vendor</span>
                  <input
                    type="text"
                    name="vendor"
                    defaultValue={editingOrder?.vendor ?? ""}
                    placeholder="Optional"
                  />
                </label>

                <label className="form-field">
                  <span>Status</span>
                  <select
                    name="status"
                    defaultValue={editingOrder?.status ?? "Pending"}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions" style={{ gridColumn: "1 / -1" }}>
                <button type="button" className="secondary-button" onClick={() => { setShowCreateModal(false); setEditingOrder(null); }}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? "Saving..." : editingOrder ? "Save Changes" : "Create Printing Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
