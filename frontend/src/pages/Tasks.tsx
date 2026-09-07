import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import TrashIcon from "../components/TrashIcon";
import {
  completeTask,
  deleteTask,
  getCompletedTasks,
  getPendingTasks,
  getTasks,
  getTodayTasks,
} from "../api/tasks";
import { getClients } from "../api/clients";
import { getEmployees } from "../api/users";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errors";

import TaskFormModal from "../components/TaskFormModal";
import TaskDetailsModal from "../components/TaskDetailsModal";

import type { Client, Employee, Task } from "../types";

type TaskFilter = "all" | "today" | "pending" | "completed";

export default function Tasks() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [searchParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [activeFilter, setActiveFilter] = useState<TaskFilter>(() => {
    const filter = searchParams.get("filter");

    return filter === "pending" || filter === "completed"
      ? filter
      : "all";
  });
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [completingTaskId, setCompletingTaskId] = useState<number | null>(
    null,
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  async function loadTasks(filter: TaskFilter) {
    setIsLoading(true);
    setError("");

    try {
      let data: Task[];

      switch (filter) {
        case "today":
          data = await getTodayTasks();
          break;

        case "pending":
          data = await getPendingTasks();
          break;

        case "completed":
          data = await getCompletedTasks();
          break;

        case "all":
        default:
          data = await getTasks();
          break;
      }

      setTasks(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load tasks."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTasks(activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const clientData = await getClients();
        setClients(clientData);
      } catch {
        // Client labels are optional; tasks remain usable when this fails.
      }

      try {
        const employeeData = await getEmployees();
        setEmployees(employeeData);
      } catch {
        setError("Unable to load employees for the task filter.");
      }
    }

    loadReferenceData();
  }, [isAdmin]);

  async function handleComplete(taskId: number) {
    setCompletingTaskId(taskId);
    setError("");

    try {
      await completeTask(taskId);
      await loadTasks(activeFilter);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to complete task."));
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function handleDelete(taskId: number) {
    if (!window.confirm("Delete this task permanently? This action cannot be undone.")) {
      return;
    }

    setError("");

    try {
      await deleteTask(taskId);
      await loadTasks(activeFilter);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete task."));
    }
  }

  function handleTaskSaved() {
    setShowCreateModal(false);
    setEditingTask(null);
    loadTasks(activeFilter);
  }

  const employeeName = (employeeId: number) =>
    employees.find((employee) => employee.id === employeeId)?.name ??
    `#${employeeId}`;

  const clientName = (clientId: number | null) => {
    if (!clientId) return "—";
    return clients.find((client) => client.id === clientId)?.name ?? "—";
  };

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      if (
        employeeFilter !== "all" &&
        task.employee_id !== Number(employeeFilter)
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        task.subject,
        task.vendor,
        task.design,
        task.printing,
        clientName(task.client_id),
        employeeName(task.employee_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    tasks,
    search,
    priorityFilter,
    statusFilter,
    employeeFilter,
    isAdmin,
    clients,
    employees,
  ]);

  const priorityOptions = ["High", "Medium", "Low"];

  const monthOptions = [
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

  const statusOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.status))).sort(),
    [tasks],
  );

  const monthTasks = useMemo(() => {
    return [...filteredTasks]
      .filter((task) => {
        const taskDate = new Date(`${task.date}T00:00:00`);

        if (Number.isNaN(taskDate.getTime())) {
          return false;
        }

        return (
          taskDate.getMonth() === selectedMonth &&
          taskDate.getFullYear() === selectedYear
        );
      })
      .sort(
        (taskA, taskB) =>
          new Date(`${taskA.date}T00:00:00`).getTime() -
          new Date(`${taskB.date}T00:00:00`).getTime(),
      );
  }, [filteredTasks, selectedMonth, selectedYear]);

  return (
    <div className="tasks-page">
      <div className="page-heading tasks-heading">
        <div>
          <h1>Tasks</h1>
          <p>View and manage your assigned tasks.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateModal(true)}
        >
          + New Task
        </button>
      </div>

      <div className="task-filters">
        {(["all", "today", "pending", "completed"] as TaskFilter[]).map(
          (filter) => (
            <button
              key={filter}
              type="button"
              className={
                activeFilter === filter
                  ? "task-filter active"
                  : "task-filter"
              }
              onClick={() => setActiveFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ),
        )}
      </div>

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by designer, description, client, vendor…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
        >
          <option value="all">All priorities</option>
          {priorityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={employeeFilter}
          onChange={(event) => setEmployeeFilter(event.target.value)}
        >
          <option value="all">All Employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="page-error">{error}</div>}

      <div className="tasks-card">
        {isLoading ? (
          <div className="page-loading">Loading tasks...</div>
        ) : monthTasks.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks found</h3>
            <p>
              {tasks.length === 0
                ? "There are no tasks in this category."
                : `No tasks match your search or filters in ${monthOptions[selectedMonth]} ${selectedYear}.`}
            </p>
          </div>
        ) : (
          <div className="task-table-wrapper">
            <table className="task-table">
              <thead>
                <tr>
                  <th>Sr. No</th>
                  <th>Date</th>
                  <th>Designer Name</th>
                  <th>Client</th>
                  <th>Description</th>
                  <th>Design</th>
                  <th>Printing</th>
                  <th>Quantity</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Vendor</th>
                  <th>Remark</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {monthTasks.map((task, index) => (
                  <tr key={task.id}>
                    <td>{index + 1}</td>
                    <td>{task.date}</td>
                    <td>{employeeName(task.employee_id)}</td>
                    <td>{clientName(task.client_id)}</td>
                    <td className="task-text-cell" title={task.subject}>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setViewingTask(task)}
                      >
                        {task.subject}
                      </button>
                    </td>
                    <td>{task.design || "—"}</td>
                    <td>{task.printing || "—"}</td>
                    <td>{task.quantity ?? "—"}</td>
                    <td>
                      <span
                        className={`priority-badge priority-${task.priority.toLowerCase()}`}
                      >
                        {task.priority}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge status-${task.status
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {task.status}
                      </span>
                    </td>

                    <td>{task.vendor || "—"}</td>
                    <td className="task-text-cell" title={task.remark || ""}>
                      {task.remark || "—"}
                    </td>

                    <td className="action-cell">
                      <div className="task-actions">
                        <button
                          type="button"
                          className="secondary-button edit-button"
                          onClick={() => setEditingTask(task)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="secondary-button delete-button"
                          style={{
                            minWidth: 42,
                            padding: "8px 10px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onClick={() => handleDelete(task.id)}
                          aria-label="Delete task"
                          title="Delete task"
                        >
                          <TrashIcon size={18} />
                        </button>

                        {task.status !== "Completed" ? (
                          <button
                            type="button"
                            className="complete-button"
                            disabled={completingTaskId === task.id}
                            onClick={() => handleComplete(task.id)}
                          >
                            {completingTaskId === task.id
                              ? "Completing..."
                              : "Complete"}
                          </button>
                        ) : (
                          <span className="completed-label">Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="task-month-bar" aria-label="Task months">
        <select
          className="task-year-select"
          value={selectedYear}
          onChange={(event) => setSelectedYear(Number(event.target.value))}
          aria-label="Task year"
        >
          {Array.from({ length: 101 }, (_, index) => 2000 + index).map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {monthOptions.map((month, index) => (
          <button
            key={month}
            type="button"
            className={
              selectedMonth === index
                ? "task-month-button active"
                : "task-month-button"
            }
            onClick={() => setSelectedMonth(index)}
          >
            {month}
          </button>
        ))}
      </div>

      {showCreateModal && (
        <TaskFormModal
          mode="create"
          clients={clients}
          employees={employees}
          currentUserId={user?.id}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleTaskSaved}
        />
      )}

      {editingTask && (
        <TaskFormModal
          mode="edit"
          task={editingTask}
          clients={clients}
          employees={employees}
          currentUserId={user?.id}
          onClose={() => setEditingTask(null)}
          onSaved={handleTaskSaved}
        />
      )}

      {viewingTask && (
        <TaskDetailsModal
          task={viewingTask}
          clients={clients}
          employees={employees}
          onClose={() => setViewingTask(null)}
        />
      )}
    </div>
  );
}
