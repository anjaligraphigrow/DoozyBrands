import { useState, type FormEvent } from "react";

import Modal from "./Modal";
import { createTask, updateTask } from "../api/tasks";
import { getErrorMessage } from "../utils/errors";

import type { Client, Employee, Task } from "../types";

const PRIORITY_OPTIONS = ["High", "Medium", "Low"] as const;
const STATUS_OPTIONS = ["Pending", "In Progress", "Completed", "On Hold"];

interface TaskFormModalProps {
  mode: "create" | "edit";
  task?: Task;
  clients: Client[];
  employees: Employee[];
  currentUserId?: number;
  onClose: () => void;
  onSaved: (task: Task) => void;
}

export default function TaskFormModal({
  mode,
  task,
  clients,
  employees,
  currentUserId,
  onClose,
  onSaved,
}: TaskFormModalProps) {
  const [employeeId, setEmployeeId] = useState<string>(
    task ? String(task.employee_id) : currentUserId ? String(currentUserId) : "",
  );
  const [clientId, setClientId] = useState<string>(
    task?.client_id ? String(task.client_id) : "",
  );
  const [date, setDate] = useState<string>(
    task?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [subject, setSubject] = useState(task?.subject ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "Medium");
  const revision = task?.revision ?? 0;
  const [status, setStatus] = useState(task?.status ?? "Pending");
  const [design, setDesign] = useState(task?.design ?? "");
  const [printing, setPrinting] = useState(task?.printing ?? "");
  const [quantity, setQuantity] = useState<string>(
    task?.quantity != null ? String(task.quantity) : "",
  );
  const [vendor, setVendor] = useState(task?.vendor ?? "");
  const [remark, setRemark] = useState(task?.remark ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    if (mode === "create" && !employeeId) {
      setError("Please select an employee to assign this task to.");
      return;
    }

    setSubmitting(true);
    setError("");

    const quantityValue =
      quantity.trim() === "" ? null : Number(quantity);

    try {
      if (mode === "create") {
        const created = await createTask({
          employee_id: Number(employeeId),
          client_id: clientId ? Number(clientId) : null,
          date,
          subject: subject.trim(),
          priority,
          revision,
          status,
          design: design.trim() || null,
          printing: printing.trim() || null,
          quantity: quantityValue,
          vendor: vendor.trim() || null,
          remark: remark.trim() || null,
        });

        onSaved(created);
      } else if (task) {
        const updated = await updateTask(task.id, {
          employee_id: Number(employeeId),
          client_id: clientId ? Number(clientId) : null,
          date,
          subject: subject.trim(),
          priority,
          revision,
          status,
          design: design.trim() || null,
          printing: printing.trim() || null,
          quantity: quantityValue,
          vendor: vendor.trim() || null,
          remark: remark.trim() || null,
        });

        onSaved(updated);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to save task."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={mode === "create" ? "New Task" : `Edit Task #${task?.id}`}
      onClose={onClose}
      wide
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Designer Name *</span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            required
          >
            <option value="">Select designer…</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Client</span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">No client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <label className="form-field form-field-wide">
          <span>Description *</span>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Describe the task"
            maxLength={255}
            required
          />
        </label>

        <label className="form-field">
          <span>Priority</span>
          <div className="checkbox-group">
            {PRIORITY_OPTIONS.map((option) => (
              <label key={option} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={priority === option}
                  onChange={() => setPriority(option)}
                />
                {option}
              </label>
            ))}
          </div>
        </label>

        <label className="form-field">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Quantity</span>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <label className="form-field">
          <span>Design</span>
          <input
            type="text"
            value={design}
            onChange={(event) => setDesign(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <label className="form-field">
          <span>Printing</span>
          <input
            type="text"
            value={printing}
            onChange={(event) => setPrinting(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <label className="form-field">
          <span>Vendor</span>
          <input
            type="text"
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <label className="form-field form-field-wide">
          <span>Remarks</span>
          <textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="Optional notes"
            rows={3}
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : mode === "create"
                ? "Create Task"
                : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
