import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
const PUBLIC_PATHS = [...AUTH_PATHS];
const SESSION_ONLY_AUTH_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Access token lives in localStorage (set by lib/api/client.ts), which
  // middleware can't read directly, so we also mirror it into a lightweight
  // cookie (see providers/auth-provider.tsx) purely for this edge check.
  const hasSession = request.cookies.get("pms_has_session")?.value === "1";

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublicPath && pathname !== "/") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed-in users still need to open password recovery/reset links from
  // account settings. Only send them away from login and registration pages.
  if (hasSession && SESSION_ONLY_AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons).*)"],
};
