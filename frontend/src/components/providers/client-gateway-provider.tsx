"use client";

import React from "react";
import { getClientAuth } from "@/lib/firebase/client";
import { GatewayProvider } from "./GatewayProvider";

export function ClientGatewayProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const url = process.env.NEXT_PUBLIC_GATEWAY_URL || "ws://localhost:18789";

  const getToken = async (): Promise<string> => {
    const auth = getClientAuth();

    // Wait for auth to initialize if currentUser is null, or just throw if absolutely not logged in
    await auth.authStateReady();

    if (!auth.currentUser) {
      throw new Error("User not authenticated locally");
    }
    return auth.currentUser.getIdToken();
  };

  return (
    <GatewayProvider url={url} getToken={getToken}>
      {children}
    </GatewayProvider>
  );
}
