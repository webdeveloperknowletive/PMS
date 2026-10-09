import { create } from "zustand";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean; // true while we're checking for an existing session on app load
  setUser: (user: User | null) => void;
  setInitializing: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setInitializing: (value) => set({ isInitializing: value }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
