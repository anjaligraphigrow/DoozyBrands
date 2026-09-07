import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getMe, login as loginApi, logout as logoutApi } from "../api/auth";
import type { LoginData } from "../api/auth";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginData) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");

    if (!saved) {
      return null;
    }

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setUser(null);
      return;
    }

    try {
      const currentUser = await getMe();

      setUser(currentUser);
      localStorage.setItem(
        "user",
        JSON.stringify(currentUser),
      );
    } catch {
      // Keep the locally cached session when the backend is temporarily
      // unavailable during application startup.
    }
  }

  async function login(data: LoginData): Promise<User> {
    const result = await loginApi(data);

    setUser(result.user);

    return result.user;
  }

  function logout() {
    logoutApi();
    setUser(null);
  }

  function updateUser(updatedUser: User) {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  }

  useEffect(() => {
    refreshUser().finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
} 