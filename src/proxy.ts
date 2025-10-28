import { NextResponse, NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token");

  if (request.nextUrl.clone().pathname === "/dashboard") {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (request.nextUrl.clone().pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
}

export const config = {
  matcher: ["/", "/dashboard"]
};