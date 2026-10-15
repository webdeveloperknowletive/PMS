"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { authApi } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

export function AuthProvider({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (tokenStorage.getAccessToken()) {
          const user = await authApi.getMe();
          setUser(user);
        }
      } catch {
        tokenStorage.clear();
        setUser(null);
      } finally {
        setInitializing(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
