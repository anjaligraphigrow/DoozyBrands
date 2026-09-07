import Modal from "./Modal";
import type { Client, Employee, Task } from "../types";

interface TaskDetailsModalProps {
  task: Task;
  clients: Client[];
  employees: Employee[];
  onClose: () => void;
}

export default function TaskDetailsModal({
  task,
  clients,
  employees,
  onClose,
}: TaskDetailsModalProps) {
  const client = clients.find((item) => item.id === task.client_id);
  const employee = employees.find((item) => item.id === task.employee_id);

  return (
    <Modal title={`Task #${task.id}`} onClose={onClose} wide>
      <div className="details-grid">
        <DetailRow label="Description" value={task.subject} />
        <DetailRow label="Status" value={task.status} />
        <DetailRow label="Priority" value={task.priority} />
        <DetailRow label="Date" value={task.date} />
        <DetailRow
          label="Employee"
          value={employee ? employee.name : `#${task.employee_id}`}
        />
        <DetailRow label="Client" value={client ? client.name : "—"} />
        <DetailRow label="Revision" value={String(task.revision)} />
        <DetailRow
          label="Assignment Source"
          value={task.assignment_source === "manager" ? "Manager" : "Self"}
        />
        <DetailRow label="Design" value={task.design || "—"} />
        <DetailRow label="Printing" value={task.printing || "—"} />
        <DetailRow
          label="Quantity"
          value={task.quantity != null ? String(task.quantity) : "—"}
        />
        <DetailRow label="Vendor" value={task.vendor || "—"} />
        <DetailRow
          label="Created"
          value={new Date(task.created_at).toLocaleString()}
        />
        <DetailRow
          label="Updated"
          value={new Date(task.updated_at).toLocaleString()}
        />
        <div className="detail-row detail-row-wide">
          <span>Remarks</span>
          <p>{task.remark || "No remarks."}</p>
        </div>
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
