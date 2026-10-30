import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch, loginRequest } from "../api";
import { clearToken, readToken, saveToken } from "./storage";

export type User = {
  id: string;
  nome: string;
  email: string;
  role: "cliente" | "barbeiro" | "admin";
  telefone?: string;
  cpf?: string;
  barbeiro_id?: string;
  active: boolean;
  created_at: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    nome: string;
    email: string;
    password: string;
    telefone?: string;
    cpf?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await readToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = (await apiFetch("/auth/me")) as User;
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password);
    await saveToken(res.access_token);
    setUser(res.user);
    return res.user as User;
  }, []);

  const register = useCallback(
    async (data: {
      nome: string;
      email: string;
      password: string;
      telefone?: string;
      cpf?: string;
    }) => {
      const res = (await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
        auth: false,
      })) as { access_token: string; user: User };
      await saveToken(res.access_token);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
