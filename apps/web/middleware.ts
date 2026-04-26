import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /_static (inside /public)
     * 4. /_vercel (Vercel internals)
     * 5. Static files (e.g. /favicon.ico, /sitemap.xml, /robots.txt, etc.)
     */
    "/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)",
  ],
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // Define your domains
  const rootDomain = "court-reserve-9eeed.web.app";
  const localDomain = "localhost:3000";

  // 1. Detect Tenant from Subdomain (Future & Local testing)
  // e.g., kinetic.court-reserve.com or kinetic.localhost:3000
  let tenantId = null;

  if (hostname.includes(rootDomain) && hostname !== rootDomain) {
    tenantId = hostname.replace(`.${rootDomain}`, "");
  } else if (hostname.includes(localDomain) && hostname !== localDomain) {
    tenantId = hostname.replace(`.${localDomain}`, "");
  }

  // 2. Detect Tenant from Path (Current web.app testing)
  // e.g., court-reserve-9eeed.web.app/kinetic
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // If no subdomain found, we check if the first path segment is a tenant ID
  // For this demo, we'll assume any first path segment that isn't a reserved word is a tenant
  const reservedPaths = ["login", "register", "admin", "dashboard", "images", "api"];
  
  if (!tenantId && pathParts.length > 0 && pathParts[0] && !reservedPaths.includes(pathParts[0])) {
    tenantId = pathParts[0];
    // Create a new URL that removes the tenant prefix for internal routing
    const newPathname = "/" + pathParts.slice(1).join("/");
    url.pathname = newPathname;
  }

  // 3. Perform the Rewrite
  // We rewrite the request to an internal route structure: /_tenant/[tenantId]/...
  if (tenantId) {
    // Add the tenantId to the headers so the app can read it easily
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-tenant-id", tenantId);

    // Silently rewrite to the internal tenant folder
    return NextResponse.rewrite(
      new URL(`/_tenant/${tenantId}${url.pathname === "/" ? "" : url.pathname}`, req.url),
      {
        request: {
          headers: requestHeaders,
        },
      }
    );
  }

  // No tenant detected, proceed to landing page (root)
  return NextResponse.next();
}
