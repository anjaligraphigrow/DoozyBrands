import {
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Printing from "./pages/Printing";
import Clients from "./pages/Clients";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import Files from "./pages/Files";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/printing" element={<Printing />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/files" element={<Files />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </HashRouter>
  );
}
