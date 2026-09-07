import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { getAccentForeground } from "./utils/theme";

const savedAccent = localStorage.getItem("office_accent");

if (savedAccent) {
  document.documentElement.style.setProperty("--accent", savedAccent);
  document.documentElement.style.setProperty(
    "--accent-foreground",
    getAccentForeground(savedAccent),
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);