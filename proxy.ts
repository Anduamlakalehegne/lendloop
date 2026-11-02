import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
const middleware = clerkMiddleware();
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? middleware
  : () => NextResponse.next();
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api|trpc)(.*)",
  ],
};
