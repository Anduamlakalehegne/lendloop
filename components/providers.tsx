"use client";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useState } from "react";

export const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
export const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
export const configured = hasClerk && hasConvex;

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() =>
    process.env.NEXT_PUBLIC_CONVEX_URL
      ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)
      : null,
  );

  let content = children;
  if (client) {
    content = hasClerk ? (
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    ) : (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
  }

  if (hasClerk) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return <>{content}</>;
}
