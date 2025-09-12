import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const flag = String(process.env.NEXT_PUBLIC_MARKETING_ONLY || "").toLowerCase();
  const marketingOnly = flag === "1" || flag === "true" || flag === "yes";
  if (!marketingOnly) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Allow static assets and waitlist endpoints
  const isAsset =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|mp4|webm|mov)$/.test(pathname);

  const isAllowed =
    pathname === "/waitlist" || pathname.startsWith("/waitlist/") ||
    pathname === "/get-started" || pathname.startsWith("/get-started/") ||
    pathname === "/privacy" || pathname.startsWith("/privacy/") ||
    pathname === "/terms" || pathname.startsWith("/terms/") ||
    pathname === "/contact" || pathname.startsWith("/contact/") ||
    pathname === "/login" || pathname.startsWith("/login/") ||
    pathname === "/api/waitlist" || pathname.startsWith("/api/waitlist/") ||
    isAsset;

  if (isAllowed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/waitlist";
  url.search = "";
  return NextResponse.redirect(url, { status: 307 });
}

export const config = {
  matcher: "/:path*",
};
