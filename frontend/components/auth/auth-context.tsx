"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api, setStoredToken } from "@/lib/api";
import { User } from "@/lib/types";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  async function checkSession() {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void checkSession();
  }, []);

  async function login(email: string, password: string, rememberMe: boolean = false) {
    const res = await api.login({ email, password, remember_me: rememberMe });
    setStoredToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  }

  async function register(
    name: string,
    email: string,
    password: string,
    confirmPassword?: string
  ) {
    const res = await api.register({
      name,
      email,
      password,
      confirm_password: confirmPassword
    });
    setStoredToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  }

  async function logout() {
    try {
      await api.logout();
    } catch (err) {
      console.warn("Logout network request warning:", err);
    } finally {
      setStoredToken(null);
      setUser(null);
      // Redirect to landing page as required
      router.push("/");
    }
  }

  async function refreshUser() {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
