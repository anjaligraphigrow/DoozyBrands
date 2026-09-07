import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

declare global {
  interface Window {
    electronAPI?: {
      showDesktopNotification: (
        title: string,
        message: string,
        options?: { requireInteraction?: boolean; silent?: boolean },
      ) => Promise<boolean>;
    };
  }
}

import { useAuth } from "../context/AuthContext";
import { getNotifications } from "../api/notifications";
import { getUnreadMessageCount } from "../api/message";
import type { Notification as AppNotification } from "../types";
import {
  ACCENT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "../components/SettingsPanel";
import { getAccentForeground } from "../utils/theme";

const NOTIFICATION_POLL_MS = 30000;
const NORMAL_NOTIFICATION_PREFERENCES_KEY = "notification_preferences";

interface NotificationPreferences {
  messages: boolean;
  files: boolean;
}

function getNotificationPreferences(): NotificationPreferences {
  try {
    const saved = localStorage.getItem(NORMAL_NOTIFICATION_PREFERENCES_KEY);

    if (saved) {
      return {
        messages: true,
        files: true,
        ...JSON.parse(saved),
      };
    }
  } catch {
    // Use enabled defaults when preferences are unavailable.
  }

  return { messages: true, files: true };
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [popup, setPopup] = useState<AppNotification | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light",
  );
  const [accent, setAccent] = useState(
    () => localStorage.getItem(ACCENT_STORAGE_KEY) ?? "#183247",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty(
      "--accent-foreground",
      getAccentForeground(accent),
    );
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }, [accent]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const backendHost = import.meta.env.DEV
      ? window.location.hostname || "127.0.0.1"
      : "192.168.31.154";
    const socket = new WebSocket(
      `${protocol}://${backendHost}:8000/ws/${user.id}`,
    );

    socket.onmessage = (event) => {
      let notification: AppNotification;

      try {
        const data = JSON.parse(event.data);

        if (data.type !== "notification") {
          return;
        }

        notification = {
          id: data.notification_id,
          recipient_id: user.id,
          sender_id: data.sender_id ?? null,
          notification_type: data.notification_type,
          title: data.title,
          message: data.message ?? null,
          is_read: false,
          created_at: new Date().toISOString(),
        };
      } catch {
        return;
      }

      const isManagerCall = notification.notification_type === "manager_call";
      const preferences = getNotificationPreferences();
      const isEnabled =
        isManagerCall ||
        (notification.notification_type === "message" && preferences.messages) ||
        (notification.notification_type === "file_received" && preferences.files);

      setUnreadCount((current) => current + 1);

      if (notification.notification_type === "message") {
        setUnreadMessageCount((current) => current + 1);
      }

      if (!isEnabled) {
        return;
      }

      setPopup(notification);
      window.setTimeout(() => setPopup(null), isManagerCall ? 10000 : 5000);

      const showDesktopNotification = async () => {
        if (window.electronAPI?.showDesktopNotification) {
          await window.electronAPI.showDesktopNotification(
            notification.title,
            notification.message ?? "You have a new notification.",
            { requireInteraction: isManagerCall },
          );
          return;
        }

        if ("Notification" in window) {
          const showBrowserNotification = () => {
            new window.Notification(notification.title, {
              body: notification.message ?? "You have a new notification.",
              requireInteraction: isManagerCall,
            });
          };

          if (window.Notification.permission === "granted") {
            showBrowserNotification();
          } else if (window.Notification.permission !== "denied") {
            const permission = await window.Notification.requestPermission();
            if (permission === "granted") {
              showBrowserNotification();
            }
          }
        }
      };

      showDesktopNotification();
    };

    return () => socket.close();
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCounts() {
      try {
        const [notifications, messageCount] = await Promise.all([
          getNotifications(),
          getUnreadMessageCount(),
        ]);

        if (!cancelled) {
          setUnreadCount(
            notifications.filter((notification) => !notification.is_read).length,
          );
          setUnreadMessageCount(messageCount);
        }
      } catch {
        // Non-critical: if this fails we just don't show a badge.
      }
    }

    loadUnreadCounts();

    const interval = window.setInterval(
      loadUnreadCounts,
      NOTIFICATION_POLL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // Re-poll immediately after navigating to/from the notifications page
    // so the badge stays in sync with what the user just read.
  }, [location.pathname]);

  useEffect(() => {
    function refreshBadges() {
      getNotifications().then((notifications) => {
        setUnreadCount(
          notifications.filter((notification) => !notification.is_read).length,
        );
      });
      getUnreadMessageCount().then(setUnreadMessageCount);
    }

    window.addEventListener("office-badges-refresh", refreshBadges);

    return () =>
      window.removeEventListener("office-badges-refresh", refreshBadges);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const logoUrl = "./doozybrands-logo.jpg";

  return (
    <div className="app-shell">
      {popup && (
        <div
          className={
            popup.notification_type === "manager_call"
              ? "notification-popup manager-call-popup"
              : "notification-popup"
          }
          role="alert"
        >
          <strong>{popup.title}</strong>
          <span>{popup.message}</span>
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <img
            src={logoUrl}
            alt="DoozyBrands"
            className="brand-logo"
          />

          <div>
            <h1>DoozyBrands</h1>
            <span>Management Portal</span>
          </div>
        </div>

        <nav className="navigation">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/tasks">Tasks</NavLink>
          <NavLink to="/printing">Printing</NavLink>
          <NavLink to="/clients">Clients</NavLink>
          {isAdmin && <NavLink to="/employees">Employees</NavLink>}
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/messages" className="nav-link-with-badge">
            <span>Messages</span>
            {unreadMessageCount > 0 && (
              <span className="nav-badge">
                {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/notifications" className="nav-link-with-badge">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="nav-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/files">Files</NavLink>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <strong>{user?.name}</strong>
            <span>
              {user?.role === "admin"
                ? "Admin"
                : user?.role === "manager"
                  ? "Manager"
                  : "Employee"}
            </span>
          </div>

          <NavLink to="/settings" className="settings-toggle">
            <span aria-hidden="true">⚙</span>
            Settings
          </NavLink>

          <button className="logout-button" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet
          context={{
            theme,
            accent,
            onThemeChange: setTheme,
            onAccentChange: setAccent,
          }}
        />
      </main>
    </div>
  );
}
