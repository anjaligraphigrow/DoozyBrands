import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getTasks } from "../api/tasks";
import { getClients } from "../api/clients";
import { getNotifications } from "../api/notifications";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errors";

import type {
  Client,
  Notification,
  Task,
} from "../types";

export default function Dashboard() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [taskData, clientData, notificationData] = await Promise.all([
          getTasks(),
          getClients(),
          getNotifications(),
        ]);

        setTasks(taskData);
        setClients(clientData);
        setNotifications(notificationData);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Unable to load dashboard data."));
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const completed = tasks.filter(
    (task) => task.status === "Completed",
  ).length;

  const pending = tasks.length - completed;

  const unreadNotifications = notifications.filter(
    (notification) => !notification.is_read,
  ).length;

  const recentTasks = [...tasks]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-card">
          Loading dashboard...
        </div>
      </div>
    );
  }

  const currentHour = new Date().getHours();

  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 17
        ? "Good afternoon"
        : "Good evening";
        
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {user?.role === "admin"
              ? "Manager Portal"
              : "Employee Portal"}
          </p>

          <h2>
            {greeting}, {user?.name}
          </h2>

          <p>
            Here's what's happening in your office system.
          </p>
        </div>
      </header>

      {error && <div className="page-error">{error}</div>}

      <section className="stats-grid">
        <Link to="/tasks" className="stat-card stat-card-link">
          <span>Total Tasks</span>
          <strong>{tasks.length}</strong>
        </Link>

        <Link to="/tasks?filter=pending" className="stat-card stat-card-link">
          <span>Pending</span>
          <strong>{pending}</strong>
        </Link>

        <Link to="/tasks?filter=completed" className="stat-card stat-card-link">
          <span>Completed</span>
          <strong>{completed}</strong>
        </Link>

        <Link to="/clients" className="stat-card stat-card-link">
          <span>Clients</span>
          <strong>{clients.length}</strong>
        </Link>

        <Link to="/notifications" className="stat-card stat-card-link">
          <span>Unread Notifications</span>
          <strong>{unreadNotifications}</strong>
        </Link>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h3>Quick Actions</h3>
        </div>

        <div className="quick-actions">
          <Link to="/tasks" className="quick-action-card">
            <strong>Manage Tasks</strong>
            <span>Create, edit, and complete tasks</span>
          </Link>

          <Link to="/reports" className="quick-action-card">
            <strong>View Reports</strong>
            <span>Monthly task completion summary</span>
          </Link>

          <Link to="/messages" className="quick-action-card">
            <strong>Messages</strong>
            <span>Chat with your team</span>
          </Link>

          <Link to="/files" className="quick-action-card">
            <strong>Files</strong>
            <span>Upload and share office files</span>
          </Link>

          <Link to="/printing" className="quick-action-card">
            <strong>Printing</strong>
            <span>Track printing orders and status</span>
          </Link>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h3>Recent Tasks</h3>
          <Link to="/tasks" className="section-link">
            View all
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="empty-card">
            No tasks found.
          </div>
        ) : (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.subject}</td>
                    <td>{task.date}</td>
                    <td>{task.priority}</td>
                    <td>
                      <span
                        className={`status status-${task.status.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
