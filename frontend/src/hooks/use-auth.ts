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
    mutationFn: async (payload: LoginRequest) => {
      // The root login is also a convenient entry point for the developer
      // company administrator. Workspace-scoped logins always use the
      // customer flow and can never be treated as platform accounts.
      if (!payload.workspace_slug) {
        try {
          return { data: await authApi.platformLogin(payload.username, payload.password), platform: true };
        } catch (error) {
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status !== 401) throw error;
        }
      }
      return { data: await authApi.login(payload), platform: false };
    },
    onSuccess: async ({ data, platform }) => {
      tokenStorage.setTokens(data.access_token, data.refresh_token);
      const me = platform ? await authApi.getPlatformMe() : await authApi.getMe();
      setUser(me);
      router.push(platform ? "/platform" : "/dashboard");
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
