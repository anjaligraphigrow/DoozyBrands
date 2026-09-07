import { useEffect, useMemo, useState } from "react";

import { getEmployees } from "../api/users";
import { getTasks } from "../api/tasks";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errors";

import type { Employee, Task } from "../types";

export default function Employees() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | "all">("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const employeeData = await getEmployees();
        setEmployees(employeeData);

        if (isAdmin) {
          const taskData = await getTasks();
          setTasks(taskData);
        } else {
          const taskData = await getTasks();
          setTasks(taskData);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Unable to load employees."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAdmin]);

  const employeeOptions = useMemo(
    () => employees.filter((employee) => employee.role === "employee"),
    [employees],
  );

  useEffect(() => {
    if (employeeOptions.length === 0) {
      setSelectedEmployeeId("all");
      return;
    }

    if (
      selectedEmployeeId !== "all" &&
      !employeeOptions.some((employee) => employee.id === selectedEmployeeId)
    ) {
      setSelectedEmployeeId(employeeOptions[0].id);
    }
  }, [employeeOptions, selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return employees;
    }

    return employees.filter((employee) =>
      employee.name.toLowerCase().includes(query),
    );
  }, [employees, search]);

  const selectedEmployee =
    selectedEmployeeId === "all"
      ? null
      : employeeOptions.find((employee) => employee.id === selectedEmployeeId) ?? null;

  const selectedEmployeeTasks =
    selectedEmployeeId === "all"
      ? tasks
      : tasks.filter((task) => task.employee_id === selectedEmployeeId);

  function statsFor(employeeId: number) {
    const employeeTasks = tasks.filter(
      (task) => task.employee_id === employeeId,
    );

    const completed = employeeTasks.filter(
      (task) => task.status === "Completed",
    ).length;

    return {
      total: employeeTasks.length,
      completed,
      pending: employeeTasks.length - completed,
    };
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DoozyBrands</p>
          <h2>Employees</h2>
          <p>View team members{isAdmin ? " and their task load." : "."}</p>
        </div>
      </header>

      <div className="toolbar" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search employees…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {employeeOptions.length > 0 && (
          <select
            className="search-input"
            value={selectedEmployeeId}
            onChange={(event) =>
              setSelectedEmployeeId(
                event.target.value === "all"
                  ? "all"
                  : Number(event.target.value),
              )
            }
            style={{ minWidth: 220 }}
          >
            <option value="all">All employees</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="page-error">{error}</div>}

      {loading ? (
        <div className="loading-card">Loading employees...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-card">
          {employees.length === 0
            ? "No employees found."
            : "No employees match your search."}
        </div>
      ) : (
        <>
          <section className="dashboard-section">
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    {isAdmin && <th>Total Tasks</th>}
                    {isAdmin && <th>Pending</th>}
                    {isAdmin && <th>Completed</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => {
                    const stats = isAdmin ? statsFor(employee.id) : null;

                    return (
                      <tr key={employee.id}>
                        <td>{employee.id}</td>
                        <td>
                          <strong>{employee.name}</strong>
                        </td>
                        {isAdmin && <td>{stats?.total}</td>}
                        {isAdmin && <td>{stats?.pending}</td>}
                        {isAdmin && <td>{stats?.completed}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {selectedEmployee && (
            <section className="dashboard-section">
              <div className="section-header" style={{ marginBottom: 12 }}>
                <h3>
                  Tasks for {selectedEmployee.name}
                </h3>
              </div>

              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedEmployeeTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No tasks found for this employee.</td>
                      </tr>
                    ) : (
                      selectedEmployeeTasks.map((task) => (
                        <tr key={task.id}>
                          <td>{task.id}</td>
                          <td>{task.date}</td>
                          <td>{task.subject}</td>
                          <td>{task.priority}</td>
                          <td>{task.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
