import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
const PUBLIC_PATHS = [...AUTH_PATHS];

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

  if (hasSession && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons).*)"],
};
