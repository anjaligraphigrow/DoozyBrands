import { useState, type FormEvent } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { deleteAccount, updateProfile } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errors";

export const THEME_STORAGE_KEY = "office_theme";
export const ACCENT_STORAGE_KEY = "office_accent";

export const ACCENT_COLORS = [
  "#183247",
  "#231847",
  "#521044",
  "#5c0d0d",
  "#07423b",
];

interface SettingsPanelProps {
  theme: "light" | "dark";
  accent: string;
  onThemeChange: (theme: "light" | "dark") => void;
  onAccentChange: (accent: string) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  theme,
  accent,
  onThemeChange,
  onAccentChange,
  onClose,
}: SettingsPanelProps) {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const updatedUser = await updateProfile({
        name: name.trim(),
        phone_number: phoneNumber.trim(),
        ...(password.trim()
          ? { password: password.trim() }
          : {}),
      });

      // Immediately update global user state + localStorage
      updateUser(updatedUser);

      // Keep the form synchronized with the database response
      setName(updatedUser.name ?? "");
      setPhoneNumber(updatedUser.phone_number ?? "");
      setPassword("");

      setMessage("Profile updated successfully.");
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to update profile.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deletingAccount) {
      return;
    }

    const firstConfirmation = window.confirm(
      "Delete your account and all of its data? This cannot be undone.",
    );

    if (!firstConfirmation) {
      return;
    }

    const secondConfirmation = window.confirm(
      "Final confirmation: permanently erase this account, files, tasks, messages, and notifications?",
    );

    if (!secondConfirmation) {
      return;
    }

    setDeletingAccount(true);
    setError("");
    setMessage("");

    try {
      await deleteAccount();
      logout();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete your account."));
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-heading-row">
        <div className="settings-heading">
          <span>Account Settings</span>
          <small>{user?.email}</small>
        </div>
        <button
          type="button"
          className="settings-close"
          onClick={onClose}
          aria-label="Close settings"
          title="Close settings"
        >
          ×
        </button>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <label>
          <span>Phone Number</span>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            type="tel"
          />
        </label>

        <label>
          <span>New Password</span>
          <div className="password-input-wrapper">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Leave blank to keep current"
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEye /> : <FaEyeSlash />}
            </button>
          </div>
        </label>

        <button type="submit" className="settings-save" disabled={saving}>
          {saving ? "Saving..." : "Save Account"}
        </button>
      </form>

      <div className="settings-section">
        <span className="settings-label">Appearance</span>
        <div className="theme-switcher" role="group" aria-label="Color mode">
          <button
            type="button"
            className={theme === "light" ? "selected" : ""}
            onClick={() => onThemeChange("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={theme === "dark" ? "selected" : ""}
            onClick={() => onThemeChange("dark")}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="settings-section">
        <span className="settings-label">Accent Color</span>
        <div className="accent-options">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={accent.toLowerCase() === color.toLowerCase() ? "accent-swatch selected" : "accent-swatch"}
              style={{ backgroundColor: color }}
              onClick={() => onAccentChange(color)}
              aria-label={`Use accent color ${color}`}
              title={color}
            />
          ))}
          <label className="accent-picker" title="Choose custom accent color">
            <input
              type="color"
              value={accent}
              onChange={(event) => onAccentChange(event.target.value)}
              aria-label="Choose custom accent color"
            />
            <span>+</span>
          </label>
        </div>
      </div>

      {(message || error) && (
        <p className={error ? "settings-feedback error" : "settings-feedback"}>
          {error || message}
        </p>
      )}

      <div className="settings-danger-zone">
        <span className="settings-label">Danger Zone</span>
        <p>Deleting your account permanently removes your account and its data.</p>
        <button
          type="button"
          className="danger-button"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? "Deleting Account..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
}
