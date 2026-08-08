import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/session";

const PROTECTED_PREFIXES = ["/dashboard", "/agents", "/tools", "/mcp-servers", "/models", "/memory", "/playground", "/deployments", "/api-keys", "/settings"];
const PROTECTED_API_PREFIXES = ["/api/agents", "/api/projects", "/api/tools", "/api/mcp-servers", "/api/api-keys", "/api/models", "/api/deployments"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtectedPage = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
  // The public agent-run endpoint uses its own API-key auth, not the session cookie.
  const isPublicRunRoute = /^\/api\/agents\/[^/]+\/run$/.test(pathname);

  if (!isProtectedPage && !(isProtectedApi && !isPublicRunRoute)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("oas_session")?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/tools/:path*",
    "/mcp-servers/:path*",
    "/models/:path*",
    "/memory/:path*",
    "/playground/:path*",
    "/deployments/:path*",
    "/api-keys/:path*",
    "/settings/:path*",
    "/api/agents/:path*",
    "/api/projects/:path*",
    "/api/tools/:path*",
    "/api/mcp-servers/:path*",
    "/api/api-keys/:path*",
    "/api/models/:path*",
    "/api/deployments/:path*",
  ],
};
