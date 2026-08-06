import { NextResponse, NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const hasToken = request.cookies.has("token");
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !hasToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/" && hasToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // ":path*" also matches "/dashboard" itself, so every dashboard route is
  // covered, not just the index.
  matcher: ["/", "/dashboard/:path*"],
};
