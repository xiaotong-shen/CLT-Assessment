import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// next-intl handles locale routing.
// Auth is checked server-side via auth() in layouts/server components,
// not in middleware — avoids chaining two middleware edge runtimes.
const intlMiddleware = createIntlMiddleware(routing);

export default intlMiddleware;

export const config = {
  // Match all paths except: api routes, Next.js internals, static assets
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
