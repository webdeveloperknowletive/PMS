"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const MIN_VISIBLE_MS = 250;
const MAX_NAVIGATION_MS = 15000;
const AUTH_PATHS = new Set([
  "/", "/login", "/platform/login", "/register", "/forgot-password",
  "/reset-password", "/accept-invitation", "/verify-email",
  "/verify-email-pending", "/terms",
]);

export function NavigationLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams.toString()}`;
  const routeRef = useRef(route);
  const startedAt = useRef(0);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const firstLoads = useIsFetching({
    predicate: (query) => query.state.status === "pending" && query.state.fetchStatus === "fetching",
  });
  const mutations = useIsMutating();

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    const start = () => {
      startedAt.current = Date.now();
      setPendingFrom(routeRef.current);
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.getAttribute("target") && anchor.getAttribute("target") !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (`${destination.pathname}?${destination.searchParams.toString()}` === routeRef.current) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  useEffect(() => {
    if (pendingFrom === null) return;
    const elapsed = Date.now() - startedAt.current;
    const delay = route !== pendingFrom ? Math.max(0, MIN_VISIBLE_MS - elapsed) : MAX_NAVIGATION_MS;
    const timer = window.setTimeout(() => setPendingFrom(null), delay);
    return () => window.clearTimeout(timer);
  }, [pendingFrom, route]);

  const visible = pendingFrom !== null || firstLoads > 0 || mutations > 0;
  if (!visible) return null;

  const message = pendingFrom !== null ? "Loading page…" : mutations > 0 ? "Working…" : "Loading data…";
  const headerBottom = AUTH_PATHS.has(pathname) ? 0 : pathname.startsWith("/platform") ? 72 : 56;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[100]" style={{ top: headerBottom }}>
      <div className="h-1 overflow-hidden bg-blue-100"><div className="navigation-loading-bar h-full w-1/3 bg-[#0c66e4]" /></div>
      <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-medium text-[#172b4d] shadow-lg">
        <Loader2 className="h-4 w-4 animate-spin text-[#0c66e4]" />{message}
      </div>
    </div>
  );
}
