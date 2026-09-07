import { useEffect, useMemo, useState } from "react";

import TrashIcon from "../components/TrashIcon";
import {
  createClient,
  deleteClient,
  getClients,
  getClientTasks,
} from "../api/clients";

import { getErrorMessage } from "../utils/errors";

import type { Client, Task } from "../types";

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState<"all" | "GST" | "NON_GST">("all");

  const [selectedClient, setSelectedClient] =
    useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] =
    useState(false);
  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] =
    useState(false);
  const [clientName, setClientName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadClients() {
    try {
      setLoading(true);
      setError("");

      const data = await getClients(clientTypeFilter);
      setClients(data);
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, "Unable to load clients."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, [clientTypeFilter]);

  async function handleCreateClient(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = clientName.trim();

    if (!name) {
      setCreateError("Client name is required.");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const clientType = (document.getElementById("client-type") as HTMLSelectElement | null)?.value as "GST" | "NON_GST";
      const newClient = await createClient({ name, client_type: clientType || "GST" });

      setClients((current) => [
        ...current,
        newClient,
      ]);

      setClientName("");
      setShowCreateForm(false);
    } catch (err: unknown) {
      setCreateError(
        getErrorMessage(
          err,
          "Unable to create client.",
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  function handleCancelCreate() {
    if (creating) {
      return;
    }

    setClientName("");
    setCreateError("");
    setShowCreateForm(false);
  }

  async function handleClientClick(client: Client) {
    setSelectedClient(client);
    setTasks([]);
    setTasksLoading(true);
    setError("");

    try {
      const data = await getClientTasks(client.id);
      setTasks(data);
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to load client tasks.",
        ),
      );
    } finally {
      setTasksLoading(false);
    }
  }

  async function handleDeleteClient(clientId: number) {
    if (!window.confirm("Delete this client permanently? This will also remove related tasks.")) {
      return;
    }

    setError("");

    try {
      await deleteClient(clientId);
      await loadClients();
      if (selectedClient?.id === clientId) {
        setSelectedClient(null);
        setTasks([]);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete client."));
    }
  }

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return clients;
    }

    return clients.filter((client) =>
      client.name.toLowerCase().includes(query),
    );
  }, [clients, search]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DoozyBrands</p>

          <h2>Clients</h2>

          <p>
            View clients and their assigned tasks.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setCreateError("");
            setShowCreateForm(true);
          }}
        >
          + Add Client
        </button>
      </header>

      {showCreateForm && (
        <section className="dashboard-section">
          <div className="section-heading">
            <h3>Add New Client</h3>
          </div>

          <div className="table-card">
            <form
              onSubmit={handleCreateClient}
              className="client-form"
            >
              <label htmlFor="client-name">
                Client Name
              </label>

              <input
                id="client-name"
                type="text"
                value={clientName}
                onChange={(event) =>
                  setClientName(event.target.value)
                }
                placeholder="Enter client name"
                maxLength={150}
                autoFocus
                disabled={creating}
              />

              <label htmlFor="client-type">
                Client Type
              </label>

              <select id="client-type" defaultValue="GST" disabled={creating}>
                <option value="GST">GST</option>
                <option value="NON_GST">NON-GST</option>
              </select>

              {createError && (
                <div className="page-error">
                  {createError}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    creating ||
                    !clientName.trim()
                  }
                >
                  {creating
                    ? "Creating..."
                    : "Create Client"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelCreate}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search clients…"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />
      </div>

      <div className="toggle-row" style={{ marginBottom: 16 }}>
        {[
          { label: "All Clients", value: "all" },
          { label: "GST Clients", value: "GST" },
          { label: "Non-GST Clients", value: "NON_GST" },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={
              clientTypeFilter === filter.value
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() => setClientTypeFilter(filter.value as "all" | "GST" | "NON_GST")}
            style={{ marginRight: 8 }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="page-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-card">
          Loading clients...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="empty-card">
          {clients.length === 0
            ? "No clients found."
            : "No clients match your search."}
        </div>
      ) : (
        <section className="dashboard-section">
          <div className="section-heading">
            <h3>Clients</h3>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.id}</td>

                    <td
                      className="cell-truncate"
                      title={client.name}
                    >
                      <strong>
                        {client.name}
                      </strong>
                    </td>

                    <td>
                      <span style={{ marginRight: 8, fontSize: 12, fontWeight: 700, color: client.client_type === "GST" ? "#0f766e" : "#7c3aed" }}>
                        {client.client_type}
                      </span>
                      {client.is_active === false ? "Inactive" : "Active"}
                    </td>

                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            handleClientClick(client)
                          }
                        >
                          View Tasks
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          style={{ minWidth: 42, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          onClick={() => handleDeleteClient(client.id)}
                          aria-label="Delete client"
                          title="Delete client"
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
        </section>
      )}

      {selectedClient && (
        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <h3>
                Tasks — {selectedClient.name}
              </h3>
            </div>
          </div>

          {tasksLoading ? (
            <div className="loading-card">
              Loading client tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-card">
              No tasks found for this client.
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
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.id}</td>

                      <td>
                        <strong>
                          {task.subject}
                        </strong>
                      </td>

                      <td>{task.date}</td>

                      <td>{task.priority}</td>

                      <td>{task.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}