import type { Metadata } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { NavigationLoadingIndicator } from "@/components/shared/navigation-loading-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "SprintIX — Project Management System",
  description: "Manage projects, tasks, teams, and sprints in one place.",
  icons: {
    icon: "/sprintix-logo-hd.png",
    shortcut: "/sprintix-logo-hd.png",
  },
  appleWebApp: { capable: true, title: "SprintIX", statusBarStyle: "default" },
  other: { "mobile-web-app-capable": "yes" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <QueryProvider>
          <AuthProvider>
            <Suspense fallback={null}><NavigationLoadingIndicator /></Suspense>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
