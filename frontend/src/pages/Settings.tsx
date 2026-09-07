import { useNavigate, useOutletContext } from "react-router-dom";

import SettingsPanel from "../components/SettingsPanel";

type SettingsContext = {
  theme: "light" | "dark";
  accent: string;
  onThemeChange: (theme: "light" | "dark") => void;
  onAccentChange: (accent: string) => void;
};

export default function Settings() {
  const navigate = useNavigate();
  const { theme, accent, onThemeChange, onAccentChange } =
    useOutletContext<SettingsContext>();

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">DoozyBrands</p>
          <h2>Settings</h2>
          <p>Manage your account and application appearance.</p>
        </div>
      </header>

      <SettingsPanel
        theme={theme}
        accent={accent}
        onThemeChange={onThemeChange}
        onAccentChange={onAccentChange}
        onClose={() => navigate("/dashboard")}
      />
    </div>
  );
}
