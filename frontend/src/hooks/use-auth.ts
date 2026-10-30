"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";
import type { LoginRequest, RegisterRequest } from "@/types/auth";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, setUser, logout: clearStore } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: async (data) => {
      tokenStorage.setTokens(data.access_token, data.refresh_token);
      const me = await authApi.getMe();
      setUser(me);
      router.push("/dashboard");
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterRequest) => authApi.register(payload),
  });

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore — we clear client-side state regardless
    } finally {
      tokenStorage.clear();
      clearStore();
      router.push("/login");
    }
  };

  return {
    user,
    isAuthenticated,
    isInitializing,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout,
  };
}
