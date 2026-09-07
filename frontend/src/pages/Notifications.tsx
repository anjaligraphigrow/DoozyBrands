import { useEffect, useState } from "react";

import TrashIcon from "../components/TrashIcon";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";

import { getErrorMessage } from "../utils/errors";

import type { Notification } from "../types";

const NORMAL_NOTIFICATION_PREFERENCES_KEY = "notification_preferences";

export default function Notifications() {
  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const [messageNotifications, setMessageNotifications] = useState(() =>
    getNormalNotificationPreference("messages"),
  );
  const [fileNotifications, setFileNotifications] = useState(() =>
    getNormalNotificationPreference("files"),
  );

  function updateNormalNotificationPreference(
    type: "messages" | "files",
    enabled: boolean,
  ) {
    const preferences = {
      messages: messageNotifications,
      files: fileNotifications,
      [type]: enabled,
    };

    localStorage.setItem(
      NORMAL_NOTIFICATION_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );

    if (type === "messages") {
      setMessageNotifications(enabled);
    } else {
      setFileNotifications(enabled);
    }
  }

  async function loadNotifications() {
    setLoading(true);
    setError("");

    try {
      const data = await getNotifications();

      setNotifications(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load notifications."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(
    notificationId: number,
  ) {
    try {
      await markNotificationRead(notificationId);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                is_read: true,
              }
            : notification,
        ),
      );
      window.dispatchEvent(new Event("office-badges-refresh"));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to update notification."));
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    setError("");

    try {
      await markAllNotificationsRead();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        })),
      );
      window.dispatchEvent(new Event("office-badges-refresh"));
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, "Unable to mark all notifications as read."),
      );
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDeleteNotification(notificationId: number) {
    if (!window.confirm("Delete this notification permanently?")) {
      return;
    }

    setError("");

    try {
      await deleteNotification(notificationId);
      setNotifications((current) =>
        current.filter((notification) => notification.id !== notificationId),
      );
      window.dispatchEvent(new Event("office-badges-refresh"));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete notification."));
    }
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read,
  ).length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DoozyBrands</p>
          <h2>Notifications</h2>
          <p>
            {unreadCount} unread notification
            {unreadCount === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="notification-header-actions">
          <div className="notification-settings-wrapper">
            <button
              type="button"
              className="icon-button notification-settings-button"
              onClick={() => setShowMuteOptions((current) => !current)}
              aria-label="Mute or unmute message and file notifications"
              title="Mute or unmute notifications"
              aria-expanded={showMuteOptions}
            >
              {messageNotifications || fileNotifications ? "🔔" : "🔕"}
            </button>

            {showMuteOptions && (
              <div className="notification-preferences" role="group">
                <label className="notification-preference-option">
                  <span>Messages</span>
                  <input
                    type="checkbox"
                    checked={messageNotifications}
                    onChange={(event) =>
                      updateNormalNotificationPreference(
                        "messages",
                        event.target.checked,
                      )
                    }
                  />
                </label>
                <label className="notification-preference-option">
                  <span>Files</span>
                  <input
                    type="checkbox"
                    checked={fileNotifications}
                    onChange={(event) =>
                      updateNormalNotificationPreference(
                        "files",
                        event.target.checked,
                      )
                    }
                  />
                </label>
              </div>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              className="primary-button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? "Marking..." : "Mark All Read"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="page-error">
          {error}
        </div>
      )}

      <div className="notifications-card">
        {loading ? (
          <div className="page-loading">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <h3>No notifications</h3>
            <p>You're all caught up.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={
                  notification.is_read
                    ? "notification-item"
                    : "notification-item unread"
                }
              >
                <div>
                  <h3>{notification.title}</h3>

                  {notification.message && (
                    <p>{notification.message}</p>
                  )}

                  <small>
                    {new Date(
                      notification.created_at,
                    ).toLocaleString()}
                  </small>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {!notification.is_read && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        handleMarkRead(
                          notification.id,
                        )
                      }
                    >
                      Mark Read
                    </button>
                  )}

                  <button
                    type="button"
                    className="secondary-button"
                    style={{ minWidth: 42, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => handleDeleteNotification(notification.id)}
                    aria-label="Delete notification"
                    title="Delete notification"
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getNormalNotificationPreference(type: "messages" | "files") {
  try {
    const saved = localStorage.getItem(NORMAL_NOTIFICATION_PREFERENCES_KEY);

    if (saved) {
      const preferences = JSON.parse(saved);
      return preferences[type] !== false;
    }
  } catch {
    // Use the enabled default when preferences are unavailable.
  }

  return true;
}