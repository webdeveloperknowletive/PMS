import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PATHS = [
  "/login",
  "/platform/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/verify-email",
  "/verify-email-pending",
  "/terms",
];
const PUBLIC_PATHS = [...AUTH_PATHS];
// Keep login and registration pages open even with an existing session. This
// lets users explicitly reach the credential form from company signup.
const RESERVED_WORKSPACE_NAMES = new Set(["www", "api", "admin", "app", "mail", "support", "status", "help"]);

function getWorkspaceSlug(host: string | null): string | null {
  const domain = (process.env.NEXT_PUBLIC_WORKSPACE_DOMAIN ?? "localhost:3000").trim().toLowerCase();
  const normalizedHost = host?.trim().toLowerCase();
  if (!domain || !normalizedHost || normalizedHost === domain) return null;

  const suffix = `.${domain}`;
  if (!normalizedHost.endsWith(suffix)) return null;

  const slug = normalizedHost.slice(0, -suffix.length);
  if (
    !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug) ||
    RESERVED_WORKSPACE_NAMES.has(slug)
  ) {
    return null;
  }
  return slug;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const workspaceSlug = getWorkspaceSlug(request.headers.get("host"));

  // Access token lives in localStorage (set by lib/api/client.ts), which
  // middleware can't read directly, so we also mirror it into a lightweight
  // cookie (see providers/auth-provider.tsx) purely for this edge check.
  const hasSession = request.cookies.get("pms_has_session")?.value === "1";

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  // Public images/fonts must load on signed-out pages too (for example the
  // logo shown on the login screen). They are files, not protected app routes.
  const isPublicAsset = /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/i.test(pathname);

  if (
    workspaceSlug &&
    pathname === "/login" &&
    request.nextUrl.searchParams.get("workspace_slug") !== workspaceSlug
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.searchParams.set("workspace_slug", workspaceSlug);
    return NextResponse.redirect(loginUrl);
  }

  if (workspaceSlug && pathname === "/") {
    const destination = new URL(hasSession ? "/dashboard" : "/login", request.url);
    if (!hasSession) destination.searchParams.set("workspace_slug", workspaceSlug);
    return NextResponse.redirect(destination);
  }

  if (!hasSession && !isPublicPath && pathname !== "/" && !isPublicAsset) {
    const loginUrl = new URL(pathname.startsWith("/platform") ? "/platform/login" : "/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    if (workspaceSlug) loginUrl.searchParams.set("workspace_slug", workspaceSlug);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons).*)"],
};
