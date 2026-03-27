import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login
     * - /api/auth/* (NextAuth routes)
     * - /api/telegram/webhook
     * - _next/* (Next.js internals)
     * - favicon.ico
     */
    "/((?!login|api/auth|api/telegram/webhook|_next|favicon\\.ico).*)",
  ],
};
